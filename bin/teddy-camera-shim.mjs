#!/usr/bin/env node
/**
 * teddy-camera-shim.mjs
 *
 * A tiny HTTP shim that exposes the teddy camera's auth-protected endpoints
 * (MJPEG stream, snapshot, thumbs) over URL-based auth, so that
 * homebridge-camera-ffmpeg can fetch them without the CR/LF mess that
 * ffmpeg's -headers produces on a Cookie line.
 *
 * Why this exists:
 *   The teddy camera server (port 18116) requires either:
 *     - Authorization: Bearer <token>, OR
 *     - Cookie: teddycam_session=<cookie>
 *   The homebridge-camera-ffmpeg plugin does source.split(/\s+/) on the
 *   source string. With Bearer, the value has a space ("Authorization: Bearer
 *   xxx") which breaks the split. With Cookie, ffmpeg adds CR/LF to the
 *   cookie value (HTTP spec requirement) and the teddy camera's custom cookie
 *   parser doesn't strip it, returning 400.
 *   This shim accepts ?token=xxx in the URL (no spaces, no CRLF) and proxies
 *   to the teddy camera with a valid local session cookie.
 *
 * Usage:
 *   node bin/teddy-camera-shim.mjs           # default port 18118
 *   TEDDYCAMERA_SHIM_PORT=18119 node bin/teddy-camera-shim.mjs
 *
 * In homebridge config, change the camera's source to:
 *   source: -i http://127.0.0.1:18118/stream.mjpg?token=<token>
 *   stillImageSource: -i http://127.0.0.1:18118/latest.jpg?token=<token>
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const TOKEN_PATH = `${process.env.HOME}/.config/teddycamera/token`;
const CAMERA_HOST = process.env.TEDDYCAMERA_HOST || '127.0.0.1';
const CAMERA_PORT = Number(process.env.TEDDYCAMERA_PORT || 18116);
const SHIM_PORT = Number(process.env.TEDDYCAMERA_SHIM_PORT || 18118);

let cameraToken;
try {
  cameraToken = readFileSync(TOKEN_PATH, 'utf8').trim();
} catch (e) {
  console.error(`Cannot read camera token from ${TOKEN_PATH}: ${e.message}`);
  process.exit(1);
}
if (!cameraToken) {
  console.error('Camera token is empty');
  process.exit(1);
}

let sessionCookie = null;
let sessionCookieAcquiredAt = 0;
let bootstrapPromise = null;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

function invalidateSession() {
  sessionCookie = null;
  sessionCookieAcquiredAt = 0;
}

async function getSessionCookie() {
  if (sessionCookie && Date.now() - sessionCookieAcquiredAt < SESSION_TTL_MS) {
    return sessionCookie;
  }
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = _doBootstrap();
  try {
    const cookie = await bootstrapPromise;
    return cookie;
  } finally {
    bootstrapPromise = null;
  }
}

function _doBootstrap() {
  return new Promise((resolve, reject) => {
    let cookieValue = null;
    let timedOut = false;
    function fetchOnce(targetUrl, hops) {
      if (hops > 3) return reject(new Error('Too many redirects'));
      const u = new URL(targetUrl);
      const req = http.request({
        host: u.hostname,
        port: u.port || 80,
        method: 'GET',
        path: u.pathname + u.search,
        timeout: 10000,
        headers: {
          host: `${u.hostname}:${u.port || 80}`,
          authorization: `Bearer ${cameraToken}`,
          'user-agent': 'teddy-camera-shim/1.0',
        },
      }, res => {
        const rawSetCookies = res.rawHeaders
          ? (() => {
              const out = [];
              for (let i = 0; i < res.rawHeaders.length; i += 2) {
                if (res.rawHeaders[i].toLowerCase() === 'set-cookie') {
                  out.push(res.rawHeaders[i + 1]);
                }
              }
              return out;
            })()
          : [];
        for (const c of rawSetCookies) {
          const m = c.match(/^teddycam_session=([^;,\s]+)/);
          if (m) { cookieValue = m[1]; break; }
        }
        if (cookieValue) {
          res.resume();
          resolve(cookieValue);
          return;
        }
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchOnce(new URL(res.headers.location, targetUrl).toString(), hops + 1);
          return;
        }
        res.resume();
        reject(new Error(`No teddycam_session cookie (status ${res.statusCode})`));
      });
      req.on('error', reject);
      req.on('timeout', () => { timedOut = true; req.destroy(new Error('bootstrap timeout')); });
      req.end();
    }
    fetchOnce(`http://${CAMERA_HOST}:${CAMERA_PORT}/?token=${encodeURIComponent(cameraToken)}`, 0);
  });
}

function proxyToCamera(req, res, urlPath) {
  getSessionCookie()
    .then(cookie => {
      // The cookie header value is just the cookie name=value pair(s).
      // Don't include the literal "Cookie: " prefix in the value — Node's
      // http module will add the header name automatically.
      const cookieHeader = `teddycam_session=${cookie}`;
      // Build upstream headers: forward only safe headers from the client,
      // strip the inbound Host/Authorization/Cookie (we set our own).
      const safeClientHeaders = { ...req.headers };
      delete safeClientHeaders.host;
      delete safeClientHeaders.authorization;
      delete safeClientHeaders.cookie;
      delete safeClientHeaders.connection;
      delete safeClientHeaders['content-length'];
      const opts = {
        host: CAMERA_HOST,
        port: CAMERA_PORT,
        method: req.method,
        path: urlPath,
        headers: {
          ...safeClientHeaders,
          host: `${CAMERA_HOST}:${CAMERA_PORT}`,
          cookie: cookieHeader,
          'user-agent': 'teddy-camera-shim/1.0',
        },
      };
      const upstream = http.request(opts, upstreamRes => {
        if (upstreamRes.statusCode === 403 || upstreamRes.statusCode === 401) {
          console.error(`[shim] upstream ${upstreamRes.statusCode} — invalidating stale session`);
          invalidateSession();
        }
        if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
          upstreamRes.resume();
          return;
        }
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
      });
      upstream.setTimeout(15000, () => { upstream.destroy(new Error('proxy timeout')); });
      upstream.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Upstream error: ${err.message}`);
      });
      req.pipe(upstream);
    })
    .catch(err => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Shim error: ${err.message}`);
    });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://shim.local');
  const token = url.searchParams.get('token');
  if (token !== cameraToken) {
    console.error(`[shim] auth failed: token=${token ? token.slice(0,8)+'...' : 'missing'} expected=${cameraToken.slice(0,8)}...`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: invalid or missing ?token=<token>');
    return;
  }

  // Strip the query string before proxying
  const cleanPath = url.pathname;
  console.error(`[shim] -> ${req.method} ${cleanPath}`);
  proxyToCamera(req, res, cleanPath);
});

server.listen(SHIM_PORT, '127.0.0.1', () => {
  console.log(`[shim] listening on http://127.0.0.1:${SHIM_PORT}/`);
  console.log(`[shim] proxying to http://${CAMERA_HOST}:${CAMERA_PORT}/`);
  console.log(`[shim] auth: ?token=<${cameraToken.slice(0, 8)}...>`);
  console.log(`[shim] in homebridge config, use:`);
  console.log(`[shim]   source: -i http://127.0.0.1:${SHIM_PORT}/stream.mjpg?token=<token>`);
  console.log(`[shim]   stillImageSource: -i http://127.0.0.1:${SHIM_PORT}/latest.jpg?token=<token>`);
});

const fs = require('fs');
const path = require('path');
const auth = require('../auth.cjs');
const secrets = require('../secrets.cjs');
const { sendResponse, sendJson, sendError } = require('../response.cjs');
const { AUTH_FILE, writeJsonFile } = require('../config.cjs');

const {
  DASHBOARD_PASSWORD, SESSION_TTL_MS, sessions,
  createSession, isValidSession, getSessionCookie,
  checkPassword, isRateLimited, recordFailedAttempt, hashPin,
} = auth;

const { getAuth, getSecrets, isPublicMode, isSensitiveKey } = secrets;

function register(ctx) {
  return { DASHBOARD_PASSWORD, SESSION_TTL_MS, sessions, isValidSession, getSessionCookie };
}

function handle(req, res, pathname, parsedUrl) {
  if (req.method === 'GET' && pathname === '/login') {
    const loginPath = path.join(ctx.__dirname, 'login.html');
    fs.readFile(loginPath, (err, data) => {
      if (err) { sendResponse(res, 404, 'text/plain', 'Login page not found'); return; }
      sendResponse(res, 200, 'text/html', data);
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (!DASHBOARD_PASSWORD) {
      sendJson(res, 200, { status: 'ok', redirect: '/' });
      return true;
    }
    const ip = req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      sendJson(res, 429, { error: 'Too many failed attempts. Try again in 15 minutes.' });
      return true;
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const { password } = JSON.parse(body);
        if (checkPassword(password)) {
          const token = createSession();
          const cookieOpts = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`;
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': `lb_session=${token}; ${cookieOpts}`
          });
          res.end(JSON.stringify({ status: 'ok', redirect: '/' }));
        } else {
          recordFailedAttempt(ip);
          sendJson(res, 401, { error: 'Invalid password' });
        }
      } catch (e) {
        sendJson(res, 400, { error: 'Invalid request' });
      }
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getSessionCookie(req);
    if (token) sessions.delete(token);
    res.writeHead(302, {
      'Set-Cookie': 'lb_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      'Location': '/login'
    });
    res.end();
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/auth/status') {
    const authData = getAuth();
    sendJson(res, 200, { hasPin: !!authData.pinHash, publicMode: !!authData.publicMode });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/set-pin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { pin, currentPin } = JSON.parse(body);
        if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
          sendJson(res, 400, { error: 'PIN must be 4-6 digits' }); return;
        }
        const authData = getAuth();
        if (authData.pinHash && (!currentPin || hashPin(currentPin) !== authData.pinHash)) {
          sendJson(res, 403, { error: 'Current PIN is incorrect' }); return;
        }
        authData.pinHash = hashPin(pin);
        writeJsonFile(AUTH_FILE, authData);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/verify-pin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const authData = getAuth();
        if (!authData.pinHash) { sendJson(res, 200, { valid: true }); return; }
        const valid = hashPin(pin) === authData.pinHash;
        sendJson(res, 200, { valid });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/remove-pin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const authData = getAuth();
        if (authData.pinHash && hashPin(pin) !== authData.pinHash) {
          sendJson(res, 403, { error: 'PIN is incorrect' }); return;
        }
        delete authData.pinHash;
        writeJsonFile(AUTH_FILE, authData);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/mode') {
    const authData = getAuth();
    sendJson(res, 200, { publicMode: !!authData.publicMode });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/mode') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { publicMode, pin } = JSON.parse(body);
        const authData = getAuth();
        if (authData.pinHash && (!pin || hashPin(pin) !== authData.pinHash)) {
          sendJson(res, 403, { error: 'PIN required' }); return;
        }
        authData.publicMode = !!publicMode;
        writeJsonFile(AUTH_FILE, authData);
        sendJson(res, 200, { status: 'ok', publicMode: authData.publicMode });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return true;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/secrets\/[^/]+$/)) {
    if (isPublicMode()) { sendJson(res, 403, { error: 'Forbidden in public mode' }); return true; }
    const widgetId = pathname.split('/')[3];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const secretsData = getSecrets();
        if (!secretsData[widgetId]) secretsData[widgetId] = {};
        Object.assign(secretsData[widgetId], updates);
        writeJsonFile(require('../config.cjs').SECRETS_FILE, secretsData);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return true;
  }

  if (req.method === 'DELETE' && pathname.match(/^\/api\/secrets\/[^/]+\/[^/]+$/)) {
    if (isPublicMode()) { sendJson(res, 403, { error: 'Forbidden in public mode' }); return true; }
    const parts = pathname.split('/');
    const widgetId = parts[3];
    const key = parts[4];
    const secretsData = getSecrets();
    if (secretsData[widgetId]) {
      delete secretsData[widgetId][key];
      if (Object.keys(secretsData[widgetId]).length === 0) delete secretsData[widgetId];
      writeJsonFile(require('../config.cjs').SECRETS_FILE, secretsData);
    }
    sendJson(res, 200, { status: 'ok' });
    return true;
  }

  return false;
}

let ctx = {};

module.exports = function(context) {
  ctx = context;
  return { handle, register };
};

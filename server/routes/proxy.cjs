const { sendResponse, sendJson, sendError, parseIcal } = require('../response.cjs');
const { getSecrets } = require('../secrets.cjs');

function isPrivateHost(hostname) {
  const patterns = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^0\./, /^localhost$/i, /^\[?::1\]?$/, /^\[?fc/i, /^\[?fd/i
  ];
  return patterns.some(p => p.test(hostname));
}

function handle(req, res, pathname, parsedUrl) {
  if (req.method === 'GET' && pathname === '/api/rss') {
    let feedUrl = parsedUrl.searchParams.get('url');
    const rssWidgetId = parsedUrl.searchParams.get('widgetId');
    const rssSecretKey = parsedUrl.searchParams.get('secretKey') || 'feedUrl';
    if ((!feedUrl || feedUrl === '••••••••' || feedUrl === '__SECRET__') && rssWidgetId) {
      const secrets = getSecrets();
      feedUrl = secrets[rssWidgetId]?.[rssSecretKey] || null;
    }
    if (!feedUrl) { sendError(res, 'Missing url parameter', 400); return true; }

    try {
      const parsed = new URL(feedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendError(res, 'Only http and https URLs are allowed', 400); return true;
      }
      if (isPrivateHost(parsed.hostname)) {
        sendError(res, 'URLs pointing to private/internal addresses are not allowed', 400); return true;
      }
    } catch (urlErr) {
      sendError(res, 'Invalid URL', 400); return true;
    }

    try {
      const https = require('https');
      const http2 = require('http');
      function fetchFeed(url, redirects) {
        if (redirects > 3) { sendError(res, 'Too many redirects'); return; }
        try {
          const rp = new URL(url);
          if (rp.protocol !== 'http:' && rp.protocol !== 'https:') { sendError(res, 'Redirect to disallowed scheme', 400); return; }
          if (isPrivateHost(rp.hostname)) { sendError(res, 'Redirect to private address blocked', 400); return; }
        } catch (_) { sendError(res, 'Invalid redirect URL', 400); return; }
        const mod = url.startsWith('https') ? https : http2;
        const req2 = mod.get(url, { headers: { 'User-Agent': 'LobsterBoard/1.0' }, timeout: 15000 }, (proxyRes) => {
          if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            proxyRes.resume();
            fetchFeed(proxyRes.headers.location, redirects + 1);
            return;
          }
          let body = '';
          proxyRes.on('data', c => { body += c; if (body.length > 5000000) proxyRes.destroy(); });
          proxyRes.on('end', () => { sendResponse(res, 200, 'application/xml', body, { 'Access-Control-Allow-Origin': '*' }); });
        });
        req2.on('error', e => sendError(res, e.message));
        req2.on('timeout', () => { req2.destroy(); sendError(res, 'Feed request timed out'); });
      }
      fetchFeed(feedUrl, 0);
    } catch (e) { sendError(res, e.message); }
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/calendar') {
    let icalUrl = parsedUrl.searchParams.get('url');
    const maxEvents = Math.min(parseInt(parsedUrl.searchParams.get('max')) || 10, 50);
    const widgetId = parsedUrl.searchParams.get('widgetId');
    const secretKey = parsedUrl.searchParams.get('secretKey') || 'icalUrl';
    if ((!icalUrl || icalUrl === '••••••••' || icalUrl === '__SECRET__') && widgetId) {
      const secrets = getSecrets();
      icalUrl = secrets[widgetId]?.[secretKey] || null;
    }
    if (!icalUrl) { sendError(res, 'Missing url parameter', 400); return true; }

    try {
      const parsed = new URL(icalUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendError(res, 'Only http and https URLs are allowed', 400); return true;
      }
      if (isPrivateHost(parsed.hostname)) {
        sendError(res, 'URLs pointing to private/internal addresses are not allowed', 400); return true;
      }
    } catch (urlErr) {
      sendError(res, 'Invalid URL', 400); return true;
    }

    if (!global._calendarCache) global._calendarCache = {};
    const cacheKey = icalUrl + '|' + maxEvents;
    const cached = global._calendarCache[cacheKey];
    if (cached && Date.now() - cached.ts < 300000) {
      sendJson(res, 200, cached.data);
      return true;
    }

    try {
      const https = require('https');
      const http2 = require('http');
      function fetchIcal(url, redirects) {
        if (redirects > 3) { sendError(res, 'Too many redirects'); return; }
        try {
          const rp = new URL(url);
          if (rp.protocol !== 'http:' && rp.protocol !== 'https:') { sendError(res, 'Redirect to disallowed scheme', 400); return; }
          if (isPrivateHost(rp.hostname)) { sendError(res, 'Redirect to private address blocked', 400); return; }
        } catch (_) { sendError(res, 'Invalid redirect URL', 400); return; }
        const mod = url.startsWith('https') ? https : http2;
        const req2 = mod.get(url, { headers: { 'User-Agent': 'LobsterBoard/1.0' }, timeout: 15000 }, (proxyRes) => {
          if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            proxyRes.resume();
            fetchIcal(proxyRes.headers.location, redirects + 1);
            return;
          }
          let body = '';
          proxyRes.on('data', c => { body += c; if (body.length > 5000000) proxyRes.destroy(); });
          proxyRes.on('end', () => {
            try {
              const events = parseIcal(body, maxEvents);
              global._calendarCache[cacheKey] = { ts: Date.now(), data: events };
              sendJson(res, 200, events);
            } catch (e) { sendError(res, 'Failed to parse iCal: ' + e.message); }
          });
        });
        req2.on('error', e => sendError(res, e.message));
        req2.on('timeout', () => { req2.destroy(); sendError(res, 'Request timed out'); });
      }
      fetchIcal(icalUrl, 0);
    } catch (e) { sendError(res, e.message); }
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/quote') {
    const https = require('https');
    https.get('https://zenquotes.io/api/random', { headers: { 'User-Agent': 'LobsterBoard/1.0' }, timeout: 5000 }, (proxyRes) => {
      let body = '';
      proxyRes.on('data', c => body += c);
      proxyRes.on('end', () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        sendResponse(res, 200, 'application/json', body);
      });
    }).on('error', (e) => {
      sendResponse(res, 200, 'application/json', JSON.stringify([{ q: 'Stay hungry, stay foolish.', a: 'Steve Jobs' }]));
    });
    return true;
  }

  return false;
}

module.exports = function() {
  return { handle };
};

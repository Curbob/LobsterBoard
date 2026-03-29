/**
 * LobsterBoard Builder Server
 *
 * A simple server to:
 * - Serve builder static files
 * - Handle loading and saving of config.json for the builder
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// ── Library modules ──
const config = require('./server/config.cjs');
const { CWD, PKG_DIR, PAGES_DIRS, PAGES_DIR, MIME_TYPES } = config;
const { loadPages, matchPageRoute } = require('./server/pages.cjs');
const { cachedStats, sseClients } = require('./server/stats.cjs');
const auth = require('./server/auth.cjs');
const { DASHBOARD_PASSWORD, sessions, isValidSession, getSessionCookie } = auth;
const { isPublicMode } = require('./server/secrets.cjs');
const { sendResponse, sendJson, sendError } = require('./server/response.cjs');

// ── Initialize pages ──
let loadedPages = loadPages();
console.log(`📄 Loaded ${loadedPages.length} page(s): ${loadedPages.map(p => p.icon + ' ' + p.title).join(', ') || 'none'}`);

// ── Route modules ──
const ctx = { __dirname };
const authRoutes = require('./server/routes/auth.cjs')(ctx);
const configRoutes = require('./server/routes/config.cjs')();
const serverRoutes = require('./server/routes/servers.cjs')();
const dataRoutes = require('./server/routes/data.cjs')();
const aiUsageRoutes = require('./server/routes/ai-usage.cjs')();
const systemRoutes = require('./server/routes/system.cjs')(ctx);
const proxyRoutes = require('./server/routes/proxy.cjs')();
const templateRoutes = require('./server/routes/templates.cjs')(ctx);
const fileRoutes = require('./server/routes/files.cjs')(ctx);

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // ── Auth: serve login page + login/logout actions ──
  if (req.method === 'GET' && pathname === '/login') {
    const loginPath = path.join(__dirname, 'login.html');
    fs.readFile(loginPath, (err, data) => {
      if (err) { sendResponse(res, 404, 'text/plain', 'Login page not found'); return; }
      sendResponse(res, 200, 'text/html', data);
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    return authRoutes.handle(req, res, pathname, parsedUrl);
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    return authRoutes.handle(req, res, pathname, parsedUrl);
  }

  // ── Auth: enforce session for all other routes ──
  if (DASHBOARD_PASSWORD) {
    const token = getSessionCookie(req);
    if (!isValidSession(token)) {
      if (pathname.startsWith('/api/')) {
        sendJson(res, 401, { status: 'error', message: 'Not authenticated' });
      } else {
        res.writeHead(302, { 'Location': '/login' });
        res.end();
      }
      return;
    }
  }

  // CORS preflight
  if (req.method === 'OPTIONS' && (pathname === '/config' || pathname.startsWith('/api/') || pathname === '/api/pages')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ── Route delegation ──
  // Auth-related routes (PIN, mode, secrets)
  if (authRoutes.handle(req, res, pathname, parsedUrl)) return;

  // Public mode guard: block edit-related APIs
  if (isPublicMode()) {
    const editPaths = ['/config'];
    const isEditApi = (req.method === 'POST' && editPaths.includes(pathname)) ||
                      (req.method === 'POST' && pathname.startsWith('/api/templates/')) ||
                      (req.method === 'DELETE' && pathname.startsWith('/api/templates/'));
    if (isEditApi) {
      sendJson(res, 403, { error: 'Dashboard is in public mode. Editing is disabled.' });
      return;
    }
  }

  // Config routes
  if (configRoutes.handle(req, res, pathname)) return;

  // Server profiles routes
  if (serverRoutes.handle(req, res, pathname)) return;

  // Pages system routing
  const pageMatch = matchPageRoute(loadedPages, req.method, pathname, parsedUrl);
  if (pageMatch) {
    if (pageMatch.type === 'list') {
      sendJson(res, 200, loadedPages.filter(p => p.nav !== false).map(p => ({ id: p.id, title: p.title, icon: p.icon, description: p.description, order: p.order })));
      return;
    }
    if (pageMatch.type === 'redirect') {
      res.writeHead(302, { Location: pageMatch.location });
      res.end();
      return;
    }
    if (pageMatch.type === 'static') {
      const resolved = path.resolve(pageMatch.filePath);
      const isAllowed = PAGES_DIRS.some(dir => resolved.startsWith(path.resolve(dir)));
      if (!isAllowed) {
        sendResponse(res, 403, 'text/plain', 'Forbidden');
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      fs.readFile(resolved, (err, data) => {
        if (err) { sendResponse(res, 404, 'text/plain', 'Not Found'); return; }
        sendResponse(res, 200, contentType, data);
      });
      return;
    }
    if (pageMatch.type === 'api') {
      if (req.method === 'GET') {
        try {
          const result = await pageMatch.handler(req, res, { query: pageMatch.query, body: {}, params: pageMatch.params });
          if (result !== undefined && !res.writableEnded) sendJson(res, res.statusCode || 200, result);
        } catch (e) { sendError(res, e.message); }
        return;
      }
      const MAX_BODY = 1024 * 1024;
      let body = '';
      let overflow = false;
      req.on('data', chunk => { body += chunk.toString(); if (body.length > MAX_BODY) { overflow = true; req.destroy(); } });
      req.on('end', async () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        let parsed = {};
        try { if (body) parsed = JSON.parse(body); } catch (_) {}
        try {
          const result = await pageMatch.handler(req, res, { query: pageMatch.query, body: parsed, params: pageMatch.params });
          if (result !== undefined && !res.writableEnded) sendJson(res, res.statusCode || 200, result);
        } catch (e) { sendError(res, e.message); }
      });
      return;
    }
  }

  // Data routes (todos, notes)
  if (dataRoutes.handle(req, res, pathname)) return;

  // AI usage routes
  if (await aiUsageRoutes.handle(req, res, pathname)) return;

  // System routes (cron, logs, releases, today, activity)
  if (systemRoutes.handle(req, res, pathname, parsedUrl)) return;

  // Proxy routes (RSS, calendar, quote)
  if (proxyRoutes.handle(req, res, pathname, parsedUrl)) return;

  // Stats routes
  if (req.method === 'GET' && pathname === '/api/stats') {
    sendJson(res, 200, cachedStats);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/stats/stream') {
    if (sseClients.size >= 10) {
      sendError(res, 'Too many SSE connections', 429);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify(cachedStats)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Template routes
  if (templateRoutes.handle(req, res, pathname, parsedUrl)) return;

  // File routes (latest-image, browse-dirs)
  if (fileRoutes.handle(req, res, pathname, parsedUrl)) return;

  // Serve static files
  const publicPath = path.join(CWD, 'public', pathname);
  const publicResolved = path.resolve(publicPath);
  if (publicResolved.startsWith(path.join(CWD, 'public') + path.sep) && fs.existsSync(publicPath)) {
    const ext = path.extname(publicPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(publicPath, (err, data) => {
      if (err) { sendError(res, err.message); return; }
      sendResponse(res, 200, contentType, data);
    });
    return;
  }

  let filePath = path.join(__dirname, pathname);
  if (pathname === '/') {
    filePath = path.join(__dirname, 'app.html');
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(__dirname + path.sep) && resolved !== __dirname) {
    sendResponse(res, 403, 'text/plain', 'Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendResponse(res, 404, 'text/plain', 'Not Found');
      } else {
        sendError(res, `Server error: ${err.message}`);
      }
      return;
    }
    sendResponse(res, 200, contentType, data);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

server.listen(PORT, HOST, () => {
  const authStatus = DASHBOARD_PASSWORD
    ? '   Password auth: ENABLED (DASHBOARD_PASSWORD is set)'
    : '   Password auth: DISABLED — set DASHBOARD_PASSWORD=yourpassword to enable';
  console.log(`
LobsterBoard Builder Server running at http://${HOST}:${PORT}

${authStatus}

   Press Ctrl+C to stop
`);
});

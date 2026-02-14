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
const os = require('os');
const si = require('systeminformation');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// ─────────────────────────────────────────────
// Pages System — auto-discovery and mounting
// ─────────────────────────────────────────────
const PAGES_DIR = path.join(__dirname, 'pages');
const PAGES_JSON = path.join(__dirname, 'pages.json');
const DATA_DIR = path.join(__dirname, 'data');

let loadedPages = []; // { id, title, icon, description, order, routes: { 'METHOD /path': handler } }

function loadPages() {
  const pages = [];
  let overrides = { pages: {} };
  try { overrides = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf8')); } catch (_) {}

  let dirs;
  try { dirs = fs.readdirSync(PAGES_DIR); } catch (_) { return pages; }

  for (const dir of dirs) {
    if (dir.startsWith('_')) continue;
    const metaPath = path.join(PAGES_DIR, dir, 'page.json');
    if (!fs.existsSync(metaPath)) continue;

    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { continue; }

    const override = overrides.pages[meta.id] || {};
    meta.enabled = override.enabled ?? meta.enabled ?? true;
    meta.order = override.order ?? meta.order ?? 99;

    if (!meta.enabled) continue;

    // Ensure data dir
    const dataDir = path.join(DATA_DIR, meta.id);
    fs.mkdirSync(dataDir, { recursive: true });

    // Load API routes if api.cjs (or api.js) exists
    let apiPath = path.join(PAGES_DIR, dir, 'api.cjs');
    if (!fs.existsSync(apiPath)) apiPath = path.join(PAGES_DIR, dir, 'api.js');
    let routes = {};
    if (fs.existsSync(apiPath)) {
      try {
        const ctx = {
          dataDir,
          readData: (filename) => JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8')),
          writeData: (filename, obj) => {
            fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(obj, null, 2));
          }
        };
        const pageModule = require(apiPath)(ctx);
        routes = pageModule.routes || {};
      } catch (e) {
        console.error(`Error loading page API for ${meta.id}:`, e.message);
      }
    }

    pages.push({
      id: meta.id,
      title: meta.title,
      icon: meta.icon,
      description: meta.description,
      order: meta.order,
      nav: meta.nav !== false,
      routes
    });
  }

  return pages.sort((a, b) => a.order - b.order);
}

// Parse a route pattern like 'GET /items/:id' into a regex + param names
function compileRoute(pattern) {
  const [method, ...pathParts] = pattern.split(' ');
  const routePath = pathParts.join(' ');
  const paramNames = [];

  // Handle wildcard * segments
  let regexStr = routePath.replace(/\*/g, '(.+)').replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  // Track if wildcard was used
  const hasWildcard = routePath.includes('*');
  if (hasWildcard && !paramNames.includes('*')) {
    // Insert wildcard param name at the position it appears
    const parts = routePath.split('/');
    let wildcardIdx = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '*') {
        paramNames.splice(wildcardIdx, 0, '*');
        break;
      }
      if (parts[i].startsWith(':')) wildcardIdx++;
      if (parts[i] === '*') break;
    }
  }

  return { method: method.toUpperCase(), regex: new RegExp('^' + regexStr + '$'), paramNames };
}

// Try to match a request against page routes
function matchPageRoute(pages, method, pathname, parsedUrl) {
  // Check /api/pages listing endpoint
  if (method === 'GET' && pathname === '/api/pages') {
    return { type: 'list' };
  }

  // Check /pages/<id> for static file serving
  const pagesMatch = pathname.match(/^\/pages\/([^/]+)(\/.*)?$/);
  if (pagesMatch) {
    const pageId = pagesMatch[1];
    if (pageId === '_shared') {
      return { type: 'static', filePath: path.join(PAGES_DIR, '_shared', (pagesMatch[2] || '/').slice(1)) };
    }
    const page = pages.find(p => p.id === pageId);
    if (page) {
      const subPath = pagesMatch[2] || '/';
      if (subPath === '/' || subPath === '') {
        return { type: 'static', filePath: path.join(PAGES_DIR, pageId, 'index.html') };
      }
      return { type: 'static', filePath: path.join(PAGES_DIR, pageId, subPath.slice(1)) };
    }
  }

  // Check /api/pages/<id>/* for API routes
  const apiMatch = pathname.match(/^\/api\/pages\/([^/]+)(\/.*)?$/);
  if (apiMatch) {
    const pageId = apiMatch[1];
    const page = pages.find(p => p.id === pageId);
    if (!page) return null;

    const subPath = apiMatch[2] || '/';
    const routeEntries = Object.entries(page.routes);

    // Sort routes: specific before wildcard, longer before shorter
    routeEntries.sort((a, b) => {
      const aHasWild = a[0].includes('*');
      const bHasWild = b[0].includes('*');
      if (aHasWild !== bHasWild) return aHasWild ? 1 : -1;
      return b[0].length - a[0].length;
    });

    for (const [pattern, handler] of routeEntries) {
      const compiled = compileRoute(pattern);
      if (compiled.method !== method) continue;
      const match = subPath.match(compiled.regex);
      if (match) {
        const params = {};
        compiled.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        const query = {};
        parsedUrl.searchParams.forEach((v, k) => { query[k] = v; });
        return { type: 'api', handler, params, query, pageId };
      }
    }
  }

  return null;
}

// Initialize pages
loadedPages = loadPages();
console.log(`📄 Loaded ${loadedPages.length} page(s): ${loadedPages.map(p => p.icon + ' ' + p.title).join(', ') || 'none'}`);

// ─────────────────────────────────────────────
// System Stats Collection (cached, tiered intervals)
// ─────────────────────────────────────────────
const cachedStats = {
  cpu: null,
  memory: null,
  disk: null,
  network: null,
  docker: null,
  uptime: null,
  timestamp: null
};

const sseClients = new Set();

function broadcastStats() {
  const payload = `data: ${JSON.stringify(cachedStats)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

// Guard against overlapping async calls when si.* is slow
let _cpuNetRunning = false;
let _memRunning = false;
let _diskRunning = false;
let _dockerRunning = false;

// CPU + Network: every 2s
setInterval(async () => {
  if (_cpuNetRunning) return;
  _cpuNetRunning = true;
  try {
    const [cpu, net] = await Promise.all([
      si.currentLoad(),
      si.networkStats()
    ]);
    cachedStats.cpu = { currentLoad: cpu.currentLoad, cpus: cpu.cpus.map(c => c.load) };
    cachedStats.network = net.map(n => ({
      iface: n.iface, rx_sec: n.rx_sec, tx_sec: n.tx_sec,
      rx_bytes: n.rx_bytes, tx_bytes: n.tx_bytes
    }));
    cachedStats.timestamp = Date.now();
    broadcastStats();
  } catch (e) { console.error('Stats error (cpu/net):', e.message); }
  _cpuNetRunning = false;
}, 2000);

// Memory: every 5s
setInterval(async () => {
  if (_memRunning) return;
  _memRunning = true;
  try {
    const mem = await si.mem();
    cachedStats.memory = { total: mem.total, used: mem.used, free: mem.free, active: mem.active };
  } catch (e) { console.error('Stats error (mem):', e.message); }
  _memRunning = false;
}, 5000);

// Disk: every 30s
setInterval(async () => {
  if (_diskRunning) return;
  _diskRunning = true;
  try {
    const disk = await si.fsSize();
    cachedStats.disk = disk.map(d => ({
      fs: d.fs, mount: d.mount, size: d.size, used: d.used, available: d.available, use: d.use
    }));
  } catch (e) { console.error('Stats error (disk):', e.message); }
  _diskRunning = false;
}, 30000);

// Docker: every 5s (graceful fail)
setInterval(async () => {
  if (_dockerRunning) return;
  _dockerRunning = true;
  try {
    cachedStats.docker = await si.dockerContainers();
  } catch (_) { cachedStats.docker = []; }
  _dockerRunning = false;
}, 5000);

// Uptime: every 60s
setInterval(async () => {
  try {
    cachedStats.uptime = si.time().uptime;
  } catch (e) { console.error('Stats error (uptime):', e.message); }
}, 60000);

// Initial fetch
(async () => {
  try {
    const [cpu, mem, disk, net] = await Promise.all([
      si.currentLoad(), si.mem(), si.fsSize(), si.networkStats()
    ]);
    cachedStats.cpu = { currentLoad: cpu.currentLoad, cpus: cpu.cpus.map(c => c.load) };
    cachedStats.memory = { total: mem.total, used: mem.used, free: mem.free, active: mem.active };
    cachedStats.disk = disk.map(d => ({ fs: d.fs, mount: d.mount, size: d.size, used: d.used, available: d.available, use: d.use }));
    cachedStats.network = net.map(n => ({ iface: n.iface, rx_sec: n.rx_sec, tx_sec: n.tx_sec, rx_bytes: n.rx_bytes, tx_bytes: n.tx_bytes }));
    cachedStats.uptime = si.time().uptime;
    cachedStats.timestamp = Date.now();
    try { cachedStats.docker = await si.dockerContainers(); } catch (_) { cachedStats.docker = []; }
  } catch (e) { console.error('Initial stats fetch error:', e.message); }
})();

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.map': 'application/json' // For sourcemaps
};

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Release check cache (1 hour TTL)
let _releaseCache = null;
let _releaseCacheTime = 0;

function sendResponse(res, statusCode, contentType, data, extraHeaders = {}) {
  res.writeHead(statusCode, { 'Content-Type': contentType, ...extraHeaders });
  res.end(data);
}

function sendJson(res, statusCode, data) {
  sendResponse(res, statusCode, 'application/json', JSON.stringify(data), { 'Access-Control-Allow-Origin': '*' });
}

function sendError(res, message, statusCode = 500) {
  sendJson(res, statusCode, { status: 'error', message });
}

// Parse iCal (.ics) text into sorted upcoming events
function parseIcal(text, maxEvents) {
  const now = new Date();
  const events = [];
  // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    if (!block) continue;
    const get = (key) => { const m = block.match(new RegExp('^' + key + '(?:;[^:]*)?:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const location = get('LOCATION').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    if (!dtstart) continue;
    // Parse iCal date: 20260210T150000Z or 20260210 (all-day)
    const allDay = dtstart.length === 8;
    const parseIcalDate = (s) => {
      if (!s) return null;
      if (s.length === 8) return new Date(s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8) + 'T00:00:00');
      // 20260210T150000Z or 20260210T150000
      const d = s.replace(/Z$/, '');
      return new Date(d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8) + 'T' + d.slice(9,11) + ':' + d.slice(11,13) + ':' + d.slice(13,15) + (s.endsWith('Z') ? 'Z' : ''));
    };
    const start = parseIcalDate(dtstart);
    const end = parseIcalDate(dtend);
    if (!start || isNaN(start.getTime())) continue;
    // Only future events (for all-day, include today)
    const cutoff = allDay ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : now;
    if (start < cutoff && (!end || end < cutoff)) continue;
    events.push({ summary: summary || 'Untitled', start: start.toISOString(), end: end ? end.toISOString() : null, location: location || null, allDay });
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events.slice(0, maxEvents);
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS preflight for /config
  if (req.method === 'OPTIONS' && pathname === '/config') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // GET /config - Load dashboard configuration
  if (req.method === 'GET' && pathname === '/config') {
    fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // If config.json doesn't exist, return empty config
          sendJson(res, 200, { canvas: { width: 1920, height: 1080 }, widgets: [] });
        } else {
          sendError(res, `Failed to read config file: ${err.message}`);
        }
        return;
      }
      try {
        const config = JSON.parse(data);
        sendJson(res, 200, config);
      } catch (parseErr) {
        sendError(res, `Failed to parse config file: ${parseErr.message}`);
      }
    });
    return;
  }

  // POST /config - Save dashboard configuration
  if (req.method === 'POST' && pathname === '/config') {
    const MAX_BODY = 1024 * 1024; // 1 MB limit
    let body = '';
    let overflow = false;
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > MAX_BODY) { overflow = true; req.destroy(); }
    });
    req.on('end', () => {
      if (overflow) { sendError(res, 'Request body too large', 413); return; }
      try {
        const config = JSON.parse(body);
        fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8', (err) => {
          if (err) {
            sendError(res, `Failed to write config file: ${err.message}`);
            return;
          }
          sendJson(res, 200, { status: 'success', message: 'Config saved' });
        });
      } catch (parseErr) {
        sendError(res, `Invalid JSON in request body: ${parseErr.message}`, 400);
      }
    });
    return;
  }

  // CORS preflight for /api/*
  if (req.method === 'OPTIONS' && (pathname.startsWith('/api/') || pathname === '/api/pages')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ── Pages system routing ──
  const pageMatch = matchPageRoute(loadedPages, req.method, pathname, parsedUrl);
  if (pageMatch) {
    if (pageMatch.type === 'list') {
      sendJson(res, 200, loadedPages.filter(p => p.nav !== false).map(p => ({ id: p.id, title: p.title, icon: p.icon, description: p.description, order: p.order })));
      return;
    }
    if (pageMatch.type === 'static') {
      const resolved = path.resolve(pageMatch.filePath);
      if (!resolved.startsWith(path.resolve(PAGES_DIR))) {
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
      // Parse body for non-GET requests
      if (req.method === 'GET') {
        try {
          const result = pageMatch.handler(req, res, { query: pageMatch.query, body: {}, params: pageMatch.params });
          if (result !== undefined && !res.writableEnded) sendJson(res, res.statusCode || 200, result);
        } catch (e) { sendError(res, e.message); }
        return;
      }
      // Parse JSON body
      const MAX_BODY = 1024 * 1024;
      let body = '';
      let overflow = false;
      req.on('data', chunk => { body += chunk.toString(); if (body.length > MAX_BODY) { overflow = true; req.destroy(); } });
      req.on('end', () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        let parsed = {};
        try { if (body) parsed = JSON.parse(body); } catch (_) {}
        try {
          const result = pageMatch.handler(req, res, { query: pageMatch.query, body: parsed, params: pageMatch.params });
          if (result !== undefined && !res.writableEnded) sendJson(res, res.statusCode || 200, result);
        } catch (e) { sendError(res, e.message); }
      });
      return;
    }
  }

  // GET/POST /api/todos - Read/write todo list
  if (pathname === '/api/todos') {
    const todosFile = path.join(__dirname, 'todos.json');
    if (req.method === 'GET') {
      fs.readFile(todosFile, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') return sendJson(res, 200, []);
          return sendError(res, err.message);
        }
        try { sendJson(res, 200, JSON.parse(data)); }
        catch (e) { sendJson(res, 200, []); }
      });
      return;
    }
    if (req.method === 'POST') {
      const MAX_TODO_BODY = 256 * 1024; // 256 KB limit
      let body = '';
      let overflow = false;
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > MAX_TODO_BODY) { overflow = true; req.destroy(); }
      });
      req.on('end', () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        try {
          const todos = JSON.parse(body);
          fs.writeFile(todosFile, JSON.stringify(todos, null, 2), 'utf8', (err) => {
            if (err) return sendError(res, err.message);
            sendJson(res, 200, { status: 'ok' });
          });
        } catch (e) { sendError(res, 'Invalid JSON', 400); }
      });
      return;
    }
  }

  // GET /api/cron - Read cron jobs from OpenClaw cron store
  if (req.method === 'GET' && pathname === '/api/cron') {
    const cronFile = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
    fs.readFile(cronFile, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return sendJson(res, 200, { jobs: [] });
        return sendError(res, err.message);
      }
      try {
        const parsed = JSON.parse(data);
        const jobs = (parsed.jobs || []).map(j => ({
          name: j.name,
          schedule: j.schedule?.expr || '—',
          tz: j.schedule?.tz || '',
          enabled: j.enabled,
          lastRun: j.state?.lastRunAtMs ? new Date(j.state.lastRunAtMs).toISOString() : null,
          lastStatus: j.state?.lastStatus || null
        }));
        sendJson(res, 200, { jobs });
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // GET /api/system-log - Structured system log entries
  if (req.method === 'GET' && pathname === '/api/system-log') {
    try {
      const logPath = path.join(os.homedir(), '.openclaw', 'logs', 'gateway.log');
      if (!fs.existsSync(logPath)) {
        sendJson(res, 200, { status: 'ok', entries: [] });
        return;
      }
      const content = fs.readFileSync(logPath, 'utf8');
      const maxLines = Math.min(Math.max(parseInt(parsedUrl.searchParams.get('max')) || 50, 1), 200);
      const lines = content.split('\n').filter(l => l.trim());
      const entries = lines.slice(-maxLines).reverse().map(line => {
        let level = 'INFO';
        let category = 'system';
        if (/\b(error|fatal)\b/i.test(line)) level = 'ERROR';
        else if (/\bwarn/i.test(line)) level = 'WARN';
        else if (/\b(ok|success|ready|started|connected)\b/i.test(line)) level = 'OK';
        const tsMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
        const time = tsMatch ? tsMatch[1] : new Date().toISOString();
        if (/\b(cron|schedule)\b/i.test(line)) category = 'cron';
        else if (/\b(auth|login|token)\b/i.test(line)) category = 'auth';
        else if (/\b(session|agent)\b/i.test(line)) category = 'session';
        else if (/\b(exec|command)\b/i.test(line)) category = 'exec';
        else if (/\b(file|read|write)\b/i.test(line)) category = 'file';
        else if (/\b(restart|gateway|start)\b/i.test(line)) category = 'gateway';
        let message = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\s*/, '').trim();
        return { time, level, category, message };
      });
      sendJson(res, 200, { status: 'ok', entries });
    } catch (e) {
      sendJson(res, 200, { status: 'ok', entries: [{ time: new Date().toISOString(), level: 'ERROR', category: 'system', message: 'Error reading log: ' + e.message }] });
    }
    return;
  }

  // GET /api/logs - Read last 50 lines from gateway log
  if (req.method === 'GET' && pathname === '/api/logs') {
    const logFile = path.join(os.homedir(), '.openclaw', 'logs', 'gateway.log');
    fs.readFile(logFile, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return sendJson(res, 200, { lines: [] });
        return sendError(res, err.message);
      }
      const allLines = data.split('\n').filter(l => l.trim());
      const lines = allLines.slice(-50);
      sendJson(res, 200, { lines });
    });
    return;
  }

  // GET /api/auth - OpenClaw auth status
  if (req.method === 'GET' && pathname === '/api/auth') {
    try {
      const home = os.homedir();
      const configPath = path.join(home, '.openclaw', 'openclaw.json');
      const authProfilesPath = path.join(home, '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const authProfiles = JSON.parse(fs.readFileSync(authProfilesPath, 'utf8'));

      // Get primary anthropic profile
      const anthropicOrder = config.auth?.order?.anthropic || [];
      const primaryId = anthropicOrder[0] || 'anthropic:default';
      const profileKey = primaryId.includes(':') ? primaryId : `anthropic:${primaryId}`;
      const profileType = authProfiles.profiles?.[profileKey]?.type;
      const mode = profileType === 'token' ? 'Monthly' : 'API';

      sendJson(res, 200, { status: 'ok', mode, primary: profileKey });
    } catch (e) {
      sendError(res, `Auth status error: ${e.message}`);
    }
    return;
  }

  // GET /api/releases - OpenClaw release info (cached 1hr)
  if (req.method === 'GET' && pathname === '/api/releases') {
    const now = Date.now();
    if (_releaseCache && (now - _releaseCacheTime) < 3600000) {
      sendJson(res, 200, _releaseCache);
      return;
    }
    (async () => {
      try {
        let currentVersion = 'unknown';
        try {
          // Use process.execPath to find the node binary's lib directory
          const nodeDir = path.dirname(path.dirname(process.execPath)); // e.g. /Users/x/.nvm/versions/node/v24.13.0
          const candidates = [
            path.join(nodeDir, 'lib/node_modules/openclaw/package.json'),
            path.join(os.homedir(), '.nvm/versions/node', process.version, 'lib/node_modules/openclaw/package.json'),
            '/usr/local/lib/node_modules/openclaw/package.json'
          ];
          for (const cand of candidates) {
            try {
              currentVersion = JSON.parse(fs.readFileSync(cand, 'utf8')).version;
              break;
            } catch (_) {}
          }
        } catch (_) {}

        const ghRes = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest');
        const ghData = await ghRes.json();
        const result = {
          status: 'ok',
          current: currentVersion,
          latest: ghData.tag_name,
          latestUrl: ghData.html_url,
          publishedAt: ghData.published_at
        };
        _releaseCache = result;
        _releaseCacheTime = now;
        sendJson(res, 200, result);
      } catch (e) {
        sendError(res, `Release check error: ${e.message}`);
      }
    })();
    return;
  }

  // GET /api/today - Today's activity summary (port 3000 style)
  if (req.method === 'GET' && pathname === '/api/today') {
    try {
      const { execSync } = require('child_process');
      const now = new Date();
      const dateStr = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
      const activities = [];

      // 1. Today's memory file headers
      const memoryDir = path.join(os.homedir(), 'clawd', 'memory');
      const todayFile = path.join(memoryDir, `${dateStr}.md`);
      if (fs.existsSync(todayFile)) {
        const content = fs.readFileSync(todayFile, 'utf8');
        content.split('\n').forEach(line => {
          if (line.startsWith('#')) {
            const text = line.replace(/^#+\s*/, '').trim();
            if (text && !/session notes/i.test(text)) {
              activities.push({ type: 'note', icon: '📝', text, source: 'memory' });
            }
          }
        });
      }

      // 2. Git commits from today
      try {
        const commits = execSync(
          `cd ~/clawd && git log --since="today 00:00" --pretty=format:"%s" 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (commits) {
          commits.split('\n').slice(0, 10).forEach(msg => {
            if (msg.trim()) {
              activities.push({ type: 'commit', icon: '💾', text: msg.trim(), source: 'git' });
            }
          });
        }
      } catch (_) {}

      // 3. Cron job runs from today
      const cronFile = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      if (fs.existsSync(cronFile)) {
        try {
          const cronData = JSON.parse(fs.readFileSync(cronFile, 'utf8'));
          (cronData.jobs || []).forEach(job => {
            const lastMs = job.state && job.state.lastRunAtMs;
            if (lastMs) {
              const runDate = new Date(lastMs);
              const runDateStr = [runDate.getFullYear(), String(runDate.getMonth()+1).padStart(2,'0'), String(runDate.getDate()).padStart(2,'0')].join('-');
              if (runDateStr === dateStr) {
                activities.push({ type: 'cron', icon: '⏰', text: `${job.name} ran`, source: 'cron', status: job.state.lastStatus || 'ok' });
              }
            }
          });
        } catch (_) {}
      }

      // Dedupe
      const seen = new Set();
      const unique = activities.filter(a => {
        const key = a.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      sendJson(res, 200, { date: dateStr, activities: unique.slice(0, 15), count: unique.length });
    } catch (e) {
      const now = new Date();
      const dateStr = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
      sendJson(res, 200, { date: dateStr, activities: [], count: 0, error: e.message });
    }
    return;
  }

  // GET /api/activity - Recent activity from today's memory file
  if (req.method === 'GET' && pathname === '/api/activity') {
    try {
      const now = new Date();
      // Use local date (EST), not UTC
      const dateStr = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
      const memoryDir = path.join(__dirname, '..', 'memory');
      const todayFile = path.join(memoryDir, `${dateStr}.md`);
      const items = [];
      if (fs.existsSync(todayFile)) {
        const content = fs.readFileSync(todayFile, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          // Extract bullet points and headings as activity items
          if (trimmed.startsWith('- ') && trimmed.length > 4) {
            items.push({ text: trimmed.slice(2), time: dateStr });
          } else if (trimmed.startsWith('## ') && trimmed.length > 4) {
            items.push({ text: '📌 ' + trimmed.slice(3), time: dateStr });
          }
        }
      }
      // If no memory file, show a placeholder
      if (items.length === 0) {
        items.push({ text: 'No activity logged yet today.' });
      }
      sendJson(res, 200, { items: items.slice(-20).reverse() });
    } catch (e) {
      sendJson(res, 200, { items: [{ text: 'Error loading activity: ' + e.message }] });
    }
    return;
  }

  // GET /api/rss?url=<feedUrl> - Server-side RSS proxy
  if (req.method === 'GET' && pathname === '/api/rss') {
    const feedUrl = parsedUrl.searchParams.get('url');
    if (!feedUrl) { sendError(res, 'Missing url parameter', 400); return; }

    // Validate URL: only http/https, block private/internal IPs (SSRF protection)
    function isPrivateHost(hostname) {
      const patterns = [
        /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
        /^169\.254\./, /^0\./, /^localhost$/i, /^\[?::1\]?$/, /^\[?fc/i, /^\[?fd/i
      ];
      return patterns.some(p => p.test(hostname));
    }
    try {
      const parsed = new URL(feedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendError(res, 'Only http and https URLs are allowed', 400); return;
      }
      if (isPrivateHost(parsed.hostname)) {
        sendError(res, 'URLs pointing to private/internal addresses are not allowed', 400); return;
      }
    } catch (urlErr) {
      sendError(res, 'Invalid URL', 400); return;
    }

    try {
      const https = require('https');
      const http2 = require('http');
      function fetchFeed(url, redirects) {
        if (redirects > 3) { sendError(res, 'Too many redirects'); return; }
        // Validate each URL (including redirects) against SSRF
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
    return;
  }

  // GET /api/calendar?url=<icalUrl>&max=<maxEvents> - iCal feed proxy + parser
  if (req.method === 'GET' && pathname === '/api/calendar') {
    const icalUrl = parsedUrl.searchParams.get('url');
    const maxEvents = Math.min(parseInt(parsedUrl.searchParams.get('max')) || 10, 50);
    if (!icalUrl) { sendError(res, 'Missing url parameter', 400); return; }

    // Validate URL: only http/https, block private/internal IPs
    function isPrivateHost(hostname) {
      const patterns = [
        /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
        /^169\.254\./, /^0\./, /^localhost$/i, /^\[?::1\]?$/, /^\[?fc/i, /^\[?fd/i
      ];
      return patterns.some(p => p.test(hostname));
    }
    try {
      const parsed = new URL(icalUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendError(res, 'Only http and https URLs are allowed', 400); return;
      }
      if (isPrivateHost(parsed.hostname)) {
        sendError(res, 'URLs pointing to private/internal addresses are not allowed', 400); return;
      }
    } catch (urlErr) {
      sendError(res, 'Invalid URL', 400); return;
    }

    // 5-minute cache keyed by url+max
    if (!global._calendarCache) global._calendarCache = {};
    const cacheKey = icalUrl + '|' + maxEvents;
    const cached = global._calendarCache[cacheKey];
    if (cached && Date.now() - cached.ts < 300000) {
      sendJson(res, 200, cached.data);
      return;
    }

    try {
      const https = require('https');
      const http2 = require('http');
      function fetchIcal(url, redirects) {
        if (redirects > 3) { sendError(res, 'Too many redirects'); return; }
        // Validate each URL (including redirects) against SSRF
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
    return;
  }

  // GET /api/usage/claude - Anthropic Claude usage proxy
  if (req.method === 'GET' && pathname === '/api/usage/claude') {
    let apiKey = process.env.ANTHROPIC_ADMIN_KEY;
    if (!apiKey) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const w = (cfg.widgets || []).find(w => w.type === 'ai-usage-claude');
        if (w && w.properties && w.properties.apiKey) apiKey = w.properties.apiKey;
      } catch(e) {}
    }
    if (!apiKey) { sendJson(res, 200, { error: 'No API key configured. Add your Anthropic Admin key in the widget properties.', tokens: 0, cost: 0, models: [] }); return; }
    (async () => {
      try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
        // Week: Monday of current week
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now.getTime() - mondayOffset * 86400000).toISOString().slice(0, 10);
        // Month: 1st of current month
        const monthStart = today.slice(0, 8) + '01';
        const headers = { 'anthropic-version': '2023-06-01', 'x-api-key': apiKey };
        const base = 'https://api.anthropic.com/v1/organizations/usage_report/messages';

        function aggregateBuckets(data) {
          let totalTokens = 0, totalCost = 0;
          const modelMap = {};
          for (const bucket of (data.data || [])) {
            const input = bucket.input_tokens || 0;
            const output = bucket.output_tokens || 0;
            const tokens = input + output;
            const cost = (bucket.input_cost || 0) + (bucket.output_cost || 0);
            totalTokens += tokens;
            totalCost += cost;
            const model = bucket.model || 'unknown';
            if (!modelMap[model]) modelMap[model] = { name: model, tokens: 0, cost: 0 };
            modelMap[model].tokens += tokens;
            modelMap[model].cost += cost;
          }
          return { tokens: totalTokens, cost: totalCost, models: Object.values(modelMap) };
        }

        const [todayResp, weekResp, monthResp] = await Promise.all([
          fetch(`${base}?starting_at=${today}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers }),
          fetch(`${base}?starting_at=${weekStart}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers }),
          fetch(`${base}?starting_at=${monthStart}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers })
        ]);

        const todayData = await todayResp.json();
        if (!todayResp.ok) { sendJson(res, 200, { error: todayData.error?.message || 'API error', tokens: 0, cost: 0, models: [] }); return; }
        const weekData = await weekResp.json();
        const monthData = await monthResp.json();

        const todayAgg = aggregateBuckets(todayData);
        const weekAgg = aggregateBuckets(weekData);
        const monthAgg = aggregateBuckets(monthData);

        sendJson(res, 200, {
          tokens: todayAgg.tokens, cost: todayAgg.cost, models: todayAgg.models,
          week: { tokens: weekAgg.tokens, cost: weekAgg.cost },
          month: { tokens: monthAgg.tokens, cost: monthAgg.cost }
        });
      } catch (e) {
        sendJson(res, 200, { error: e.message, tokens: 0, cost: 0, models: [] });
      }
    })();
    return;
  }

  // GET /api/usage/openai - OpenAI usage proxy
  if (req.method === 'GET' && pathname === '/api/usage/openai') {
    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const w = (cfg.widgets || []).find(w => w.type === 'ai-usage-openai');
        if (w && w.properties && w.properties.apiKey) apiKey = w.properties.apiKey;
      } catch(e) {}
    }
    if (!apiKey) { sendJson(res, 200, { error: 'No API key configured. Add your OpenAI key in the widget properties.', tokens: 0, cost: 0, models: [] }); return; }
    (async () => {
      try {
        const now = new Date();
        const todayUnix = Math.floor(new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').getTime() / 1000);
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStartUnix = todayUnix - mondayOffset * 86400;
        const monthStartUnix = Math.floor(new Date(now.toISOString().slice(0, 8) + '01T00:00:00Z').getTime() / 1000);
        const headers = { 'Authorization': `Bearer ${apiKey}` };
        const base = 'https://api.openai.com/v1/organization/costs';

        function aggregateOpenAI(data) {
          let totalCost = 0;
          const modelMap = {};
          for (const bucket of (data.data || [])) {
            for (const lineItem of (bucket.results || [])) {
              const cost = (lineItem.amount?.value || 0);
              totalCost += cost;
              const model = lineItem.line_item || 'unknown';
              if (!modelMap[model]) modelMap[model] = { name: model, tokens: 0, cost: 0 };
              modelMap[model].cost += cost;
            }
          }
          return { cost: totalCost / 100, models: Object.values(modelMap).map(m => ({ ...m, cost: m.cost / 100 })) };
        }

        const [todayResp, weekResp, monthResp] = await Promise.all([
          fetch(`${base}?start_time=${todayUnix}&bucket_width=1d`, { headers }),
          fetch(`${base}?start_time=${weekStartUnix}&bucket_width=1d`, { headers }),
          fetch(`${base}?start_time=${monthStartUnix}&bucket_width=1d`, { headers })
        ]);

        const todayData = await todayResp.json();
        if (!todayResp.ok) {
          const errMsg = todayData.error?.message || todayData.error || 'API error';
          const hint = typeof errMsg === 'string' && errMsg.includes('scope') ? ' Enable "Usage: Read" scope on your API key.' : '';
          sendJson(res, 200, { error: errMsg + hint, tokens: 0, cost: 0, models: [] }); return;
        }
        const weekData = await weekResp.json();
        const monthData = await monthResp.json();

        const todayAgg = aggregateOpenAI(todayData);
        const weekAgg = aggregateOpenAI(weekData);
        const monthAgg = aggregateOpenAI(monthData);

        sendJson(res, 200, {
          tokens: 0, cost: todayAgg.cost, models: todayAgg.models,
          week: { tokens: 0, cost: weekAgg.cost },
          month: { tokens: 0, cost: monthAgg.cost }
        });
      } catch (e) {
        sendJson(res, 200, { error: e.message, tokens: 0, cost: 0, models: [] });
      }
    })();
    return;
  }

  // GET /api/stats - Return cached system stats
  if (req.method === 'GET' && pathname === '/api/stats') {
    sendJson(res, 200, cachedStats);
    return;
  }

  // GET /api/stats/stream - SSE endpoint for live stats
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

  // Serve static files
  let filePath = path.join(__dirname, pathname);
  if (pathname === '/') {
    filePath = path.join(__dirname, 'app.html');
  }

  // Prevent path traversal — ensure resolved path stays within __dirname
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
  console.log(`
🦞 LobsterBoard Builder Server running at http://${HOST}:${PORT}

   Press Ctrl+C to stop
`);
});

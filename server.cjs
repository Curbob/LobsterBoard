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
const crypto = require('crypto');

// ─────────────────────────────────────────────
// ECDH Crypto utilities for encrypted agent communication
// ─────────────────────────────────────────────
const ECDH_CURVE = 'prime256v1';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function generateEcdhKeyPair() {
  const ecdh = crypto.createECDH(ECDH_CURVE);
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey('base64'),
    privateKey: ecdh.getPrivateKey('base64'),
  };
}

function deriveSharedSecret(privateKeyBase64, theirPublicKeyBase64) {
  const ecdh = crypto.createECDH(ECDH_CURVE);
  ecdh.setPrivateKey(Buffer.from(privateKeyBase64, 'base64'));
  const sharedPoint = ecdh.computeSecret(Buffer.from(theirPublicKeyBase64, 'base64'));
  return crypto.createHash('sha256').update(sharedPoint).digest();
}

function decryptPayload(encryptedBase64, keyBuffer) {
  const packed = Buffer.from(encryptedBase64, 'base64');
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, keyBuffer, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// ─────────────────────────────────────────────
// Pages System — auto-discovery and mounting
// ─────────────────────────────────────────────
// Load from both package pages AND user's working directory pages (user overrides package)
const CWD = process.cwd();
// When run via npx/bin, LOBSTERBOARD_PKG_DIR tells us where the package is
const PKG_DIR = process.env.LOBSTERBOARD_PKG_DIR || __dirname;
const USER_PAGES_DIR = path.join(CWD, 'pages');
const PKG_PAGES_DIR = path.join(PKG_DIR, 'pages');
const PAGES_DIRS = [PKG_PAGES_DIR]; // Package pages first
if (CWD !== PKG_DIR && fs.existsSync(USER_PAGES_DIR)) {
  PAGES_DIRS.push(USER_PAGES_DIR); // User pages override
}
// For backwards compat, PAGES_DIR points to first available (used for _shared)
const PAGES_DIR = fs.existsSync(USER_PAGES_DIR) ? USER_PAGES_DIR : PKG_PAGES_DIR;
const USER_PAGES_JSON = path.join(CWD, 'pages.json');
const PKG_PAGES_JSON = path.join(__dirname, 'pages.json');
const PAGES_JSON = fs.existsSync(USER_PAGES_JSON) ? USER_PAGES_JSON : PKG_PAGES_JSON;
// Data always in working directory (user's data)
const DATA_DIR = path.join(CWD, 'data');

let loadedPages = []; // { id, title, icon, description, order, routes: { 'METHOD /path': handler } }

function loadPages() {
  const pages = [];
  const seenIds = new Set();
  let overrides = { pages: {} };
  try { overrides = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf8')); } catch (_) {}

  // Scan all page directories (user pages loaded last to override package pages)
  for (const pagesDir of PAGES_DIRS) {
    let dirs;
    try { dirs = fs.readdirSync(pagesDir); } catch (_) { continue; }

    for (const dir of dirs) {
      if (dir.startsWith('_')) continue;
      const metaPath = path.join(pagesDir, dir, 'page.json');
      if (!fs.existsSync(metaPath)) continue;

      let meta;
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { continue; }

      const override = overrides.pages[meta.id] || {};
      meta.enabled = override.enabled ?? meta.enabled ?? true;
      meta.order = override.order ?? meta.order ?? 99;

      if (!meta.enabled) continue;

      // If we've seen this ID before (from package), remove it so user page wins
      if (seenIds.has(meta.id)) {
        const idx = pages.findIndex(p => p.id === meta.id);
        if (idx !== -1) pages.splice(idx, 1);
      }
      seenIds.add(meta.id);

      // Store which directory this page came from
      meta._pagesDir = pagesDir;

      // Ensure data dir
      const dataDir = path.join(DATA_DIR, meta.id);
      fs.mkdirSync(dataDir, { recursive: true });

      // Load API routes if api.cjs (or api.js) exists
      let apiPath = path.join(pagesDir, dir, 'api.cjs');
      if (!fs.existsSync(apiPath)) apiPath = path.join(pagesDir, dir, 'api.js');
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
        _pagesDir: pagesDir,
        routes
      });
    }
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
      const subPath = pagesMatch[2] || '';
      // Redirect /pages/id to /pages/id/ (trailing slash) for proper relative path resolution
      if (!subPath) {
        return { type: 'redirect', location: `/pages/${pageId}/` };
      }
      const pageDir = page._pagesDir || PAGES_DIR;
      if (subPath === '/') {
        return { type: 'static', filePath: path.join(pageDir, pageId, 'index.html') };
      }
      return { type: 'static', filePath: path.join(pageDir, pageId, subPath.slice(1)) };
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

// User config files — stored in working directory (survives npm updates)
const CONFIG_FILE = path.join(CWD, 'config.json');
const AUTH_FILE = path.join(CWD, 'auth.json');
const SECRETS_FILE = path.join(CWD, 'secrets.json');

// ─────────────────────────────────────────────
// Migration: copy data from package dir to user dir (v0.6.2+)
// ─────────────────────────────────────────────
function migrateUserData() {
  const filesToMigrate = ['config.json', 'auth.json', 'secrets.json', 'todos.json', 'notes.json'];
  const dirsToMigrate = ['data'];
  let migrated = [];

  for (const file of filesToMigrate) {
    const userPath = path.join(CWD, file);
    const pkgPath = path.join(PKG_DIR, file);
    if (!fs.existsSync(userPath) && fs.existsSync(pkgPath)) {
      try {
        fs.copyFileSync(pkgPath, userPath);
        migrated.push(file);
      } catch (e) { /* ignore */ }
    }
  }

  for (const dir of dirsToMigrate) {
    const userDir = path.join(CWD, dir);
    const pkgDir = path.join(PKG_DIR, dir);
    if (!fs.existsSync(userDir) && fs.existsSync(pkgDir)) {
      try {
        fs.cpSync(pkgDir, userDir, { recursive: true });
        migrated.push(dir + '/');
      } catch (e) { /* ignore */ }
    }
  }

  if (migrated.length > 0) {
    console.log(`📦 Migrated data to working directory: ${migrated.join(', ')}`);
  }
}

// Run migration on startup
if (CWD !== PKG_DIR) {
  migrateUserData();
}

// ─────────────────────────────────────────────
// Server-side Session Authentication
// ─────────────────────────────────────────────

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || null;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;

// In-memory session store: token -> expiresAt timestamp
const sessions = new Map();

// Rate limit store: ip -> { count, resetAt }
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}

function createSession() {
  const token = generateSessionToken();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

function getSessionCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)lb_session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

function checkPassword(input) {
  if (!DASHBOARD_PASSWORD || !input) return false;
  // HMAC both inputs so timingSafeEqual always compares equal-length buffers
  const inputHash = crypto.createHmac('sha256', 'lb-session-auth').update(String(input)).digest();
  const correctHash = crypto.createHmac('sha256', 'lb-session-auth').update(DASHBOARD_PASSWORD).digest();
  return crypto.timingSafeEqual(inputHash, correctHash);
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { loginAttempts.delete(ip); return false; }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
  entry.count++;
  loginAttempts.set(ip, entry);
}

// Clean expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (now > exp) sessions.delete(token);
  }
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────
// Security helpers
// ─────────────────────────────────────────────

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function readJsonFile(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); } catch (_) { return fallback; }
}

function writeJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function getAuth() { return readJsonFile(AUTH_FILE, {}); }
function getSecrets() { return readJsonFile(SECRETS_FILE, {}); }

const SENSITIVE_KEYS = ['apiKey', 'api_key', 'token', 'secret', 'password', 'icalUrl'];

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.includes(key);
}

function isPublicMode() {
  const auth = getAuth();
  return auth.publicMode === true;
}

/** Mask sensitive fields in config before sending to browser */
function maskConfig(config) {
  const secrets = getSecrets();
  const masked = JSON.parse(JSON.stringify(config));
  if (masked.widgets) {
    masked.widgets.forEach(w => {
      if (!w.properties) return;
      const widgetSecrets = secrets[w.id] || {};
      for (const key of Object.keys(w.properties)) {
        if (isSensitiveKey(key) && (w.properties[key] === '__SECRET__' || widgetSecrets[key])) {
          w.properties[key] = '••••••••';
        }
      }
    });
  }
  return masked;
}

/** On save: extract sensitive values into secrets.json, replace with __SECRET__ in config */
function extractSecrets(config) {
  const secrets = getSecrets();
  if (config.widgets) {
    config.widgets.forEach(w => {
      if (!w.properties) return;
      for (const key of Object.keys(w.properties)) {
        if (isSensitiveKey(key)) {
          const val = w.properties[key];
          if (val && val !== '__SECRET__' && val !== '••••••••') {
            if (!secrets[w.id]) secrets[w.id] = {};
            secrets[w.id][key] = val;
            w.properties[key] = '__SECRET__';
          } else if (val === '••••••••') {
            // User didn't change it — keep existing secret, restore placeholder
            w.properties[key] = '__SECRET__';
          }
        }
      }
    });
  }
  writeJsonFile(SECRETS_FILE, secrets);
  return config;
}

// Scan templates directory for meta.json files
function scanTemplates(templatesDir) {
  const templates = [];
  try {
    const dirs = fs.readdirSync(templatesDir);
    for (const dir of dirs) {
      if (dir === 'templates.json' || dir === 'README.md' || dir.startsWith('.')) continue;
      const metaPath = path.join(templatesDir, dir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          templates.push(meta);
        } catch (_) {}
      }
    }
  } catch (_) {}
  return templates;
}

// Release check cache (1 hour TTL)
let _releaseCache = null;
let _releaseCacheTime = 0;
let _lbReleaseCache = null;
let _lbReleaseCacheTime = 0;

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
    const getWithParams = (key) => { const m = block.match(new RegExp('^' + key + '((?:;[^:]*)?):(.*)$', 'm')); return m ? { params: m[1], value: m[2].trim() } : { params: '', value: '' }; };
    const summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const location = get('LOCATION').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const dtstart = get('DTSTART');
    const dtstartFull = getWithParams('DTSTART');
    const dtendFull = getWithParams('DTEND');
    if (!dtstart) continue;
    // Parse iCal date: 20260210T150000Z or 20260210 (all-day)
    const allDay = dtstart.length === 8;
    // Map Windows/iCal TZID names to UTC offset (hours). Covers common zones.
    const tzOffsets = {
      'eastern standard time': -5, 'eastern daylight time': -4, 'us/eastern': -5, 'america/new_york': -5,
      'central standard time': -6, 'central daylight time': -5, 'us/central': -6, 'america/chicago': -6,
      'central america standard time': -6,
      'mountain standard time': -7, 'mountain daylight time': -6, 'us/mountain': -7, 'america/denver': -7,
      'pacific standard time': -8, 'pacific daylight time': -7, 'us/pacific': -8, 'america/los_angeles': -8,
      'pacific standard time (mexico)': -8,
      'india standard time': 5.5, 'asia/kolkata': 5.5,
      'sri lanka standard time': 5.5,
      'singapore standard time': 8, 'asia/singapore': 8,
      'china standard time': 8, 'asia/shanghai': 8,
      'tokyo standard time': 9, 'asia/tokyo': 9,
      'e. africa standard time': 3,
      'romance standard time': 1,
      'gmt standard time': 0, 'utc': 0, 'gmt': 0,
      'w. europe standard time': 1, 'europe/berlin': 1, 'europe/paris': 1,
    };
    const parseIcalDate = (s, params) => {
      if (!s) return null;
      if (s.length === 8) return new Date(s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8) + 'T00:00:00');
      // 20260210T150000Z or 20260210T150000
      const d = s.replace(/Z$/, '');
      const iso = d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8) + 'T' + d.slice(9,11) + ':' + d.slice(11,13) + ':' + d.slice(13,15);
      if (s.endsWith('Z')) return new Date(iso + 'Z');
      // Check for TZID parameter
      const tzMatch = (params || '').match(/TZID=([^;:]+)/i);
      if (tzMatch) {
        const tzName = tzMatch[1].trim().toLowerCase();
        const offsetHours = tzOffsets[tzName];
        if (offsetHours !== undefined) {
          // Convert from source timezone to UTC by appending the UTC offset
          const sign = offsetHours >= 0 ? '+' : '-';
          const absH = Math.floor(Math.abs(offsetHours));
          const absM = Math.round((Math.abs(offsetHours) - absH) * 60);
          const offsetStr = sign + String(absH).padStart(2, '0') + ':' + String(absM).padStart(2, '0');
          return new Date(iso + offsetStr);
        }
      }
      // No timezone info — treat as local
      return new Date(iso);
    };
    const start = parseIcalDate(dtstart, dtstartFull.params);
    const end = parseIcalDate(dtendFull.value, dtendFull.params);
    if (!start || isNaN(start.getTime())) continue;
    // Only future events (for all-day, include today)
    const cutoff = allDay ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : now;
    if (start < cutoff && (!end || end < cutoff)) continue;
    events.push({ summary: summary || 'Untitled', start: start.toISOString(), end: end ? end.toISOString() : null, location: location || null, allDay });
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events.slice(0, maxEvents);
}

// ─────────────────────────────────────────────
// AI Usage Providers - Read local credentials and fetch usage
// ─────────────────────────────────────────────

const AI_PROVIDERS = {
  claude: {
    name: 'Claude Code',
    icon: '🟣',
    credPaths: [
      path.join(os.homedir(), '.claude', '.credentials.json'),
    ],
    keychainService: 'Claude Code-credentials',
  },
  codex: {
    name: 'Codex CLI',
    icon: '🟢',
    credPaths: [
      process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, 'auth.json') : null,
      path.join(os.homedir(), '.config', 'codex', 'auth.json'),
      path.join(os.homedir(), '.codex', 'auth.json'),
    ].filter(Boolean),
    keychainService: 'Codex Auth',
  },
  copilot: {
    name: 'GitHub Copilot',
    icon: '⚫',
    keychainService: 'gh:github.com',
  },
  cursor: {
    name: 'Cursor',
    icon: '🔵',
    sqlitePath: path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  },
  gemini: {
    name: 'Gemini',
    icon: '🔷',
    credPaths: [
      path.join(os.homedir(), '.gemini', 'oauth_creds.json'),
    ],
    settingsPath: path.join(os.homedir(), '.gemini', 'settings.json'),
  },
  amp: {
    name: 'Amp',
    icon: '⚡',
    credPaths: [
      path.join(os.homedir(), '.local', 'share', 'amp', 'secrets.json'),
    ],
  },
  factory: {
    name: 'Factory',
    icon: '🏭',
    credPaths: [
      path.join(os.homedir(), '.factory', 'auth.json'),
    ],
  },
  kimi: {
    name: 'Kimi Code',
    icon: '🌙',
    credPaths: [
      path.join(os.homedir(), '.kimi', 'credentials', 'kimi-code.json'),
    ],
  },
  jetbrains: {
    name: 'JetBrains AI',
    icon: '🧠',
    configDirs: [
      path.join(os.homedir(), 'Library', 'Application Support', 'JetBrains'),
    ],
  },
  minimax: {
    name: 'MiniMax',
    icon: '🔶',
    envKeys: ['MINIMAX_API_KEY', 'MINIMAX_CN_API_KEY', 'MINIMAX_API_TOKEN'],
  },
  zai: {
    name: 'Z.ai',
    icon: '🇿',
    envKeys: ['ZAI_API_KEY', 'GLM_API_KEY'],
  },
  antigravity: {
    name: 'Antigravity',
    icon: '🪐',
    configPath: path.join(os.homedir(), 'Library', 'Application Support', 'antigravity-usage', 'config.json'),
    accountsDir: path.join(os.homedir(), 'Library', 'Application Support', 'antigravity-usage', 'accounts'),
    // OAuth credentials from env vars (get from antigravity-usage or Google Cloud Console)
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiUrl: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  },
};

// Try to read credentials from file paths, then keychain (macOS)
function readCredentials(provider) {
  const config = AI_PROVIDERS[provider];
  if (!config) return null;
  
  // Try file paths first
  for (const credPath of config.credPaths) {
    try {
      if (fs.existsSync(credPath)) {
        const content = fs.readFileSync(credPath, 'utf8');
        return { source: 'file', path: credPath, data: JSON.parse(content) };
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // Try macOS keychain (may have multiple entries with different accounts)
  if (process.platform === 'darwin' && config.keychainService) {
    const { execSync } = require('child_process');
    const accounts = [process.env.USER, os.userInfo().username, 'Claude Code', ''].filter(Boolean);
    
    for (const account of accounts) {
      try {
        const accountArg = account ? `-a "${account}"` : '';
        const keychainData = execSync(
          `security find-generic-password -s "${config.keychainService}" ${accountArg} -w 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (keychainData) {
          const parsed = JSON.parse(keychainData);
          // Check if this token is valid (not expired)
          const oauth = parsed.claudeAiOauth || parsed;
          if (oauth.expiresAt && oauth.expiresAt > Date.now()) {
            return { source: 'keychain', service: config.keychainService, account, data: parsed };
          }
          // If no expiry or expired, keep looking but save as fallback
          if (!config._fallbackCreds) {
            config._fallbackCreds = { source: 'keychain', service: config.keychainService, account, data: parsed };
          }
        }
      } catch (e) {
        // Try next account
      }
    }
    // Return fallback if we found expired creds but nothing valid
    if (config._fallbackCreds) {
      const result = config._fallbackCreds;
      delete config._fallbackCreds;
      return result;
    }
  }
  
  return null;
}

// Fetch Claude usage
async function fetchClaudeUsage() {
  const baseInfo = {
    provider: 'claude',
    name: AI_PROVIDERS.claude.name,
    icon: AI_PROVIDERS.claude.icon,
  };
  
  const creds = readCredentials('claude');
  if (!creds) return { ...baseInfo, error: 'Not logged in. Run `claude` to authenticate.' };
  
  const oauthData = creds.data.claudeAiOauth;
  if (!oauthData?.accessToken) return { ...baseInfo, error: 'No access token found.' };
  
  let accessToken = oauthData.accessToken;
  
  // Helper to make the API request
  async function makeRequest(token) {
    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/1.0.0',
        'X-Client-Name': 'claude-code',
      },
    });
    return resp;
  }
  
  // Try with current token first
  let resp = await makeRequest(accessToken);
  
  // If unauthorized, try to refresh
  if (resp.status === 401 || resp.status === 403) {
    if (!oauthData.refreshToken) {
      return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
    }
    try {
      const refreshed = await refreshClaudeToken(oauthData.refreshToken, creds.source === 'file' ? creds.path : null);
      if (refreshed.error) {
        return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
      }
      accessToken = refreshed.accessToken;
      resp = await makeRequest(accessToken);
    } catch (e) {
      return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
    }
  }
  
  try {
    if (!resp.ok) {
      if (resp.status === 429) {
        return { ...baseInfo, error: '429 rate limited - using cache' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    
    // Normalize response
    const metrics = [];
    
    if (data.five_hour) {
      metrics.push({
        label: 'Session (5h)',
        used: data.five_hour.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.five_hour.resets_at,
      });
    }
    
    if (data.seven_day) {
      metrics.push({
        label: 'Weekly',
        used: data.seven_day.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.seven_day.resets_at,
      });
    }
    
    if (data.seven_day_opus) {
      metrics.push({
        label: 'Opus Weekly',
        used: data.seven_day_opus.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.seven_day_opus.resets_at,
      });
    }
    
    if (data.extra_usage?.is_enabled) {
      metrics.push({
        label: 'Extra Credits',
        used: data.extra_usage.used_credits / 100,
        limit: data.extra_usage.monthly_limit ? data.extra_usage.monthly_limit / 100 : null,
        format: 'dollars',
      });
    }
    
    return {
      provider: 'claude',
      name: AI_PROVIDERS.claude.name,
      icon: AI_PROVIDERS.claude.icon,
      plan: oauthData.subscriptionType || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Refresh Claude token
async function refreshClaudeToken(refreshToken, credPath) {
  try {
    const resp = await fetch('https://platform.claude.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
        scope: 'user:profile user:inference user:sessions:claude_code user:mcp_servers',
      }),
    });
    
    if (!resp.ok) return { error: 'Refresh failed (HTTP ' + resp.status + ')' };
    
    const data = await resp.json();
    
    // Update credentials file
    if (credPath && fs.existsSync(credPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        existing.claudeAiOauth.accessToken = data.access_token;
        if (data.refresh_token) existing.claudeAiOauth.refreshToken = data.refresh_token;
        existing.claudeAiOauth.expiresAt = Date.now() + (data.expires_in * 1000);
        fs.writeFileSync(credPath, JSON.stringify(existing, null, 2));
      } catch (e) {
        // Non-fatal: token still works for this request
      }
    }
    
    return { accessToken: data.access_token };
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch Codex usage
async function fetchCodexUsage() {
  const baseInfo = {
    provider: 'codex',
    name: AI_PROVIDERS.codex.name,
    icon: AI_PROVIDERS.codex.icon,
  };
  
  const creds = readCredentials('codex');
  if (!creds) return { ...baseInfo, error: 'Not logged in. Run `codex auth` to authenticate.' };
  
  const tokens = creds.data.tokens;
  if (!tokens?.access_token) return { ...baseInfo, error: 'No access token found.' };
  
  try {
    const headers = {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    };
    if (tokens.account_id) {
      headers['ChatGPT-Account-Id'] = tokens.account_id;
    }
    
    const resp = await fetch('https://chatgpt.com/backend-api/wham/usage', { headers });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Run `codex auth` to re-authenticate.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    
    // Normalize response
    const metrics = [];
    
    if (data.rate_limit?.primary_window) {
      const pw = data.rate_limit.primary_window;
      metrics.push({
        label: 'Session (5h)',
        used: pw.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: pw.reset_at ? new Date(pw.reset_at * 1000).toISOString() : null,
      });
    }
    
    if (data.rate_limit?.secondary_window) {
      const sw = data.rate_limit.secondary_window;
      metrics.push({
        label: 'Weekly',
        used: sw.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: sw.reset_at ? new Date(sw.reset_at * 1000).toISOString() : null,
      });
    }
    
    if (data.code_review_rate_limit?.primary_window) {
      const cr = data.code_review_rate_limit.primary_window;
      metrics.push({
        label: 'Code Reviews',
        used: cr.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: cr.reset_at ? new Date(cr.reset_at * 1000).toISOString() : null,
      });
    }
    
    if (data.credits?.has_credits) {
      metrics.push({
        label: 'Credits',
        used: null,
        remaining: data.credits.balance,
        format: 'dollars',
        unlimited: data.credits.unlimited,
      });
    }
    
    return {
      provider: 'codex',
      name: AI_PROVIDERS.codex.name,
      icon: AI_PROVIDERS.codex.icon,
      plan: data.plan_type || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Fetch GitHub Copilot usage
async function fetchCopilotUsage() {
  const baseInfo = {
    provider: 'copilot',
    name: AI_PROVIDERS.copilot.name,
    icon: AI_PROVIDERS.copilot.icon,
  };
  
  // Try to get token from gh CLI keychain
  let token = null;
  if (process.platform === 'darwin') {
    try {
      const { execSync } = require('child_process');
      token = execSync('security find-generic-password -s "gh:github.com" -w 2>/dev/null', 
        { encoding: 'utf8', timeout: 5000 }).trim();
    } catch (e) {}
  }
  
  if (!token) {
    return { ...baseInfo, error: 'Not logged in. Run `gh auth login` first.' };
  }
  
  try {
    const resp = await fetch('https://api.github.com/copilot_internal/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/json',
        'Editor-Version': 'vscode/1.96.2',
        'Editor-Plugin-Version': 'copilot-chat/0.26.7',
        'User-Agent': 'GitHubCopilotChat/0.26.7',
        'X-Github-Api-Version': '2025-04-01',
      },
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Token invalid. Run `gh auth login` to re-auth.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    // Paid tier
    if (data.quota_snapshots) {
      if (data.quota_snapshots.premium_interactions) {
        const p = data.quota_snapshots.premium_interactions;
        metrics.push({
          label: 'Premium',
          used: 100 - p.percent_remaining,
          limit: 100,
          format: 'percent',
          resetsAt: data.quota_reset_date,
        });
      }
      if (data.quota_snapshots.chat) {
        const c = data.quota_snapshots.chat;
        metrics.push({
          label: 'Chat',
          used: 100 - c.percent_remaining,
          limit: 100,
          format: 'percent',
          resetsAt: data.quota_reset_date,
        });
      }
    }
    
    // Free tier
    if (data.limited_user_quotas && data.monthly_quotas) {
      const chatUsed = data.monthly_quotas.chat - data.limited_user_quotas.chat;
      const compUsed = data.monthly_quotas.completions - data.limited_user_quotas.completions;
      metrics.push({
        label: 'Chat',
        used: (chatUsed / data.monthly_quotas.chat) * 100,
        limit: 100,
        format: 'percent',
        resetsAt: data.limited_user_reset_date,
      });
      metrics.push({
        label: 'Completions',
        used: (compUsed / data.monthly_quotas.completions) * 100,
        limit: 100,
        format: 'percent',
        resetsAt: data.limited_user_reset_date,
      });
    }
    
    return {
      ...baseInfo,
      plan: data.copilot_plan || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Fetch Cursor usage
async function fetchCursorUsage() {
  const baseInfo = {
    provider: 'cursor',
    name: AI_PROVIDERS.cursor.name,
    icon: AI_PROVIDERS.cursor.icon,
  };
  
  const dbPath = AI_PROVIDERS.cursor.sqlitePath;
  if (!fs.existsSync(dbPath)) {
    return { ...baseInfo, error: 'Cursor not installed.' };
  }
  
  // Read token from SQLite
  let accessToken = null;
  let membershipType = null;
  try {
    const { execSync } = require('child_process');
    accessToken = execSync(`sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }).trim();
    membershipType = execSync(`sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'cursorAuth/stripeMembershipType'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e) {}
  
  if (!accessToken) {
    return { ...baseInfo, error: 'Not logged in. Sign in to Cursor.' };
  }
  
  try {
    const resp = await fetch('https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
      },
      body: '{}',
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Re-sign in to Cursor.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    if (data.planUsage) {
      const pu = data.planUsage;
      if (typeof pu.totalPercentUsed === 'number' && isFinite(pu.totalPercentUsed)) {
        metrics.push({
          label: 'Total Usage',
          used: pu.totalPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
      if (typeof pu.autoPercentUsed === 'number' && isFinite(pu.autoPercentUsed)) {
        metrics.push({
          label: 'Auto',
          used: pu.autoPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
      if (typeof pu.apiPercentUsed === 'number' && isFinite(pu.apiPercentUsed)) {
        metrics.push({
          label: 'API',
          used: pu.apiPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
    }
    
    return {
      ...baseInfo,
      plan: membershipType || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Fetch Gemini usage
async function fetchGeminiUsage() {
  const baseInfo = {
    provider: 'gemini',
    name: AI_PROVIDERS.gemini.name,
    icon: AI_PROVIDERS.gemini.icon,
  };
  
  const credsPath = AI_PROVIDERS.gemini.credPaths[0];
  if (!fs.existsSync(credsPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `gemini auth` first.' };
  }
  
  let creds;
  try {
    creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch (e) {
    return { ...baseInfo, error: 'Invalid credentials file.' };
  }
  
  if (!creds.access_token) {
    return { ...baseInfo, error: 'No access token found.' };
  }
  
  try {
    // Get user quota
    const resp = await fetch('https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Run `gemini auth` to re-auth.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    // Parse quota buckets (API returns 'buckets' with 'remainingFraction')
    const buckets = data.buckets || data.quotaBuckets || [];
    
    // Track all non-Vertex Gemini request buckets instead of a hardcoded
    // 2.x allowlist so new Gemini CLI quota windows surface automatically.
    const seen = new Set();
    
    for (const bucket of buckets) {
      if (bucket.tokenType !== 'REQUESTS') continue;
      // Skip vertex variants
      if (bucket.modelId?.includes('_vertex')) continue;
      // Only show Gemini model buckets
      if (!bucket.modelId?.startsWith('gemini-')) continue;
      // Dedupe
      if (seen.has(bucket.modelId)) continue;
      seen.add(bucket.modelId);
      
      const remaining = bucket.remainingFraction ?? 1;
      metrics.push({
        label: bucket.modelId || 'Quota',
        used: Math.round((1 - remaining) * 100),
        limit: 100,
        format: 'percent',
        resetTime: bucket.resetTime,
      });
    }
    
    metrics.sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));

    return {
      ...baseInfo,
      plan: 'Gemini CLI',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Fetch Amp usage
async function fetchAmpUsage() {
  const baseInfo = {
    provider: 'amp',
    name: AI_PROVIDERS.amp.name,
    icon: AI_PROVIDERS.amp.icon,
  };
  
  const secretsPath = AI_PROVIDERS.amp.credPaths[0];
  if (!fs.existsSync(secretsPath)) {
    return { ...baseInfo, error: 'Amp not installed. Install Amp Code to get started.' };
  }
  
  let secrets;
  try {
    secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  } catch (e) {
    return { ...baseInfo, error: 'Invalid secrets file.' };
  }
  
  const apiKey = secrets['apiKey@https://ampcode.com/'];
  if (!apiKey) {
    return { ...baseInfo, error: 'Not logged in. Sign in to Amp Code.' };
  }
  
  try {
    const resp = await fetch('https://ampcode.com/api/internal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'userDisplayBalanceInfo', params: {} }),
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Re-authenticate in Amp Code.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    // Parse displayText for usage info
    const displayText = data.result?.displayText || data.displayText || '';
    
    // Free tier: "$X/$Y remaining"
    const freeMatch = displayText.match(/\$(\d+(?:\.\d+)?)\s*\/\s*\$(\d+(?:\.\d+)?)\s+remaining/i);
    if (freeMatch) {
      const remaining = parseFloat(freeMatch[1]);
      const total = parseFloat(freeMatch[2]);
      const used = total - remaining;
      metrics.push({
        label: 'Free',
        used: (used / total) * 100,
        limit: 100,
        format: 'percent',
      });
    }
    
    // Credits: "Individual credits: $X remaining"
    const creditsMatch = displayText.match(/Individual credits:\s*\$(\d+(?:\.\d+)?)/i);
    if (creditsMatch) {
      metrics.push({
        label: 'Credits',
        used: null,
        remaining: parseFloat(creditsMatch[1]),
        format: 'dollars',
      });
    }
    
    return {
      ...baseInfo,
      plan: freeMatch ? 'Free' : (creditsMatch ? 'Credits' : 'unknown'),
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Fetch Factory (Droid) usage
async function fetchFactoryUsage() {
  const baseInfo = { provider: 'factory', name: AI_PROVIDERS.factory.name, icon: AI_PROVIDERS.factory.icon };
  const authPath = AI_PROVIDERS.factory.credPaths[0];
  
  if (!fs.existsSync(authPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `droid` to authenticate.' };
  }
  
  let auth;
  try { auth = JSON.parse(fs.readFileSync(authPath, 'utf8')); } 
  catch (e) { return { ...baseInfo, error: 'Invalid auth file.' }; }
  
  if (!auth.access_token) return { ...baseInfo, error: 'No access token found.' };
  
  try {
    const resp = await fetch('https://api.factory.ai/api/organization/subscription/usage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCache: true }),
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Session expired. Run `droid` to re-auth.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    if (data.usage?.standard) {
      const s = data.usage.standard;
      metrics.push({ label: 'Standard', used: (s.usedRatio || 0) * 100, limit: 100, format: 'percent' });
    }
    if (data.usage?.premium?.totalAllowance > 0) {
      const p = data.usage.premium;
      metrics.push({ label: 'Premium', used: (p.usedRatio || 0) * 100, limit: 100, format: 'percent' });
    }
    
    const allowance = data.usage?.standard?.totalAllowance || 0;
    const plan = allowance >= 200000000 ? 'Max' : allowance >= 20000000 ? 'Pro' : 'Basic';
    
    return { ...baseInfo, plan, metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

// Fetch Kimi Code usage
async function fetchKimiUsage() {
  const baseInfo = { provider: 'kimi', name: AI_PROVIDERS.kimi.name, icon: AI_PROVIDERS.kimi.icon };
  const credPath = AI_PROVIDERS.kimi.credPaths[0];
  
  if (!fs.existsSync(credPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `kimi login` first.' };
  }
  
  let creds;
  try { creds = JSON.parse(fs.readFileSync(credPath, 'utf8')); }
  catch (e) { return { ...baseInfo, error: 'Invalid credentials file.' }; }
  
  if (!creds.access_token) return { ...baseInfo, error: 'No access token found.' };
  
  try {
    const resp = await fetch('https://api.kimi.com/coding/v1/usages', {
      headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' },
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Session expired. Run `kimi login` to re-auth.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    const metrics = [];
    
    if (data.usage) {
      const used = parseInt(data.usage.limit) - parseInt(data.usage.remaining);
      const total = parseInt(data.usage.limit);
      metrics.push({ label: 'Session', used: (used / total) * 100, limit: 100, format: 'percent', resetsAt: data.usage.resetTime });
    }
    
    const plan = data.user?.membership?.level?.replace('LEVEL_', '') || 'unknown';
    return { ...baseInfo, plan, metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

// Fetch JetBrains AI usage
async function fetchJetbrainsUsage() {
  const baseInfo = { provider: 'jetbrains', name: AI_PROVIDERS.jetbrains.name, icon: AI_PROVIDERS.jetbrains.icon };
  const configDir = AI_PROVIDERS.jetbrains.configDirs[0];
  
  if (!fs.existsSync(configDir)) {
    return { ...baseInfo, error: 'JetBrains IDE not detected.' };
  }
  
  // Find latest IDE config with quota file
  let quotaData = null;
  try {
    const dirs = fs.readdirSync(configDir).filter(d => !d.startsWith('.'));
    for (const dir of dirs.sort().reverse()) {
      const quotaPath = path.join(configDir, dir, 'options', 'AIAssistantQuotaManager2.xml');
      if (fs.existsSync(quotaPath)) {
        const content = fs.readFileSync(quotaPath, 'utf8');
        // Simple XML parsing for quota values
        const currentMatch = content.match(/<option name="current" value="(\d+)"/);
        const maxMatch = content.match(/<option name="maximum" value="(\d+)"/);
        if (currentMatch && maxMatch) {
          quotaData = { current: parseInt(currentMatch[1]), maximum: parseInt(maxMatch[1]) };
          break;
        }
      }
    }
  } catch (e) { /* ignore */ }
  
  if (!quotaData) {
    return { ...baseInfo, error: 'JetBrains AI quota not found. Open AI Assistant in IDE.' };
  }
  
  const used = (quotaData.current / quotaData.maximum) * 100;
  return { ...baseInfo, plan: 'AI Assistant', metrics: [{ label: 'Quota', used, limit: 100, format: 'percent' }] };
}

// Fetch MiniMax usage
async function fetchMinimaxUsage() {
  const baseInfo = { provider: 'minimax', name: AI_PROVIDERS.minimax.name, icon: AI_PROVIDERS.minimax.icon };
  
  const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_CN_API_KEY || process.env.MINIMAX_API_TOKEN;
  if (!apiKey) {
    return { ...baseInfo, error: 'Set MINIMAX_API_KEY environment variable.' };
  }
  
  try {
    const resp = await fetch('https://api.minimax.io/v1/api/openplatform/coding_plan/remains', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Invalid API key.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    if (data.base_resp?.status_code !== 0) {
      return { ...baseInfo, error: data.base_resp?.status_msg || 'API error' };
    }
    
    const metrics = [];
    const model = data.model_remains?.[0];
    if (model) {
      const total = model.current_interval_total_count || 100;
      const remaining = model.current_interval_usage_count || model.current_interval_remaining_count || 0;
      const used = ((total - remaining) / total) * 100;
      metrics.push({ label: 'Session', used, limit: 100, format: 'percent' });
    }
    
    return { ...baseInfo, plan: data.current_subscribe_title || 'MiniMax', metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

// Fetch Z.ai usage
async function fetchZaiUsage() {
  const baseInfo = { provider: 'zai', name: AI_PROVIDERS.zai.name, icon: AI_PROVIDERS.zai.icon };
  
  const apiKey = process.env.ZAI_API_KEY || process.env.GLM_API_KEY;
  if (!apiKey) {
    return { ...baseInfo, error: 'Set ZAI_API_KEY environment variable.' };
  }
  
  try {
    const resp = await fetch('https://api.z.ai/api/monitor/usage/quota/limit', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Invalid API key.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }
    
    const data = await resp.json();
    if (data.code !== 200) {
      return { ...baseInfo, error: data.message || 'API error' };
    }
    
    const metrics = [];
    for (const limit of (data.data?.limits || [])) {
      if (limit.type === 'TOKENS_LIMIT') {
        metrics.push({ label: 'Session', used: limit.percentage || 0, limit: 100, format: 'percent' });
      } else if (limit.type === 'TIME_LIMIT') {
        metrics.push({ label: 'Weekly', used: limit.percentage || 0, limit: 100, format: 'percent' });
      }
    }
    
    return { ...baseInfo, plan: 'GLM Coding', metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

async function fetchAntigravityUsage() {
  const baseInfo = { provider: 'antigravity', name: AI_PROVIDERS.antigravity.name, icon: AI_PROVIDERS.antigravity.icon };
  const config = AI_PROVIDERS.antigravity;
  
  // Read config to get active account
  let activeAccount;
  try {
    const configData = JSON.parse(fs.readFileSync(config.configPath, 'utf8'));
    activeAccount = configData.activeAccount;
  } catch (_) {
    return { ...baseInfo, error: 'Run: antigravity-usage login' };
  }
  
  if (!activeAccount) {
    return { ...baseInfo, error: 'No active account configured.' };
  }
  
  // Read tokens for active account
  const tokensPath = path.join(config.accountsDir, activeAccount, 'tokens.json');
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  } catch (_) {
    return { ...baseInfo, error: 'Token file not found for ' + activeAccount };
  }
  
  // Refresh token if expired
  let accessToken = tokens.accessToken;
  if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
    // Need OAuth credentials from env vars for token refresh
    const clientId = process.env.ANTIGRAVITY_CLIENT_ID;
    const clientSecret = process.env.ANTIGRAVITY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return { ...baseInfo, error: 'Token expired. Run `antigravity-usage` to refresh, or set ANTIGRAVITY_CLIENT_ID/SECRET env vars.' };
    }
    
    try {
      const refreshResp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!refreshResp.ok) {
        return { ...baseInfo, error: 'Token refresh failed (HTTP ' + refreshResp.status + ')' };
      }
      const refreshData = await refreshResp.json();
      accessToken = refreshData.access_token;
      // Update stored tokens
      tokens.accessToken = accessToken;
      tokens.expiresAt = Date.now() + (refreshData.expires_in * 1000);
      try { fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2)); } catch (_) {}
    } catch (e) {
      return { ...baseInfo, error: 'Token refresh error: ' + e.message };
    }
  }
  
  // Fetch available models with quota info
  try {
    const resp = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity',
      },
      body: JSON.stringify({ project: tokens.projectId }),
    });
    
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Auth failed. Re-run: antigravity-usage login' };
      if (resp.status === 429) return { ...baseInfo, error: 'Rate limited. Try again later.' };
      return { ...baseInfo, error: 'API error (HTTP ' + resp.status + ')' };
    }
    
    const data = await resp.json();
    const models = data.models || {};
    
    // Build metrics from model quotas
    const metrics = [];
    const interestingModels = ['gemini-3-pro-high', 'gemini-3-pro-low', 'claude-sonnet-4-6', 'claude-opus-4-6-thinking'];
    
    for (const modelId of interestingModels) {
      const model = models[modelId];
      if (model && model.quotaInfo) {
        const remaining = model.quotaInfo.remainingFraction ?? 1;
        metrics.push({
          label: model.displayName || modelId,
          used: Math.round((1 - remaining) * 100),
          limit: 100,
          format: 'percent',
          resetTime: model.quotaInfo.resetTime,
        });
      }
    }
    
    // If no interesting models found, show first few available
    if (metrics.length === 0) {
      for (const [modelId, model] of Object.entries(models).slice(0, 4)) {
        if (model.quotaInfo) {
          const remaining = model.quotaInfo.remainingFraction ?? 1;
          metrics.push({
            label: model.displayName || modelId,
            used: Math.round((1 - remaining) * 100),
            limit: 100,
            format: 'percent',
          });
        }
      }
    }
    
    return { ...baseInfo, plan: activeAccount, metrics };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

// Cache for AI usage data (avoid 429 rate limits)
// In-memory cache
const aiUsageCache = {
  claude: { data: null, timestamp: 0 },
  codex: { data: null, timestamp: 0 },
  copilot: { data: null, timestamp: 0 },
  cursor: { data: null, timestamp: 0 },
  gemini: { data: null, timestamp: 0 },
  factory: { data: null, timestamp: 0 },
  kimi: { data: null, timestamp: 0 },
  jetbrains: { data: null, timestamp: 0 },
  minimax: { data: null, timestamp: 0 },
  zai: { data: null, timestamp: 0 },
  amp: { data: null, timestamp: 0 },
  antigravity: { data: null, timestamp: 0 },
};
const AI_CACHE_TTL_MS = 300000; // 5 minutes cache

// Persistent file cache (survives restarts)
const AI_CACHE_FILE = path.join(CWD, 'data', 'ai-usage-cache.json');

function loadPersistentCache() {
  try {
    if (fs.existsSync(AI_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(AI_CACHE_FILE, 'utf8'));
      for (const [provider, entry] of Object.entries(data)) {
        if (aiUsageCache[provider] && entry.data) {
          aiUsageCache[provider] = entry;
        }
      }
      console.log('[AI Cache] Loaded persistent cache');
    }
  } catch (e) { /* ignore */ }
}

function savePersistentCache() {
  try {
    fs.mkdirSync(path.dirname(AI_CACHE_FILE), { recursive: true });
    fs.writeFileSync(AI_CACHE_FILE, JSON.stringify(aiUsageCache, null, 2));
  } catch (e) { /* ignore */ }
}

// Load cache on startup
loadPersistentCache();

// Cached fetch wrapper
async function fetchWithCache(provider, fetchFn) {
  const cache = aiUsageCache[provider];
  const now = Date.now();
  
  // Return cached data if fresh
  if (cache.data && (now - cache.timestamp) < AI_CACHE_TTL_MS) {
    return { ...cache.data, cached: true };
  }
  
  // Fetch fresh data
  const result = await fetchFn();
  
  // Only cache successful results (not errors)
  if (!result.error) {
    cache.data = result;
    cache.timestamp = now;
    savePersistentCache(); // Persist to disk
  } else if (result.error.includes('429') || result.error.includes('rate')) {
    // On rate limit, return stale cache if available
    if (cache.data) {
      return { ...cache.data, cached: true, stale: true, rateLimited: true };
    }
  }
  
  return result;
}

// Get all AI usage data
async function getAllAiUsage(options = {}) {
  const results = await Promise.all([
    fetchWithCache('claude', fetchClaudeUsage),
    fetchWithCache('codex', fetchCodexUsage),
    fetchWithCache('copilot', fetchCopilotUsage),
    fetchWithCache('cursor', fetchCursorUsage),
    fetchWithCache('gemini', fetchGeminiUsage),
    fetchWithCache('amp', fetchAmpUsage),
    fetchWithCache('factory', fetchFactoryUsage),
    fetchWithCache('kimi', fetchKimiUsage),
    fetchWithCache('jetbrains', fetchJetbrainsUsage),
    fetchWithCache('minimax', fetchMinimaxUsage),
    fetchWithCache('zai', fetchZaiUsage),
    fetchWithCache('antigravity', fetchAntigravityUsage),
  ]);
  
  return {
    providers: results,
    timestamp: new Date().toISOString(),
  };
}

// GET /api/latest-image?dir=<path> - newest image from a directory
function latestImageHandler(parsedUrl, res) {
  const dir = parsedUrl.searchParams.get('dir');
  if (!dir) return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Missing dir parameter' }));
  const resolved = path.resolve(dir.replace(/^~/, os.homedir()));
  const home = os.homedir();
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Directory must be under home' }));
  }
  try {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const files = fs.readdirSync(resolved)
      .filter(f => imageExts.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(resolved, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', image: null, message: 'No images found' }));
    const latest = files[0];
    const ext = path.extname(latest.name).toLowerCase().replace('.', '');
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = fs.readFileSync(path.join(resolved, latest.name));
    const b64 = data.toString('base64');
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', image: { name: latest.name, mtime: latest.mtime, dataUrl: `data:${mime};base64,${b64}` }, total: files.length }));
  } catch (error) { 
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: error.message })); 
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // ── Auth: serve login page (always accessible) ──
  if (req.method === 'GET' && pathname === '/login') {
    const loginPath = path.join(__dirname, 'login.html');
    fs.readFile(loginPath, (err, data) => {
      if (err) { sendResponse(res, 404, 'text/plain', 'Login page not found'); return; }
      sendResponse(res, 200, 'text/html', data);
    });
    return;
  }

  // ── Auth: login action ──
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (!DASHBOARD_PASSWORD) {
      sendJson(res, 200, { status: 'ok', redirect: '/' });
      return;
    }
    const ip = req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      sendJson(res, 429, { error: 'Too many failed attempts. Try again in 15 minutes.' });
      return;
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
    return;
  }

  // ── Auth: logout ──
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getSessionCookie(req);
    if (token) sessions.delete(token);
    res.writeHead(302, {
      'Set-Cookie': 'lb_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      'Location': '/login'
    });
    res.end();
    return;
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

  // ─────────────────────────────────────────────
  // Server Profiles API (for remote LobsterBoard Agent connections)
  // ─────────────────────────────────────────────
  const SERVERS_FILE = path.join(CWD, 'data', 'servers.json');
  
  function loadServers() {
    try {
      if (fs.existsSync(SERVERS_FILE)) {
        return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      }
    } catch (e) { /* ignore */ }
    return [{ id: 'local', name: 'Local', type: 'local' }];
  }
  
  function saveServers(servers) {
    fs.mkdirSync(path.dirname(SERVERS_FILE), { recursive: true });
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
  }

  // GET /api/servers - List all servers
  if (req.method === 'GET' && pathname === '/api/servers') {
    const servers = loadServers();
    // Mask API keys and secrets for security
    const masked = servers.map(s => ({
      ...s,
      apiKey: s.apiKey ? s.apiKey.slice(0, 10) + '...' : undefined,
      sharedSecret: s.sharedSecret ? '🔐' : undefined, // Just indicate presence
    }));
    sendJson(res, 200, { servers: masked });
    return;
  }

  // POST /api/servers - Add a server
  if (req.method === 'POST' && pathname === '/api/servers') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { name, url, apiKey } = JSON.parse(body);
        if (!name || !url || !apiKey) {
          return sendJson(res, 400, { error: 'name, url, and apiKey required' });
        }
        const servers = loadServers();
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (servers.find(s => s.id === id)) {
          return sendJson(res, 400, { error: 'Server with this name already exists' });
        }
        
        // Generate ECDH key pair for encrypted communication
        const keyPair = generateEcdhKeyPair();
        
        // Perform handshake with agent
        let sharedSecret = null;
        let encrypted = false;
        try {
          const handshakeRes = await fetch(url + '/handshake', {
            method: 'POST',
            headers: { 
              'X-API-Key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              clientId: id, 
              publicKey: keyPair.publicKey,
            }),
            signal: AbortSignal.timeout(10000),
          });
          
          if (handshakeRes.ok) {
            const handshakeData = await handshakeRes.json();
            if (handshakeData.publicKey) {
              sharedSecret = deriveSharedSecret(keyPair.privateKey, handshakeData.publicKey);
              encrypted = true;
              console.log(`🔐 Encrypted connection established with server: ${name}`);
            }
          }
        } catch (e) {
          // Handshake failed - agent may not support encryption, continue without it
          console.log(`⚠️ Handshake failed for ${name}, using unencrypted: ${e.message}`);
        }
        
        const serverEntry = { 
          id, 
          name, 
          url, 
          apiKey, 
          type: 'remote',
          encrypted,
        };
        
        // Store shared secret (base64 encoded) if encryption is enabled
        if (sharedSecret) {
          serverEntry.sharedSecret = sharedSecret.toString('base64');
          serverEntry.clientId = id;
        }
        
        servers.push(serverEntry);
        saveServers(servers);
        sendJson(res, 200, { status: 'success', id, encrypted });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  // PUT /api/servers/:id - Update a server
  if (req.method === 'PUT' && pathname.startsWith('/api/servers/')) {
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const servers = loadServers();
        const idx = servers.findIndex(s => s.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Server not found' });
        if (id === 'local') return sendJson(res, 400, { error: 'Cannot modify local server' });
        servers[idx] = { ...servers[idx], ...updates, id }; // Don't allow id change
        saveServers(servers);
        sendJson(res, 200, { status: 'success' });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  // DELETE /api/servers/:id - Delete a server
  if (req.method === 'DELETE' && pathname.startsWith('/api/servers/')) {
    const id = pathname.split('/')[3];
    if (id === 'local') return sendJson(res, 400, { error: 'Cannot delete local server' });
    const servers = loadServers();
    const filtered = servers.filter(s => s.id !== id);
    if (filtered.length === servers.length) {
      return sendJson(res, 404, { error: 'Server not found' });
    }
    saveServers(filtered);
    sendJson(res, 200, { status: 'success' });
    return;
  }

  // POST /api/servers/:id/test - Test connection to a server
  if (req.method === 'POST' && pathname.match(/^\/api\/servers\/[^/]+\/test$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const server = servers.find(s => s.id === id);
    if (!server) return sendJson(res, 404, { error: 'Server not found' });
    if (server.type === 'local') {
      return sendJson(res, 200, { status: 'ok', message: 'Local server' });
    }
    // Test remote connection
    fetch(server.url + '/health', {
      headers: { 'X-API-Key': server.apiKey },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => sendJson(res, 200, { 
        status: 'ok', 
        serverName: data.serverName,
        agentEncryption: data.encrypted || false,
        localEncryption: server.encrypted || false,
      }))
      .catch(e => sendJson(res, 200, { status: 'error', message: e.message }));
    return;
  }

  // POST /api/servers/:id/handshake - Re-establish encryption with a server
  if (req.method === 'POST' && pathname.match(/^\/api\/servers\/[^/]+\/handshake$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const serverIdx = servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return sendJson(res, 404, { error: 'Server not found' });
    const server = servers[serverIdx];
    if (server.type === 'local') {
      return sendJson(res, 400, { error: 'Local server does not need handshake' });
    }

    (async () => {
      try {
        // Generate new key pair
        const keyPair = generateEcdhKeyPair();
        
        const handshakeRes = await fetch(server.url + '/handshake', {
          method: 'POST',
          headers: { 
            'X-API-Key': server.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            clientId: id, 
            publicKey: keyPair.publicKey,
          }),
          signal: AbortSignal.timeout(10000),
        });
        
        if (!handshakeRes.ok) {
          const err = await handshakeRes.json().catch(() => ({ error: 'HTTP ' + handshakeRes.status }));
          return sendJson(res, 500, { error: err.error || 'Handshake failed' });
        }
        
        const handshakeData = await handshakeRes.json();
        if (!handshakeData.publicKey) {
          return sendJson(res, 500, { error: 'Agent did not return public key' });
        }
        
        const sharedSecret = deriveSharedSecret(keyPair.privateKey, handshakeData.publicKey);
        
        // Update server config
        servers[serverIdx].encrypted = true;
        servers[serverIdx].sharedSecret = sharedSecret.toString('base64');
        servers[serverIdx].clientId = id;
        saveServers(servers);
        
        console.log(`🔐 Re-established encrypted connection with server: ${server.name}`);
        sendJson(res, 200, { status: 'ok', encrypted: true });
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
    })();
    return;
  }

  // GET /api/servers/:id/stats - Fetch stats from a remote server
  if (req.method === 'GET' && pathname.match(/^\/api\/servers\/[^/]+\/stats$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const server = servers.find(s => s.id === id);
    if (!server) return sendJson(res, 404, { error: 'Server not found' });
    if (server.type === 'local') {
      return sendJson(res, 400, { error: 'Use /api/stats/stream for local' });
    }
    
    // Build headers - include client ID if we have encryption set up
    const headers = { 'X-API-Key': server.apiKey };
    if (server.encrypted && server.clientId) {
      headers['X-Client-ID'] = server.clientId;
    }
    
    // Fetch from remote agent
    fetch(server.url + '/stats', {
      headers,
      signal: AbortSignal.timeout(10000),
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        // Decrypt if response is encrypted
        if (data.encrypted && server.sharedSecret) {
          try {
            const keyBuffer = Buffer.from(server.sharedSecret, 'base64');
            const decrypted = decryptPayload(data.encrypted, keyBuffer);
            decrypted._remote = true;
            decrypted._encrypted = true;
            return sendJson(res, 200, decrypted);
          } catch (e) {
            console.error('Decryption failed:', e.message);
            return sendJson(res, 500, { error: 'Decryption failed: ' + e.message });
          }
        }
        // Plain response (backward compatible)
        data._remote = true;
        sendJson(res, 200, data);
      })
      .catch(e => sendJson(res, 500, { error: e.message }));
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
        sendJson(res, 200, maskConfig(config));
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
        let config = JSON.parse(body);
        config = extractSecrets(config);
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

  // ── Security: PIN auth endpoints ──
  if (req.method === 'GET' && pathname === '/api/auth/status') {
    const auth = getAuth();
    sendJson(res, 200, { hasPin: !!auth.pinHash, publicMode: !!auth.publicMode });
    return;
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
        const auth = getAuth();
        // If PIN already set, require current PIN
        if (auth.pinHash && (!currentPin || hashPin(currentPin) !== auth.pinHash)) {
          sendJson(res, 403, { error: 'Current PIN is incorrect' }); return;
        }
        auth.pinHash = hashPin(pin);
        writeJsonFile(AUTH_FILE, auth);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/verify-pin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const auth = getAuth();
        if (!auth.pinHash) { sendJson(res, 200, { valid: true }); return; }
        const valid = hashPin(pin) === auth.pinHash;
        sendJson(res, 200, { valid });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/remove-pin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { pin } = JSON.parse(body);
        const auth = getAuth();
        if (auth.pinHash && hashPin(pin) !== auth.pinHash) {
          sendJson(res, 403, { error: 'PIN is incorrect' }); return;
        }
        delete auth.pinHash;
        writeJsonFile(AUTH_FILE, auth);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return;
  }

  // ── Security: Public mode ──
  if (req.method === 'GET' && pathname === '/api/mode') {
    const auth = getAuth();
    sendJson(res, 200, { publicMode: !!auth.publicMode });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/mode') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { publicMode, pin } = JSON.parse(body);
        const auth = getAuth();
        // Require PIN to toggle mode if PIN is set
        if (auth.pinHash && (!pin || hashPin(pin) !== auth.pinHash)) {
          sendJson(res, 403, { error: 'PIN required' }); return;
        }
        auth.publicMode = !!publicMode;
        writeJsonFile(AUTH_FILE, auth);
        sendJson(res, 200, { status: 'ok', publicMode: auth.publicMode });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return;
  }

  // ── Security: Secrets management ──
  if (req.method === 'POST' && pathname.match(/^\/api\/secrets\/[^/]+$/)) {
    if (isPublicMode()) { sendJson(res, 403, { error: 'Forbidden in public mode' }); return; }
    const widgetId = pathname.split('/')[3];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const secrets = getSecrets();
        if (!secrets[widgetId]) secrets[widgetId] = {};
        Object.assign(secrets[widgetId], updates);
        writeJsonFile(SECRETS_FILE, secrets);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message, 400); }
    });
    return;
  }

  if (req.method === 'DELETE' && pathname.match(/^\/api\/secrets\/[^/]+\/[^/]+$/)) {
    if (isPublicMode()) { sendJson(res, 403, { error: 'Forbidden in public mode' }); return; }
    const parts = pathname.split('/');
    const widgetId = parts[3];
    const key = parts[4];
    const secrets = getSecrets();
    if (secrets[widgetId]) {
      delete secrets[widgetId][key];
      if (Object.keys(secrets[widgetId]).length === 0) delete secrets[widgetId];
      writeJsonFile(SECRETS_FILE, secrets);
    }
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // ── Public mode guard: block edit-related APIs ──
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

  // ── Pages system routing ──
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
      // Security: ensure path is within one of the allowed page directories
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
      // Parse body for non-GET requests
      if (req.method === 'GET') {
        try {
          const result = await pageMatch.handler(req, res, { query: pageMatch.query, body: {}, params: pageMatch.params });
          if (result !== undefined && !res.writableEnded) sendJson(res, res.statusCode || 200, result);
        } catch (e) { sendError(res, e.message); }
        return;
      }
      // Parse JSON body
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

  // GET/POST /api/todos - Read/write todo list
  if (pathname === '/api/todos') {
    const todosFile = path.join(CWD, 'todos.json');
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

  // GET/POST /api/notes - Read/write notes content
  if (pathname === '/api/notes') {
    const notesFile = path.join(CWD, 'notes.json');
    if (req.method === 'GET') {
      fs.readFile(notesFile, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') return sendJson(res, 200, {});
          return sendError(res, err.message);
        }
        try { sendJson(res, 200, JSON.parse(data)); }
        catch (e) { sendJson(res, 200, {}); }
      });
      return;
    }
    if (req.method === 'POST') {
      const MAX_NOTES_BODY = 512 * 1024;
      let body = '';
      let overflow = false;
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > MAX_NOTES_BODY) { overflow = true; req.destroy(); }
      });
      req.on('end', () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        try {
          const notes = JSON.parse(body);
          fs.writeFile(notesFile, JSON.stringify(notes, null, 2), 'utf8', (err) => {
            if (err) return sendError(res, err.message);
            sendJson(res, 200, { status: 'ok' });
          });
        } catch (e) { sendError(res, 'Invalid JSON', 400); }
      });
      return;
    }
  }

  // GET /api/ai-usage - Fetch usage from all configured AI providers
  if (req.method === 'GET' && pathname === '/api/ai-usage') {
    try {
      const data = await getAllAiUsage();
      sendJson(res, 200, { status: 'ok', ...data });
    } catch (e) {
      sendError(res, e.message);
    }
    return;
  }

  // GET /api/ai-usage/:provider - Fetch usage from a specific provider
  const aiUsageMatch = pathname.match(/^\/api\/ai-usage\/(\w+)$/);
  if (req.method === 'GET' && aiUsageMatch) {
    const provider = aiUsageMatch[1];
    try {
      let data;
      switch (provider) {
        case 'claude':
          data = await fetchWithCache('claude', fetchClaudeUsage);
          break;
        case 'codex':
          data = await fetchWithCache('codex', fetchCodexUsage);
          break;
        case 'copilot':
          data = await fetchWithCache('copilot', fetchCopilotUsage);
          break;
        case 'cursor':
          data = await fetchWithCache('cursor', fetchCursorUsage);
          break;
        case 'gemini':
          data = await fetchWithCache('gemini', fetchGeminiUsage);
          break;
        case 'amp':
          data = await fetchWithCache('amp', fetchAmpUsage);
          break;
        case 'factory':
          data = await fetchWithCache('factory', fetchFactoryUsage);
          break;
        case 'kimi':
          data = await fetchWithCache('kimi', fetchKimiUsage);
          break;
        case 'jetbrains':
          data = await fetchWithCache('jetbrains', fetchJetbrainsUsage);
          break;
        case 'minimax':
          data = await fetchWithCache('minimax', fetchMinimaxUsage);
          break;
        case 'zai':
          data = await fetchWithCache('zai', fetchZaiUsage);
          break;
        case 'antigravity':
          data = await fetchWithCache('antigravity', fetchAntigravityUsage);
          break;
        default:
          return sendJson(res, 404, { status: 'error', message: `Unknown provider: ${provider}` });
      }
      sendJson(res, 200, { status: 'ok', ...data });
    } catch (e) {
      sendError(res, e.message);
    }
    return;
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
          // Run openclaw --version to get the actual running version
          const { execSync } = require('child_process');
          currentVersion = execSync('openclaw --version 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
        } catch (_) {
          // Fallback: try reading from package.json
          try {
            const nodeDir = path.dirname(path.dirname(process.execPath));
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
        }

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

  // GET /api/lb-release - LobsterBoard version check
  if (req.method === 'GET' && pathname === '/api/lb-release') {
    const now = Date.now();
    if (_lbReleaseCache && (now - _lbReleaseCacheTime) < 3600000) {
      sendJson(res, 200, _lbReleaseCache);
      return;
    }
    (async () => {
      try {
        let currentVersion = 'unknown';
        try {
          const pkgPath = path.join(__dirname, 'package.json');
          currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
        } catch (_) {}

        const ghRes = await fetch('https://api.github.com/repos/lobsterboard/lobsterboard/releases/latest');
        const ghData = await ghRes.json();
        const result = {
          status: 'ok',
          current: currentVersion,
          latest: ghData.tag_name || currentVersion,
          latestUrl: ghData.html_url || '',
          publishedAt: ghData.published_at || null
        };
        _lbReleaseCache = result;
        _lbReleaseCacheTime = now;
        sendJson(res, 200, result);
      } catch (e) {
        sendError(res, `LB Release check error: ${e.message}`);
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

  // GET /api/rss?url=<feedUrl>&widgetId=<id>&secretKey=<key> - Server-side RSS proxy
  if (req.method === 'GET' && pathname === '/api/rss') {
    let feedUrl = parsedUrl.searchParams.get('url');
    const rssWidgetId = parsedUrl.searchParams.get('widgetId');
    const rssSecretKey = parsedUrl.searchParams.get('secretKey') || 'feedUrl';
    if ((!feedUrl || feedUrl === '••••••••' || feedUrl === '__SECRET__') && rssWidgetId) {
      const secrets = getSecrets();
      feedUrl = secrets[rssWidgetId]?.[rssSecretKey] || null;
    }
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

  // GET /api/calendar?url=<icalUrl>&max=<maxEvents>&widgetId=<id>&secretKey=<key> - iCal feed proxy + parser
  if (req.method === 'GET' && pathname === '/api/calendar') {
    let icalUrl = parsedUrl.searchParams.get('url');
    const maxEvents = Math.min(parseInt(parsedUrl.searchParams.get('max')) || 10, 50);
    const widgetId = parsedUrl.searchParams.get('widgetId');
    const secretKey = parsedUrl.searchParams.get('secretKey') || 'icalUrl';
    // If url is masked/placeholder, resolve from secrets
    if ((!icalUrl || icalUrl === '••••••••' || icalUrl === '__SECRET__') && widgetId) {
      const secrets = getSecrets();
      icalUrl = secrets[widgetId]?.[secretKey] || null;
    }
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
        if (w && w.properties && w.properties.apiKey && w.properties.apiKey !== '__SECRET__') {
          apiKey = w.properties.apiKey;
        } else if (w) {
          // Check secrets store
          const secrets = getSecrets();
          apiKey = secrets[w.id]?.apiKey || null;
        }
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
        if (w && w.properties && w.properties.apiKey && w.properties.apiKey !== '__SECRET__') {
          apiKey = w.properties.apiKey;
        } else if (w) {
          const secrets = getSecrets();
          apiKey = secrets[w.id]?.apiKey || null;
        }
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

  // ── Templates API ──
  const TEMPLATES_DIR = path.join(__dirname, 'templates');

  // GET /api/templates — list all templates
  if (req.method === 'GET' && pathname === '/api/templates') {
    try {
      const templates = scanTemplates(TEMPLATES_DIR);
      sendJson(res, 200, templates);
    } catch (e) {
      sendError(res, `Failed to list templates: ${e.message}`);
    }
    return;
  }

  // GET /api/templates/:id — get a template's config.json
  if (req.method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)$/) && !pathname.endsWith('/preview')) {
    const id = pathname.split('/')[3];
    const configPath = path.join(TEMPLATES_DIR, id, 'config.json');
    if (!fs.existsSync(configPath)) { sendJson(res, 404, { error: 'Template not found' }); return; }
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      sendJson(res, 200, config);
    } catch (e) { sendError(res, e.message); }
    return;
  }

  // GET /api/templates/:id/preview — serve preview image
  if (req.method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/preview$/)) {
    const id = pathname.split('/')[3];
    const metaPath = path.join(TEMPLATES_DIR, id, 'meta.json');
    let previewFile = 'preview.png';
    try { previewFile = JSON.parse(fs.readFileSync(metaPath, 'utf8')).preview || 'preview.png'; } catch (_) {}
    const previewPath = path.join(TEMPLATES_DIR, id, previewFile);
    if (!fs.existsSync(previewPath)) { sendResponse(res, 404, 'text/plain', 'No preview'); return; }
    const ext = path.extname(previewPath).toLowerCase();
    const ct = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(previewPath, (err, data) => {
      if (err) { sendResponse(res, 404, 'text/plain', 'Not found'); return; }
      sendResponse(res, 200, ct, data);
    });
    return;
  }

  // POST /api/templates/import — import a template
  if (req.method === 'POST' && pathname === '/api/templates/import') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { id, mode } = JSON.parse(body);
        if (!id) { sendJson(res, 400, { error: 'Missing template id' }); return; }
        if (!mode) { sendJson(res, 400, { error: 'Missing import mode' }); return; }
        
        const tplConfigPath = path.join(TEMPLATES_DIR, id, 'config.json');
        if (!fs.existsSync(tplConfigPath)) { sendJson(res, 404, { error: `Template "${id}" not found` }); return; }
        
        let tplConfig;
        try {
          tplConfig = JSON.parse(fs.readFileSync(tplConfigPath, 'utf8'));
        } catch (parseErr) {
          sendJson(res, 500, { error: `Template config is invalid JSON: ${parseErr.message}` }); return;
        }

        if (mode === 'replace') {
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(tplConfig, null, 2));
          } catch (writeErr) {
            sendJson(res, 500, { error: `Failed to write config: ${writeErr.message}` }); return;
          }
          sendJson(res, 200, { status: 'success', message: 'Template imported (replace)' });
        } else if (mode === 'merge') {
          let currentConfig = { canvas: { width: 1920, height: 1080 }, widgets: [] };
          try { currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}
          // Find max Y of existing widgets
          let maxY = 0;
          for (const w of (currentConfig.widgets || [])) {
            const bottom = (w.y || 0) + (w.height || 100);
            if (bottom > maxY) maxY = bottom;
          }
          const offset = maxY + 100;
          const newWidgets = (tplConfig.widgets || []).map(w => ({
            ...w,
            id: w.id + '-tpl-' + Date.now(),
            y: (w.y || 0) + offset
          }));
          currentConfig.widgets = [...(currentConfig.widgets || []), ...newWidgets];
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
          } catch (writeErr) {
            sendJson(res, 500, { error: `Failed to write config: ${writeErr.message}` }); return;
          }
          sendJson(res, 200, { status: 'success', message: `Merged ${newWidgets.length} widgets` });
        } else {
          sendJson(res, 400, { error: 'Invalid mode. Use "replace" or "merge"' });
        }
      } catch (e) { sendJson(res, 500, { error: `Import error: ${e.message}` }); }
    });
    return;
  }

  // POST /api/templates/export — export current config as template
  // GET /api/quote - proxy for zenquotes.io (CORS blocked in browser)
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
    return;
  }

  if (req.method === 'GET' && pathname === '/api/latest-image') {
    return latestImageHandler(parsedUrl, res);
  }

  // GET /api/browse-dirs?dir=<path> - list subdirectories for folder picker
  if (req.method === 'GET' && pathname === '/api/browse-dirs') {
    const dir = parsedUrl.searchParams.get('dir') || os.homedir();
    const resolved = path.resolve(dir.replace(/^~/, os.homedir()));
    const home = os.homedir();
    if (!resolved.startsWith(home + path.sep) && resolved !== home) {
      return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Must be under home directory' }));
    }
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
      const imageCount = fs.readdirSync(resolved).filter(f => imageExts.includes(path.extname(f).toLowerCase())).length;
      return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', path: resolved, dirs: entries, imageCount }));
    } catch (error) { 
      return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: error.message })); 
    }
  }

  if (req.method === 'POST' && pathname === '/api/templates/export') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, description, author, tags, widgetTypes } = JSON.parse(body);
        if (!name) { sendJson(res, 400, { error: 'Name is required' }); return; }
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const tplDir = path.join(TEMPLATES_DIR, id);
        fs.mkdirSync(tplDir, { recursive: true });

        // Read current config and strip sensitive data
        let config = { canvas: { width: 1920, height: 1080 }, widgets: [] };
        try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}

        const sensitiveKeys = ['apiKey', 'api_key', 'token', 'secret', 'password'];
        const privateIpRegex = /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)/i;
        // URLs that may contain private auth tokens — strip them in templates
        const privateUrlKeys = ['icalUrl'];
        const privateUrlPatterns = [/[?&/]private[-_]?[a-f0-9]/i, /caldav\.icloud\.com/i, /\/private\//i];

        function stripSensitive(props) {
          if (!props || typeof props !== 'object') return props;
          let stripped = false;
          const result = Array.isArray(props) ? [...props] : { ...props };
          for (const key of Object.keys(result)) {
            if (sensitiveKeys.includes(key)) {
              result[key] = 'YOUR_API_KEY_HERE';
              stripped = true;
            } else if ((key === 'url' || key === 'endpoint') && typeof result[key] === 'string' && privateIpRegex.test(result[key])) {
              result[key] = 'http://your-server:port/path';
              stripped = true;
            } else if (privateUrlKeys.includes(key) && typeof result[key] === 'string') {
              // Always strip private calendar/feed URLs — they contain auth tokens
              if (result[key] && (result[key].length > 0)) {
                const hasPrivateToken = privateUrlPatterns.some(p => p.test(result[key]));
                if (hasPrivateToken) {
                  result[key] = '';
                  stripped = true;
                }
              }
            } else if (typeof result[key] === 'object' && result[key] !== null) {
              const inner = stripSensitive(result[key]);
              result[key] = inner.result;
              if (inner.stripped) stripped = true;
            }
          }
          return { result, stripped };
        }

        const cleanWidgets = (config.widgets || []).map(w => {
          const cleaned = { ...w };
          if (cleaned.properties) {
            const { result, stripped } = stripSensitive(cleaned.properties);
            cleaned.properties = result;
            if (stripped) cleaned._templateNote = '⚠️ Configure this widget\'s settings after import';
          }
          return cleaned;
        });

        const cleanConfig = { canvas: config.canvas, widgets: cleanWidgets };
        fs.writeFileSync(path.join(tplDir, 'config.json'), JSON.stringify(cleanConfig, null, 2));

        const canvasSize = config.canvas ? `${config.canvas.width}x${config.canvas.height}` : '1920x1080';
        const meta = {
          id,
          name,
          description: description || '',
          author: author || 'anonymous',
          tags: tags || [],
          canvasSize,
          widgetCount: cleanWidgets.length,
          widgetTypes: widgetTypes || [],
          requiresSetup: [],
          preview: 'preview.png'
        };
        fs.writeFileSync(path.join(tplDir, 'meta.json'), JSON.stringify(meta, null, 2));

        // Rebuild templates.json
        const templates = scanTemplates(TEMPLATES_DIR);
        fs.writeFileSync(path.join(TEMPLATES_DIR, 'templates.json'), JSON.stringify(templates, null, 2));

        sendJson(res, 200, { status: 'success', id, message: `Template "${name}" exported` });
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // POST /api/templates/:id/screenshot — upload preview image
  if (req.method === 'POST' && pathname.match(/^\/api\/templates\/[^/]+\/screenshot$/)) {
    const tplId = pathname.split('/')[3];
    const tplDir = path.join(TEMPLATES_DIR, tplId);
    if (!fs.existsSync(tplDir)) { sendJson(res, 404, { error: 'Template not found' }); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { data } = JSON.parse(body);
        const match = data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) { sendJson(res, 400, { error: 'Invalid image data' }); return; }
        const buf = Buffer.from(match[2], 'base64');
        fs.writeFileSync(path.join(tplDir, 'preview.png'), buf);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // DELETE /api/templates/:id — delete a template
  if (req.method === 'DELETE' && pathname.match(/^\/api\/templates\/[^/]+$/)) {
    const tplId = pathname.split('/')[3];
    const tplDir = path.join(TEMPLATES_DIR, tplId);
    if (!fs.existsSync(tplDir)) { sendJson(res, 404, { error: 'Template not found' }); return; }
    try {
      fs.rmSync(tplDir, { recursive: true, force: true });
      sendJson(res, 200, { status: 'success', message: `Template "${tplId}" deleted` });
    } catch (e) { sendError(res, e.message); }
    return;
  }

  // Serve static files
  // Check working directory's public/ folder first (for user assets like recap images)
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
  const authStatus = DASHBOARD_PASSWORD
    ? '   Password auth: ENABLED (DASHBOARD_PASSWORD is set)'
    : '   Password auth: DISABLED — set DASHBOARD_PASSWORD=yourpassword to enable';
  console.log(`
LobsterBoard Builder Server running at http://${HOST}:${PORT}

${authStatus}

   Press Ctrl+C to stop
`);
});

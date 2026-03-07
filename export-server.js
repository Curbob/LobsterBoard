/**
 * LobsterBoard Dashboard Server
 * 
 * A minimal server that:
 * - Serves your dashboard static files
 * - Proxies allowed OpenClaw API endpoints
 * 
 * Usage: node server.js
 * 
 * Environment variables:
 *   PORT          - Server port (default: 8080)
 *   HOST          - Bind address (default: 127.0.0.1 for security)
 *   OPENCLAW_URL  - OpenClaw gateway URL (default: http://localhost:18789)
 * 
 * Security: By default binds to localhost only. To expose on network:
 *   HOST=0.0.0.0 node server.js
 *   ⚠️  Only do this on trusted networks!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const OPENCLAW_URL = (process.env.OPENCLAW_URL || 'http://localhost:18789').replace(/\/$/, '');

// Restrict CORS to the dashboard's own origin (no wildcard)
const ALLOWED_ORIGIN = `http://${HOST}:${PORT}`;

// Allowed API endpoints (whitelist for security)
const ALLOWED_API_PATHS = [
  '/api/status',
  '/api/health',
  '/api/activity',
  '/api/cron',
  '/api/logs',
  '/api/sessions',
  '/api/usage/tokens'
];

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ─────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'export-server.log');

function log(level, message, data = null) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
  console.log(entry.trim());
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch (e) {
    // If we can't write to log file, just continue
  }
}

// Generate request ID for tracing
function generateRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

// ─────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────

function sendError(res, message, statusCode = 500, requestId = null) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    ...(requestId && { 'X-Request-Id': requestId })
  });
  res.end(JSON.stringify({ status: 'error', message }));
}

// ─────────────────────────────────────────────
// PROXY
// ─────────────────────────────────────────────

async function proxyToOpenClaw(reqPath, res, requestId) {
  const url = OPENCLAW_URL + reqPath;
  const startTime = Date.now();
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.text();
    
    log('INFO', `PROXY ${reqPath}`, { 
      requestId, 
      targetUrl: url,
      status: response.status,
      responseTime: Date.now() - startTime 
    });
    
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'X-Request-Id': requestId
    });
    res.end(data);
  } catch (error) {
    clearTimeout(timeout);
    
    // Log detailed error server-side
    log('ERROR', `Proxy failed: ${reqPath}`, { 
      requestId, 
      targetUrl: url, 
      error: error.message,
      responseTime: Date.now() - startTime
    });
    
    // Return generic message to client (don't leak internal details)
    sendError(res, 'Failed to reach backend service', 502, requestId);
  }
}

// ─────────────────────────────────────────────
// STATIC FILES
// ─────────────────────────────────────────────

function serveStatic(filePath, res, requestId) {
  // Default to index.html
  if (filePath === '/') filePath = '/index.html';
  
  const fullPath = path.resolve(__dirname, '.' + filePath);
  
  // Prevent path traversal attacks
  if (!fullPath.startsWith(path.resolve(__dirname))) {
    log('WARN', 'Path traversal attempt blocked', { requestId, path: filePath });
    sendError(res, 'Forbidden', 403, requestId);
    return;
  }
  
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        log('ERROR', 'Static file read error', { requestId, path: filePath, error: err.message });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const requestId = generateRequestId();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'X-Request-Id': requestId
    });
    res.end();
    return;
  }
  
  try {
    // Check if this is an allowed API proxy request
    if (pathname.startsWith('/api/')) {
      if (ALLOWED_API_PATHS.includes(pathname)) {
        await proxyToOpenClaw(pathname, res, requestId);
      } else {
        log('WARN', 'Blocked API path', { requestId, path: pathname });
        sendError(res, 'API endpoint not allowed', 403, requestId);
      }
      return;
    }
    
    // Serve static files
    serveStatic(pathname, res, requestId);
  } catch (e) {
    log('ERROR', 'Request handler error', { requestId, path: pathname, error: e.message, stack: e.stack });
    sendError(res, 'Internal server error', 500, requestId);
  }
});

// Handle server errors
server.on('error', (err) => {
  log('ERROR', 'Server error', { error: err.message, stack: err.stack });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('INFO', 'Received SIGTERM, shutting down...');
  server.close(() => {
    log('INFO', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('INFO', 'Received SIGINT, shutting down...');
  server.close(() => {
    log('INFO', 'Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, HOST, () => {
  log('INFO', 'Server started', { host: HOST, port: PORT, openclawUrl: OPENCLAW_URL });
  console.log(`
🦞 LobsterBoard Dashboard Server

   Local:   http://${HOST}:${PORT}
   OpenClaw: ${OPENCLAW_URL}
   
   Proxied endpoints: ${ALLOWED_API_PATHS.join(', ')}
   
${HOST === '127.0.0.1' ? '   ✓ Bound to localhost (secure)\n' : '   ⚠️  Exposed to network - use on trusted networks only!\n'}
   Press Ctrl+C to stop
`);
});

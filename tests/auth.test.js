/**
 * Auth flow tests: password sessions, PIN, public mode
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, postJson } from './helpers/server.js';
import crypto from 'node:crypto';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function setCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const combined = res.headers.get('set-cookie');
  if (!combined) return [];
  return combined.split(/,(?=\s*lb_(?:session|trusted)=)/).map(cookie => cookie.trim());
}

function cookiePair(headers, name) {
  const cookie = headers.find(value => value.startsWith(`${name}=`));
  return cookie ? cookie.split(';')[0] : null;
}

// ─── Password / Session Auth ───────────────────────────

describe('Password auth', () => {
  let srv;

  beforeAll(async () => {
    srv = await startServer({ password: 'test-secret-123', env: { TEDDY_HOMEBASE_ASK_LOCAL_ONLY: '1' } });
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('redirects unauthenticated browser requests to /login with return path', async () => {
    const res = await fetch(`${srv.baseUrl}/`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login?next=%2F');
  });

  it('returns 401 for unauthenticated API requests', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`);
    expect(res.status).toBe(401);
  });

  it('allows local Homebase health-check probes without a browser session', async () => {
    const pageRes = await fetch(`${srv.baseUrl}/pages/teddy-house/`, { redirect: 'manual' });
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get('content-type')).toContain('text/html');
    expect(pageRes.headers.get('cache-control')).toBe('no-store');

    const healthRes = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health).toHaveProperty('score');
    expect(health).toHaveProperty('services');

    const logsPageRes = await fetch(`${srv.baseUrl}/pages/teddy-house/logs/`, { redirect: 'manual' });
    expect(logsPageRes.status).toBe(200);
    expect(logsPageRes.headers.get('cache-control')).toBe('no-store');
    const logsScriptRes = await fetch(`${srv.baseUrl}/pages/teddy-house/logs.js`, { redirect: 'manual' });
    expect(logsScriptRes.status).toBe(200);
    expect(logsScriptRes.headers.get('cache-control')).toBe('no-store');
    const sharedNavRes = await fetch(`${srv.baseUrl}/pages/_shared/nav.js`, { redirect: 'manual' });
    expect(sharedNavRes.status).toBe(200);
    expect(sharedNavRes.headers.get('content-type')).toContain('javascript');
    const pagesListRes = await fetch(`${srv.baseUrl}/api/pages`, { redirect: 'manual' });
    expect(pagesListRes.status).toBe(200);
    const logsRes = await fetch(`${srv.baseUrl}/api/pages/teddy-house/logs`);
    expect(logsRes.status).toBe(200);

    const loginForDataRes = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    const dataCookie = cookiePair(setCookieHeaders(loginForDataRes), 'lb_session');
    const directEvidenceRes = await fetch(`${srv.baseUrl}/data/teddy-house/visual-evidence.json`, {
      redirect: 'manual',
      headers: { Cookie: dataCookie }
    });
    expect(directEvidenceRes.status).toBe(404);
    const directAskHistoryRes = await fetch(`${srv.baseUrl}/data/teddy-house/ask-history.json`, {
      redirect: 'manual',
      headers: { Cookie: dataCookie }
    });
    expect(directAskHistoryRes.status).toBe(404);

    const askRes = await fetch(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', prompt: 'Summarize current status.' })
    });
    expect(askRes.status).toBe(200);
    const ask = await askRes.json();
    expect(ask).toEqual(expect.objectContaining({
      status: 'complete',
      source: 'local'
    }));
  });

  it('keeps Homebase probes passworded for non-loopback hosts', async () => {
    const requestStatus = (path) => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: srv.port,
        path,
        method: 'GET',
        headers: { Host: 'openclaw-mac-mini.tail02a3b6.ts.net:10000' }
      }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });
    await expect(requestStatus('/api/pages/teddy-house/health')).resolves.toBe(401);
    await expect(requestStatus('/api/pages/teddy-house/logs')).resolves.toBe(401);
    await expect(requestStatus('/pages/teddy-house/logs.js')).resolves.toBe(302);
  });

  it('GET /login is always accessible', async () => {
    const res = await fetch(`${srv.baseUrl}/login`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('POST /api/auth/login with correct password returns session and trusted-device cookies', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.redirect).toBe('/');
    const cookies = setCookieHeaders(res);
    expect(cookiePair(cookies, 'lb_session')).toMatch(/^lb_session=[a-f0-9]{64}$/);
    expect(cookiePair(cookies, 'lb_trusted')).toMatch(/^lb_trusted=\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
    expect(cookies.join('\n')).toContain('HttpOnly');
    expect(cookies.join('\n')).toContain('SameSite=Lax');
    expect(cookies.join('\n')).toContain('Max-Age=2592000');
    expect(cookies.join('\n')).toContain('Expires=');
  });

  it('POST /api/auth/login accepts the Codex-only dashboard password', async () => {
    const codexSrv = await startServer({
      password: 'test-secret-123',
      env: { CODEX_DASHBOARD_PASSWORD: 'codex-secret-456' }
    });
    try {
      const res = await postJson(codexSrv.baseUrl, '/api/auth/login', { password: 'codex-secret-456' });
      expect(res.status).toBe(200);
      const cookies = setCookieHeaders(res);
      expect(cookiePair(cookies, 'lb_session')).toMatch(/^lb_session=[a-f0-9]{64}$/);
      expect(cookiePair(cookies, 'lb_trusted')).toMatch(/^lb_trusted=\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
    } finally {
      await codexSrv.kill();
    }
  });

  it('POST /api/auth/login accepts the Codex-only verifier hash', async () => {
    const hash = crypto.createHmac('sha256', 'lb-session-auth').update('codex-secret-789').digest('hex');
    const codexSrv = await startServer({
      password: 'test-secret-123',
      env: { CODEX_DASHBOARD_PASSWORD_HASH: hash }
    });
    try {
      const res = await postJson(codexSrv.baseUrl, '/api/auth/login', { password: 'codex-secret-789' });
      expect(res.status).toBe(200);
      const cookies = setCookieHeaders(res);
      expect(cookiePair(cookies, 'lb_session')).toMatch(/^lb_session=[a-f0-9]{64}$/);
      expect(cookiePair(cookies, 'lb_trusted')).toMatch(/^lb_trusted=\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
    } finally {
      await codexSrv.kill();
    }
  });

  it('login page only redirects to same-origin relative paths', async () => {
    const html = readFileSync(join(process.cwd(), 'login.html'), 'utf8');
    expect(html).toContain('function safeRedirectTarget');
    expect(html).toContain('let loginInFlight = false');
    expect(html).toContain("addEventListener('submit', login)");
    expect(html).not.toContain("addEventListener('click', login)");
    expect(html).toContain("credentials: 'same-origin'");
    expect(html).toContain("candidate.startsWith('/')");
    expect(html).toContain("candidate.startsWith('//')");
    expect(html).toContain('url.origin !== window.location.origin');
    expect(html).toContain("'/pages/teddy-house/'");
  });

  it('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/login', { password: 'wrong' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid password');
  });

  it('authenticated requests work with valid session cookie', async () => {
    // Login first
    const loginRes = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    const cookie = cookiePair(setCookieHeaders(loginRes), 'lb_session');

    // Use cookie for API request
    const res = await fetch(`${srv.baseUrl}/api/stats`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('timestamp');
  });

  it('trusted-device cookie refreshes the in-memory session after restart-like loss', async () => {
    const loginRes = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    const trustedCookie = cookiePair(setCookieHeaders(loginRes), 'lb_trusted');
    expect(trustedCookie).toBeTruthy();

    const res = await fetch(`${srv.baseUrl}/api/stats`, {
      headers: { Cookie: trustedCookie },
    });
    expect(res.status).toBe(200);
    const cookies = setCookieHeaders(res);
    expect(cookiePair(cookies, 'lb_session')).toMatch(/^lb_session=[a-f0-9]{64}$/);
    expect(cookiePair(cookies, 'lb_trusted')).toMatch(/^lb_trusted=\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
    expect(cookies.join('\n')).toContain('SameSite=Lax');
  });

  it('rejects invalid trusted-device cookies', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`, {
      headers: { Cookie: 'lb_trusted=bad-token' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout clears session', async () => {
    // Login
    const loginRes = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    const cookies = setCookieHeaders(loginRes);
    const cookie = cookiePair(cookies, 'lb_session');
    const trustedCookie = cookiePair(cookies, 'lb_trusted');

    // Logout
    const logoutRes = await fetch(`${srv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `${cookie}; ${trustedCookie}` },
      redirect: 'manual',
    });
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.get('location')).toBe('/login');
    const clearCookies = setCookieHeaders(logoutRes).join('\n');
    expect(clearCookies).toContain('lb_session=;');
    expect(clearCookies).toContain('lb_trusted=;');

    // Old cookie should no longer work
    const afterRes = await fetch(`${srv.baseUrl}/api/stats`, {
      headers: { Cookie: cookie },
    });
    expect(afterRes.status).toBe(401);
  });

  it('rate limits after 5 failed attempts', async () => {
    // Use a separate server to isolate rate limit state
    const rlSrv = await startServer({ password: 'ratelimit-test' });
    try {
      for (let i = 0; i < 5; i++) {
        await postJson(rlSrv.baseUrl, '/api/auth/login', { password: 'wrong' });
      }
      const res = await postJson(rlSrv.baseUrl, '/api/auth/login', { password: 'wrong' });
      expect(res.status).toBe(429);
    } finally {
      await rlSrv.kill();
    }
  });
});

// ─── No password mode ──────────────────────────────────

describe('No-password mode', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(); });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('all routes are accessible without auth', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`);
    expect(res.status).toBe(200);
  });

  it('login endpoint returns ok without password', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/login', { password: '' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

// ─── PIN Auth ──────────────────────────────────────────

describe('PIN auth', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(); });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('GET /api/auth/status shows no PIN initially', async () => {
    const res = await fetch(`${srv.baseUrl}/api/auth/status`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasPin).toBe(false);
    expect(data.publicMode).toBe(false);
  });

  it('POST /api/auth/set-pin sets a 4-digit PIN', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/set-pin', { pin: '1234' });
    expect(res.status).toBe(200);

    // Verify status
    const statusRes = await fetch(`${srv.baseUrl}/api/auth/status`);
    const data = await statusRes.json();
    expect(data.hasPin).toBe(true);
  });

  it('POST /api/auth/verify-pin validates correct PIN', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/verify-pin', { pin: '1234' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('POST /api/auth/verify-pin rejects wrong PIN', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/verify-pin', { pin: '9999' });
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('POST /api/auth/set-pin requires current PIN to change', async () => {
    // Try changing without current PIN
    const res = await postJson(srv.baseUrl, '/api/auth/set-pin', { pin: '5678' });
    expect(res.status).toBe(403);

    // Change with correct current PIN
    const res2 = await postJson(srv.baseUrl, '/api/auth/set-pin', { pin: '5678', currentPin: '1234' });
    expect(res2.status).toBe(200);
  });

  it('rejects invalid PIN format', async () => {
    const cases = [
      { pin: '12' },       // too short
      { pin: '1234567' },  // too long
      { pin: 'abcd' },     // non-numeric
    ];
    for (const body of cases) {
      const res = await postJson(srv.baseUrl, '/api/auth/set-pin', { ...body, currentPin: '5678' });
      expect(res.status, `Should reject pin="${body.pin}"`).toBe(400);
    }
  });

  it('POST /api/auth/remove-pin removes PIN with correct PIN', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/remove-pin', { pin: '5678' });
    expect(res.status).toBe(200);

    const statusRes = await fetch(`${srv.baseUrl}/api/auth/status`);
    const data = await statusRes.json();
    expect(data.hasPin).toBe(false);
  });
});

// ─── Public Mode ───────────────────────────────────────

describe('Public mode', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(); });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('GET /api/mode shows public mode off by default', async () => {
    const res = await fetch(`${srv.baseUrl}/api/mode`);
    const data = await res.json();
    expect(data.publicMode).toBe(false);
  });

  it('POST /api/mode toggles public mode on (no PIN required when none set)', async () => {
    const res = await postJson(srv.baseUrl, '/api/mode', { publicMode: true });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.publicMode).toBe(true);
  });

  it('blocks template creation in public mode', async () => {
    const res = await postJson(srv.baseUrl, '/api/templates/export', { name: 'test', description: 'test' });
    expect(res.status).toBe(403);
  });

  it('blocks secrets API in public mode', async () => {
    const res = await postJson(srv.baseUrl, '/api/secrets/w-1', { apiKey: 'test' });
    expect(res.status).toBe(403);
  });

  it('blocks all non-read dashboard writes in public mode', async () => {
    const cases = [
      ['/api/servers', { name: 'Remote', url: 'http://127.0.0.1:9', apiKey: 'test' }],
      ['/api/todos', []],
      ['/api/notes', {}],
      ['/config', {}]
    ];

    for (const [path, body] of cases) {
      const res = await postJson(srv.baseUrl, path, body);
      expect(res.status, path).toBe(403);
    }
  });

  it('read-only APIs still work in public mode', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`);
    expect(res.status).toBe(200);
  });

  it('POST /api/mode toggles public mode off', async () => {
    const res = await postJson(srv.baseUrl, '/api/mode', { publicMode: false });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.publicMode).toBe(false);
  });
});

describe('Public mode with PIN', () => {
  let srv;
  beforeAll(async () => {
    const pinHash = crypto.createHash('sha256').update('4321').digest('hex');
    srv = await startServer({ auth: { pinHash, publicMode: false } });
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('requires PIN to enable public mode when PIN is set', async () => {
    const res = await postJson(srv.baseUrl, '/api/mode', { publicMode: true });
    expect(res.status).toBe(403);
  });

  it('enables public mode with correct PIN', async () => {
    const res = await postJson(srv.baseUrl, '/api/mode', { publicMode: true, pin: '4321' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.publicMode).toBe(true);
  });
});

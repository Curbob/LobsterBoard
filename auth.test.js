/**
 * Auth flow tests: password sessions, PIN, public mode
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, postJson } from './helpers/server.js';
import crypto from 'node:crypto';

// ─── Password / Session Auth ───────────────────────────

describe('Password auth', () => {
  let srv;

  beforeAll(async () => {
    srv = await startServer({ password: 'test-secret-123' });
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('redirects unauthenticated browser requests to /login', async () => {
    const res = await fetch(`${srv.baseUrl}/`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('returns 401 for unauthenticated API requests', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`);
    expect(res.status).toBe(401);
  });

  it('GET /login is always accessible', async () => {
    const res = await fetch(`${srv.baseUrl}/login`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('POST /api/auth/login with correct password returns session cookie', async () => {
    const res = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.redirect).toBe('/');
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toContain('lb_session=');
    expect(cookie).toContain('HttpOnly');
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
    const cookie = loginRes.headers.get('set-cookie').split(';')[0]; // lb_session=...

    // Use cookie for API request
    const res = await fetch(`${srv.baseUrl}/api/stats`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('timestamp');
  });

  it('POST /api/auth/logout clears session', async () => {
    // Login
    const loginRes = await postJson(srv.baseUrl, '/api/auth/login', { password: 'test-secret-123' });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Logout
    const logoutRes = await fetch(`${srv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
      redirect: 'manual',
    });
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.get('location')).toBe('/login');

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

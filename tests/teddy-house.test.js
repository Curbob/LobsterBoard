/**
 * Teddy House custom page tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from '../helpers/server.js';

let srv;

beforeAll(async () => {
  srv = await startServer();
});

afterAll(async () => { if (srv) await srv.kill(); });

describe('Teddy House page', () => {
  it('serves the custom page with LobsterBoard shared nav and custom icon', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/teddy-house/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="page-nav"');
    expect(html).toContain('/pages/_shared/nav.js');
    expect(html).toContain('/pages/teddy-house/teddy-house-icon.png');
  });

  it('uses a 420 second automatic refresh interval', () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    expect(script).toContain('const REFRESH_MS = 420000');
    expect(script).toContain('setInterval(loadHealth, REFRESH_MS)');
  });
});

describe('Teddy House health API', () => {
  it('returns the dashboard health contract', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty('checkedAt');
    expect(data).toHaveProperty('score');
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.needsDan)).toBe(true);
    expect(data.services).toHaveProperty('adguard');
    expect(data.services).toHaveProperty('homebridge');
    expect(data.services).toHaveProperty('tailscale');
    expect(data.services).toHaveProperty('internet');
    expect(data.services).toHaveProperty('openclaw');
    expect(data.services).toHaveProperty('backups');
    expect(data.insights).toHaveProperty('teddySays');
    expect(Array.isArray(data.insights.cards)).toBe(true);
    expect(data.vitals).toHaveProperty('memory');
    expect(Array.isArray(data.events)).toBe(true);
  }, 12000);

  it('keeps Time Machine parked out of the Dan action lane', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    const data = await res.json();

    expect(data.services.backups.state).toBe('info');
    expect(data.needsDan.join(' ')).not.toMatch(/backup|time machine/i);
  }, 12000);
});

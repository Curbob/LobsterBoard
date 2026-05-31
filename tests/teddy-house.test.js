/**
 * Teddy Homebase custom page tests.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { startServer } from '../helpers/server.js';

let srv;
const require = createRequire(import.meta.url);
const teddyHouseInternals = require('../pages/teddy-house/api.cjs')._internals;
const replayFixtureNames = [
  'healthy',
  'govee-loop',
  'mac-panic',
  'public-exposure-drift',
  'wan-dns-degraded',
  'teddy-bridge-fallback'
];

function loadReplayFixture(name) {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'teddy-house', `${name}.json`), 'utf8'));
}

function replayHouseState(fixture) {
  const services = structuredClone(fixture.services);
  const intelligence = structuredClone(fixture.intelligence);
  const systemVitals = structuredClone(fixture.systemVitals);
  if (intelligence.serviceLogs) {
    Object.assign(intelligence.serviceLogs, teddyHouseInternals.domainServiceLogs(intelligence.serviceLogs));
    intelligence.automationLogs = intelligence.serviceLogs.automationLogs;
    intelligence.macMiniLogs = intelligence.serviceLogs.macMiniLogs;
    intelligence.networkLogs = intelligence.serviceLogs.networkLogs;
  }
  const reviewItems = teddyHouseInternals.needsDan(services, intelligence, systemVitals);
  const score = teddyHouseInternals.scoreServices(services, intelligence, systemVitals);
  const houseState = teddyHouseInternals.deriveHouseState(
    services,
    intelligence,
    systemVitals,
    reviewItems,
    fixture.timeline || [],
    score
  );
  const dailyDecision = teddyHouseInternals.deriveDailyDecision(
    services,
    intelligence,
    systemVitals,
    reviewItems,
    houseState
  );
  return { services, intelligence, systemVitals, reviewItems, score, houseState, dailyDecision };
}

function firstScreenText(result) {
  return [
    result.houseState.headline,
    result.houseState.summary,
    result.houseState.primaryAction,
    ...result.houseState.zones.map(zone => `${zone.title} ${zone.value} ${zone.detail}`),
    ...result.dailyDecision.slots.map(slot => `${slot.label} ${slot.text}`)
  ].join('\n');
}

beforeAll(async () => {
  srv = await startServer();
});

afterAll(async () => { if (srv) await srv.kill(); });

describe('Teddy Homebase page', () => {
  it.each(replayFixtureNames)('replays the %s house state without live service probes', (fixtureName) => {
    const fixture = loadReplayFixture(fixtureName);
    const result = replayHouseState(fixture);
    const expected = fixture.expected;

    expect(result.houseState.headline).toBe(expected.headline);
    expect(result.houseState.zones[0]).toEqual(expect.objectContaining({
      id: expected.firstZone,
      state: expected.firstZoneState
    }));
    if (expected.firstReview) expect(result.reviewItems[0]).toBe(expected.firstReview);
    expect(result.dailyDecision.slots[0]).toEqual(expect.objectContaining({
      source: expected.nowSource,
      text: expected.nowText
    }));
  });

  it('keeps raw telemetry out of the healthy replay first screen', () => {
    const result = replayHouseState(loadReplayFixture('healthy'));
    expect(firstScreenText(result)).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d{2,5},\s*\d{2,5}\b|\b(?:\d+\.){2,}\d+\b|\b\d+\s*(ms|warnings?|errors?|issues?|findings?)\b/i);
    expect(firstScreenText(result)).not.toMatch(/Eufy|Door locks|Garage side door|Front Door|Side Door/i);
  });

  it('serves the custom page with LobsterBoard shared nav and custom icon', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/teddy-house/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="page-nav"');
    expect(html).toContain('/pages/_shared/nav.js');
    expect(html).toContain('/pages/teddy-house/teddy-house-icon.png');
    expect(html).toContain('https://openclaw-mac-mini.tail02a3b6.ts.net:3001/');
    expect(html).toContain('>AdGuard</a>');
  });

  it('serves the hidden logs detail page and grouped logs API', async () => {
    const pageRes = await fetch(`${srv.baseUrl}/pages/teddy-house/logs/`);
    expect(pageRes.status).toBe(200);
    const html = await pageRes.text();
    expect(html).toContain('Homebase Logs');
    expect(html).toContain('/pages/teddy-house/logs.js');

    const apiRes = await fetch(`${srv.baseUrl}/api/pages/teddy-house/logs`);
    expect(apiRes.status).toBe(200);
    const data = await apiRes.json();
    expect(data.serviceLogs).toHaveProperty('items');
    expect(Array.isArray(data.serviceLogs.items)).toBe(true);
    expect(data.serviceLogs.items.length).toBeGreaterThan(0);
    expect(data.serviceLogs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Homebase', source: expect.any(String), detail: expect.any(String), examples: expect.any(Array) }),
      expect.objectContaining({ name: 'Homebridge', source: expect.any(String), detail: expect.any(String), examples: expect.any(Array) }),
      expect.objectContaining({ name: 'Eufy plugin', ignored: true, source: expect.any(String), detail: expect.stringContaining('ignored') }),
      expect.objectContaining({ name: 'OpenClaw', source: expect.any(String), detail: expect.any(String), examples: expect.any(Array) }),
      expect.objectContaining({ name: 'AdGuard', source: expect.any(String), detail: expect.any(String), examples: expect.any(Array) }),
      expect.objectContaining({ name: 'Tailscale', source: 'tailscale status --json', detail: expect.any(String), examples: expect.any(Array) })
    ]));
    expect(data.serviceLogs).toHaveProperty('automationLogs');
    expect(data.serviceLogs).toHaveProperty('macMiniLogs');
    expect(data.serviceLogs).toHaveProperty('networkLogs');
    expect(data.storage).toEqual(expect.objectContaining({
      latestSnapshot: 'data/teddy-house/service-logs.json',
      visualEvidence: 'data/teddy-house/visual-evidence.json'
    }));
    expect(data.framework.codexTake).toContain('Normalize every source');
    expect(data.framework.teddyTake).toContain('Daily Homebase should feel calm');
    expect(data.framework.architecture.map(step => step.layer)).toEqual([
      'Collect',
      'Redact',
      'Classify',
      'Store',
      'Surface',
      'Escalate'
    ]);

    const payload = JSON.stringify(data);
    expect(payload).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(payload).not.toMatch(/\b\d{3}-\d{2}-\d{3}\b/);
  }, 12000);

  it('renders shared navigation with text nodes instead of API-derived HTML', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/_shared/nav.js'), 'utf8');
    const dom = new JSDOM('<!doctype html><nav id="page-nav"></nav>', {
      url: 'http://127.0.0.1/pages/teddy-house/',
      runScripts: 'outside-only'
    });
    const maliciousTitle = '<img src=x onerror="window.__navInjected = true">';
    const maliciousId = 'bad"id';
    dom.window.fetch = vi.fn(async () => ({
      json: async () => [{ id: maliciousId, icon: '<svg onload=1>', title: maliciousTitle }]
    }));

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const nav = dom.window.document.getElementById('page-nav');
    expect(nav.querySelector('img')).toBeNull();
    expect(dom.window.__navInjected).toBeUndefined();
    expect(nav.textContent).toContain(maliciousTitle);
    expect(nav.innerHTML).toContain('&lt;img src=x onerror=');
    expect(nav.querySelectorAll('a')).toHaveLength(2);
    expect(nav.querySelectorAll('a')[1].getAttribute('href')).toBe('/pages/bad%22id');
  });

  it('redirects direct file opens to the served Homebase route', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');

    expect(html).toContain('window.location.protocol === "file:"');
    expect(html).toContain('window.location.replace("http://127.0.0.1:8080/pages/teddy-house/")');
  });

  it('uses a 420 second automatic refresh interval', () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    expect(script).toContain('const REFRESH_MS = 420000');
    expect(script).toContain('setInterval(loadHealth, REFRESH_MS)');
  });

  it('keeps the summary rendering alive when checkedAt is missing or invalid', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = new JSDOM(`<!doctype html>
      <button id="refresh-button"></button>
      <form id="ask-form">
        <input id="ask-input">
        <button id="ask-submit"></button>
      </form>
      <button id="ask-status-button"></button>
      <div id="ask-state"></div>
      <div id="ask-response"></div>
      <div id="summary-title"></div>
      <div id="summary-copy"></div>
      <div id="health-score"></div>
      <div id="score-ring"></div>
      <div id="next-action"></div>
      <div id="last-check"></div>
      <div id="teddy-line"></div>
      <section id="review-lane" class="needs-lane">
        <div id="needs-title"></div>
        <div id="needs-list"></div>
      </section>
      <div id="service-grid"></div>
      <div id="vitals-grid"></div>
      <div id="signal-grid"></div>
      <div id="events-list"></div>`, {
      url: 'http://127.0.0.1/pages/teddy-house/',
      runScripts: 'outside-only'
    });

    dom.window.fetch = vi.fn(async url => {
      if (url === '/api/pages/teddy-house/health') {
        return {
          ok: true,
          json: async () => ({
            checkedAt: 'not-a-date',
            score: 95,
            needsDan: [],
            services: {},
            vitals: {},
            intelligence: {},
            timeline: []
          })
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    expect(dom.window.document.getElementById('last-check').textContent).toBe('Checked unknown');
    expect(dom.window.document.getElementById('summary-title').textContent).toBe("Dan's house is steady.");
    expect(dom.window.document.getElementById('review-lane').hidden).toBe(true);
  });

  it('ranks dashboard cards by what needs attention first', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = new JSDOM(`<!doctype html>
      <button id="refresh-button"></button>
      <form id="ask-form">
        <input id="ask-input">
        <button id="ask-submit"></button>
      </form>
      <button id="ask-status-button"></button>
      <div id="ask-state"></div>
      <div id="ask-response"></div>
      <div id="summary-title"></div>
      <div id="summary-copy"></div>
      <div id="health-score"></div>
      <div id="score-ring"></div>
      <div id="next-action"></div>
      <div id="last-check"></div>
      <div id="teddy-line"></div>
      <div id="needs-title"></div>
      <div id="needs-list"></div>
      <section id="house-state">
        <span id="house-state-pill"></span>
        <div id="house-zone-grid"></div>
      </section>
      <div id="service-grid"></div>
      <div id="vitals-grid"></div>
      <div id="signal-grid"></div>
      <div id="events-list"></div>`, {
      url: 'http://127.0.0.1/pages/teddy-house/',
      runScripts: 'outside-only'
    });

    dom.window.fetch = vi.fn(async url => {
      if (url === '/api/pages/teddy-house/health') {
        return {
          ok: true,
          json: async () => ({
            checkedAt: '2026-05-16T23:00:00.000Z',
            score: 82,
            needsDan: ['Homebridge needs review'],
            reviewEvidence: [
              {
                label: 'Homebridge needs review',
                state: 'bad',
                source: 'Homebridge Port',
                confidence: 'live',
                checkedAt: '2026-05-16T23:00:00.000Z',
                freshness: 'live',
                detail: 'Homebridge did not answer.'
              }
            ],
            houseState: {
              headline: 'Something needs a look.',
              summary: 'Start with automations. Everything else is responding.',
              tone: 'review',
              primaryAction: 'Start with automations.',
              zones: [
                { id: 'smart-home', title: 'Automations', state: 'bad', value: 'Issue', detail: 'Homebridge did not answer.', evidence: ['Homebridge'] },
                { id: 'outside-access', title: 'Public access', state: 'info', value: 'Known', detail: 'Expected public routes are accounted for.', evidence: ['Tailscale Funnel'] },
                { id: 'network', title: 'Internet', state: 'ok', value: 'Normal', detail: 'Internet, DNS, and Tailscale are responding.', evidence: ['Internet', 'DNS'] },
                { id: 'mac-mini', title: 'Mac mini', state: 'ok', value: 'Healthy', detail: 'System checks are quiet.', evidence: ['OpenClaw'] }
              ],
              recentChanges: []
            },
            services: {
              adguard: { state: 'ok', metric: '12 ms', check: 'DNS', detail: 'DNS answered.' },
              homebridge: { state: 'bad', metric: 'down', check: 'Port', detail: 'Homebridge did not answer.' },
              tailscale: { state: 'warn', metric: '10000', check: 'Funnel', detail: 'Extra exposure.' },
              internet: { state: 'ok', metric: '20 ms', check: 'WAN', detail: 'Internet is fine.' },
              openclaw: { state: 'ok', metric: '18789', check: 'Gateway', detail: 'Gateway is up.' }
            },
            vitals: {
              cpu: '10.0',
              memory: '55%',
              memoryPressure: '45% free',
              disk: '9%',
              uptime: '1d',
              network: 'local',
              host: 'mini',
              health: {
                cpu: { state: 'warn', detail: 'Load is high.', peak6h: '12.00', secondary: 'Peak 12.00 / 6h' },
                memory: { state: 'ok', metric: '55%', displayMetric: '45% free', detail: 'Memory is fine.' },
                disk: { state: 'ok', detail: 'Disk is fine.' }
              }
            },
            intelligence: {
              adguard: { state: 'info', value: 'locked', label: 'locked', detail: 'Login needed.' },
              homebridge: {
                doorLocks: { state: 'ok', value: 'locked', label: '2 locks', detail: 'Front Door: locked. Side Door: locked.', items: [] },
                accessories: { state: 'ok', count: 102, detail: 'Accessories loaded.' },
                logHealth: { state: 'bad', value: '12', label: 'recent issues', detail: 'Errors in the log.' },
                version: { state: 'info', value: '1', label: 'optional UI update', detail: 'Homebridge is current at 2.0.2. Homebridge UI has a patch update available when convenient: 5.22.0 to 5.23.0.' }
              },
              tailscaleFunnel: { state: 'info', metric: '8443, 10000', check: 'Accepted access', detail: 'Known public routes: Teddy Homebase on 10000 and BlueBubbles on 8443.' },
              wanQuality: { state: 'ok', metric: '20 ms', check: 'WAN', detail: 'WAN is fine.' },
              serviceLogs: { state: 'ok', value: 'quiet', label: 'quiet', detail: 'Service logs are quiet.', items: [] },
              softwareUpdates: { state: 'ok', value: 'current', label: 'version check', detail: 'Apps are current.' },
              macUpdates: { state: 'ok', metric: 'current', check: 'macOS', detail: 'No updates.' },
              systemLogs: { state: 'ok', metric: '0', check: 'System logs', detail: 'Logs are quiet.' },
              weirdThings: []
            },
            timeline: []
          })
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const services = [...dom.window.document.querySelectorAll('#service-grid .service-name')].map(el => el.textContent);
    expect(services.slice(0, 2)).toEqual(['Homebridge', 'Tailscale']);

    const zones = [...dom.window.document.querySelectorAll('#house-zone-grid .tiny-label')].map(el => el.textContent);
    expect(zones).toEqual(['Automations', 'Public access', 'Internet', 'Mac mini']);
    expect(dom.window.document.getElementById('summary-title').textContent).toBe('Something needs a look.');
    expect(dom.window.document.getElementById('next-action').textContent).toBe('Start with automations.');
    const chip = dom.window.document.querySelector('#needs-list .need-chip');
    expect(chip.dataset.source).toBe('Homebridge Port');
    expect(chip.dataset.confidence).toBe('live');
    expect(chip.dataset.checkedAt).toBe('2026-05-16T23:00:00.000Z');
    expect(chip.title).toContain('Homebridge Port | live | Checked');

    const signals = [...dom.window.document.querySelectorAll('#signal-grid .signal-card .tiny-label')].map(el => el.textContent);
    expect(signals.slice(0, 4)).toEqual(['Homebridge log', 'DNS blocks', 'Homebridge version', "What's exposed"]);

    const vitals = [...dom.window.document.querySelectorAll('#vitals-grid .tiny-label')].map(el => el.textContent);
    expect(vitals[0]).toBe('CPU load');
  });

  it('hides ignored Eufy locks but still shows confidence for visible cached signals', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = new JSDOM(`<!doctype html>
      <button id="refresh-button"></button>
      <form id="ask-form">
        <input id="ask-input">
        <button id="ask-submit"></button>
      </form>
      <button id="ask-status-button"></button>
      <div id="ask-state"></div>
      <div id="ask-response"></div>
      <div id="summary-title"></div>
      <div id="summary-copy"></div>
      <div id="health-score"></div>
      <div id="score-ring"></div>
      <div id="next-action"></div>
      <div id="last-check"></div>
      <div id="teddy-line"></div>
      <div id="needs-title"></div>
      <div id="needs-list"></div>
      <div id="service-grid"></div>
      <div id="vitals-grid"></div>
      <div id="signal-grid"></div>
      <div id="events-list"></div>`, {
      url: 'http://127.0.0.1/pages/teddy-house/',
      runScripts: 'outside-only'
    });

    dom.window.fetch = vi.fn(async url => {
      if (url === '/api/pages/teddy-house/health') {
        return {
          ok: true,
          json: async () => ({
            checkedAt: '2026-05-16T23:00:00.000Z',
            score: 92,
            needsDan: [],
            services: {},
            vitals: { health: {} },
            intelligence: {
              homebridge: {
                doorLocks: {
                  state: 'info',
                  value: 'ignored',
                  label: 'ignored',
                  detail: 'Garage side door ignored because the Eufy source is degraded.',
                  confidence: 'degraded',
                  hidden: true,
                  items: []
                }
              },
              macUpdates: {
                state: 'info',
                metric: 'current',
                check: 'macOS',
                detail: 'Cached update result.',
                confidence: 'cached'
              }
            },
            timeline: []
          })
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const confidence = [...dom.window.document.querySelectorAll('#signal-grid .confidence-pill')].map(el => el.textContent);
    const signals = [...dom.window.document.querySelectorAll('#signal-grid .signal-card .tiny-label')].map(el => el.textContent);
    expect(confidence).toContain('Cached');
    expect(signals).not.toContain('Door locks');
  });

  it('includes an Ask Teddy command bar for dashboard actions', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/teddy-house/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');

    expect(html).toContain('id="ask-teddy"');
    expect(html).toContain('Ask Teddy');
    expect(html).toContain('id="ask-input"');
    expect(html).toContain('id="ask-status-button"');
    expect(script).toContain('async function askTeddy');
    expect(script).toContain('/api/pages/teddy-house/ask');
    expect(script).toContain('context: currentHealth');
    expect(script).toContain('credentials: "same-origin"');
    expect(script).toContain('setTimeout(() => controller.abort(), 75000)');
    expect(script).toContain('Explain');
    expect(script).toContain('Prepare fix');
    expect(script).toContain('action: "prepare-fix"');
    expect(script).toContain('Do not run commands or change settings');
    expect(script).toContain('data.source === "local-fallback"');
    expect(script).toContain('Fallback');
    expect(script).not.toMatch(/launchctl|tailscale serve|hb-service restart|npm install|sudo\s+/);
  });

  it('has iPhone home-screen metadata and install icons', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/teddy-house/`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Teddy Homebase"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('rel="apple-touch-icon" href="/pages/teddy-house/apple-touch-icon.png"');
    expect(html).toContain('rel="manifest" href="/pages/teddy-house/manifest.webmanifest"');

    const manifestRes = await fetch(`${srv.baseUrl}/pages/teddy-house/manifest.webmanifest`);
    expect(manifestRes.status).toBe(200);
    expect(manifestRes.headers.get('content-type')).toContain('application/manifest+json');
    const manifest = await manifestRes.json();
    expect(manifest).toEqual(expect.objectContaining({
      name: 'Teddy Homebase',
      short_name: 'Homebase',
      start_url: '/pages/teddy-house/',
      scope: '/',
      display: 'standalone'
    }));
    expect(manifest.icons.map(icon => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

    for (const file of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
      const iconPath = join(process.cwd(), 'pages/teddy-house', file);
      expect(existsSync(iconPath)).toBe(true);
      expect(statSync(iconPath).size).toBeGreaterThan(1000);
    }
  });

  it('lets iPhone install assets load before login without exposing the dashboard', async () => {
    const locked = await startServer({ password: 'test-homebase-lock', env: { TEDDY_HOMEBASE_LOCAL_PROBES: '0' } });
    try {
      const page = await fetch(`${locked.baseUrl}/pages/teddy-house/`, { redirect: 'manual' });
      expect(page.status).toBe(302);
      expect(page.headers.get('location')).toContain('/login');

      const manifest = await fetch(`${locked.baseUrl}/pages/teddy-house/manifest.webmanifest`);
      expect(manifest.status).toBe(200);
      expect(manifest.headers.get('content-type')).toContain('application/manifest+json');

      const icon = await fetch(`${locked.baseUrl}/pages/teddy-house/apple-touch-icon.png`);
      expect(icon.status).toBe(200);
      expect(icon.headers.get('content-type')).toContain('image/png');
      expect((await icon.arrayBuffer()).byteLength).toBeGreaterThan(1000);

      const iconHead = await fetch(`${locked.baseUrl}/pages/teddy-house/apple-touch-icon.png`, { method: 'HEAD' });
      expect(iconHead.status).toBe(200);
      expect(iconHead.headers.get('content-type')).toContain('image/png');
    } finally {
      await locked.kill();
    }
  });
});

describe('Teddy Homebase health API', () => {
  it('dry-runs Ask Teddy requests with dashboard context', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: true,
        action: 'ask',
        prompt: 'What should I check first?',
        clicked: { type: 'review', label: 'WAN: 120 ms' },
        context: {
          checkedAt: '2026-05-16T23:00:00.000Z',
          score: 88,
          needsDan: ['WAN: 120 ms'],
          services: {
            adguard: { state: 'ok', metric: '12 ms' },
            homebridge: { state: 'ok', metric: '8581' },
            tailscale: { state: 'ok', metric: '100.64.0.1' },
            internet: { state: 'warn', metric: '120 ms' },
            openclaw: { state: 'ok', metric: '18789' }
          },
          intelligence: {
            wanQuality: { state: 'warn', metric: '120 ms', detail: 'Latency is high.' },
            tailscaleFunnel: { state: 'ok', metric: '10000' }
          },
          historicalSummaries: [
            {
              id: 'wan-latency-24h',
              title: 'WAN latency',
              window: '24h',
              value: '120 ms now',
              detail: 'Worst check 120.0 ms across 5 persisted samples.',
              sampleCount: 5,
              source: 'data/teddy-house/wan-history.json'
            }
          ]
        }
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({
      status: 'complete',
      dryRun: true,
      answer: expect.stringContaining('Dry run ready')
    }));
    expect(data.promptPreview).toContain('What should I check first?');
    expect(data.promptPreview).toContain('WAN: 120 ms');
    expect(data.promptPreview).toContain('Dashboard context');
    expect(data.promptPreview).toContain('WAN latency');
    expect(data.promptPreview).toContain('data/teddy-house/wan-history.json');
  });

  it('prepares fixes as read-only plans with explicit approval language', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: true,
        action: 'prepare-fix',
        prompt: 'Prepare a dry-run fix plan for Automation logs: Govee connection degraded.',
        clicked: { type: 'review', label: 'Automation logs: Govee connection degraded' },
        context: {
          score: 78,
          needsDan: ['Automation logs: Govee connection degraded'],
          houseState: {
            headline: 'Homebase found an issue.',
            tone: 'issue',
            primaryAction: 'Start with automations.'
          },
          intelligence: {
            serviceLogs: { state: 'bad', value: 'Govee connection degraded', detail: 'Govee sync failed repeatedly.' }
          }
        }
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('complete');
    expect(data.dryRun).toBe(true);
    expect(data.promptPreview).toContain('Action: prepare-fix');
    expect(data.promptPreview).toContain('dry-run plan only');
    expect(data.promptPreview).toContain('Do not change files, services, routes, Tailscale, Homebridge, AdGuard, or OpenClaw state.');
    expect(data.promptPreview).toContain('exact approval needed');
    expect(data.promptPreview).not.toMatch(/launchctl|tailscale serve|hb-service restart|npm install|sudo\s+/);
  });

  it('can answer Ask Teddy locally for offline tests', async () => {
    const localAsk = await startServer({ env: { TEDDY_HOMEBASE_ASK_LOCAL_ONLY: '1' } });
    try {
      const res = await fetch(`${localAsk.baseUrl}/api/pages/teddy-house/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          prompt: 'What should I check first?',
          clicked: { type: 'review', label: 'External access: 8443, 10000' },
          context: {
            checkedAt: '2026-05-16T23:00:00.000Z',
            score: 91,
            needsDan: ['External access: 8443, 10000'],
            services: {
              adguard: { state: 'ok', metric: '12 ms' },
              homebridge: { state: 'ok', metric: '8581' },
              tailscale: { state: 'ok', metric: '100.64.0.1' },
              internet: { state: 'ok', metric: '18 ms' },
              openclaw: { state: 'ok', metric: '18789' }
            },
            intelligence: {
              tailscaleFunnel: { state: 'warn', metric: '8443, 10000', detail: '8443 is BlueBubbles exposed through Funnel.' }
            },
            historicalSummaries: [
              {
                id: 'public-access-routes',
                title: 'Public access',
                window: 'current',
                value: 'Known',
                detail: 'Route set last changed 2h ago.',
                sampleCount: 1,
                source: 'data/teddy-house/public-access-history.json'
              }
            ]
          }
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(expect.objectContaining({
        status: 'complete',
        source: 'local',
        answer: expect.stringContaining('Only review item: external access on 8443, 10000')
      }));
      expect(data.answer).toContain('External access: 8443, 10000');
      expect(data.answer).toContain('8443 is BlueBubbles exposed through Funnel.');
      expect(data.answer).toContain('Memory: Public access: Known.');
      expect(data.answer.split('\n').length).toBeLessThanOrEqual(4);
      expect(data.answer).not.toContain('Review lane');
      expect(data.answer).not.toContain('macOS reports no available updates');
      expect(data.answer).not.toContain('DNS: ok');
      expect(data.answer).not.toContain('Homebridge: ok');

      const steadyRes = await fetch(`${localAsk.baseUrl}/api/pages/teddy-house/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          prompt: 'What should I check first?',
          context: {
            score: 100,
            needsDan: [],
            houseState: {
              headline: "Dan's house is steady.",
              summary: 'Internet, automations, public access, and the Mac mini are quiet.',
              tone: 'steady',
              primaryAction: 'No review items.'
            },
            intelligence: {
              tailscaleFunnel: { state: 'info', metric: '8443, 10000', detail: 'Known public routes are accounted for.' }
            },
            historicalSummaries: [
              {
                id: 'mac-boot-7d',
                title: 'Mac boot',
                window: '7d',
                value: 'Current boot stable',
                detail: 'Current boot started 5d ago.',
                sampleCount: 1,
                source: 'data/teddy-house/boot-history.json'
              }
            ]
          }
        })
      });
      const steadyData = await steadyRes.json();
      expect(steadyData.answer).toContain('No review item is currently called out.');
      expect(steadyData.answer).toContain('nothing needs action right now');
      expect(steadyData.answer).not.toContain('Memory:');
      expect(steadyData.answer).not.toContain('first ranked warning');
    } finally {
      await localAsk.kill();
    }
  });

  it('routes Ask Teddy through a fresh OpenClaw Teddy session by default', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ask-openclaw-stub-'));
    const stubPath = join(tmp, 'openclaw-stub.js');
    const argsPath = join(tmp, 'args.json');
    writeFileSync(stubPath, `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(process.env.TEDDY_STUB_ARGS_PATH, JSON.stringify(process.argv.slice(2), null, 2));
console.log(JSON.stringify({ status: 'ok', result: { payloads: [{ text: 'Teddy bridge live.' }] } }));
`);
    chmodSync(stubPath, 0o755);

    const bridgeAsk = await startServer({
      env: {
        TEDDY_HOMEBASE_OPENCLAW_BIN: stubPath,
        TEDDY_STUB_ARGS_PATH: argsPath,
        TEDDY_HOMEBASE_ASK_TIMEOUT_MS: '2000'
      }
    });
    try {
      const res = await fetch(`${bridgeAsk.baseUrl}/api/pages/teddy-house/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'status',
          prompt: 'What matters right now?',
          context: {
            score: 100,
            houseState: {
              headline: "Dan's house is steady.",
              summary: 'Internet, automations, public access, and the Mac mini are quiet.',
              tone: 'steady',
              primaryAction: 'No review items.',
              zones: [
                { id: 'network', title: 'Internet', state: 'ok', value: 'Normal', detail: 'Internet is responding.' }
              ]
            },
            needsDan: ['External access: 8443, 10000'],
            services: {
              openclaw: { state: 'ok', metric: '127.0.0.1' }
            }
          }
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(expect.objectContaining({
        status: 'complete',
        source: 'teddy',
        answer: 'Teddy bridge live.'
      }));

      const args = JSON.parse(readFileSync(argsPath, 'utf8'));
      expect(args).toContain('agent');
      expect(args).toContain('--agent');
      expect(args).toContain('main');
      expect(args).toContain('--session-id');
      expect(args[args.indexOf('--session-id') + 1]).toMatch(/^teddy-homebase-ask-/);
      expect(args).toContain('--json');
      expect(args.join(' ')).toContain('Use available OpenClaw MCP context');
      expect(args.join(' ')).toContain('Dashboard context');
      expect(args.join(' ')).toContain('source of truth');
      expect(args.join(' ')).toContain("Dan's house is steady.");
    } finally {
      await bridgeAsk.kill();
    }
  });

  it('falls back when Ask Teddy leaves the Homebase context', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ask-openclaw-escape-'));
    const stubPath = join(tmp, 'openclaw-stub.js');
    writeFileSync(stubPath, `#!/usr/bin/env node
console.log(JSON.stringify({ status: 'ok', result: { payloads: [{ text: 'Check Axon pipeline and Maria birthday.' }] } }));
`);
    chmodSync(stubPath, 0o755);

    const bridgeAsk = await startServer({
      env: {
        TEDDY_HOMEBASE_OPENCLAW_BIN: stubPath,
        TEDDY_HOMEBASE_ASK_TIMEOUT_MS: '2000'
      }
    });
    try {
      const res = await fetch(`${bridgeAsk.baseUrl}/api/pages/teddy-house/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          prompt: 'What should I check first?',
          context: {
            score: 100,
            needsDan: [],
            houseState: {
              headline: "Dan's house is steady.",
              summary: 'Internet, automations, public access, and the Mac mini are quiet.',
              tone: 'steady',
              primaryAction: 'No review items.'
            }
          }
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.source).toBe('local-fallback');
      expect(data.answer).toContain('Teddy bridge did not answer cleanly');
      expect(data.answer).toContain('No review item is currently called out.');
      expect(data.answer).not.toMatch(/Axon|Maria|birthday|pipeline/i);
    } finally {
      await bridgeAsk.kill();
    }
  });

  it('requires an Ask Teddy prompt unless the action is status', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true, action: 'ask', prompt: '' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('needs a question')
    }));
  });

  it('returns the dashboard health contract', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty('checkedAt');
    expect(data).toHaveProperty('score');
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.needsDan)).toBe(true);
    expect(Array.isArray(data.reviewEvidence)).toBe(true);
    expect(data.reviewEvidence.map(item => item.label)).toEqual(data.needsDan);
    for (const item of data.reviewEvidence) {
      expect(item).toEqual(expect.objectContaining({
        label: expect.any(String),
        state: expect.stringMatching(/^(warn|bad)$/),
        source: expect.any(String),
        confidence: expect.any(String),
        checkedAt: expect.any(String),
        freshness: expect.any(String)
      }));
      expect(new Date(item.checkedAt).getTime()).not.toBeNaN();
    }
    expect(data.vitals.health.cpu).toHaveProperty('review');
    expect(data.vitals.health.cpu.review).toBe(false);
    expect(data.vitals.health.cpu).toHaveProperty('peak6h');
    expect(data.vitals.health.cpu.secondary).toMatch(/^Peak \d+\.\d{2} \/ 6h$/);
    expect(data.vitals).toHaveProperty('vitalsHistory');
    expect(data.vitals.vitalsHistory.source).toBe('data/teddy-house/vitals-history.json');
    expect(data.needsDan.join('\n')).not.toMatch(/^CPU:/m);
    expect(data.vitals.health.memory).toHaveProperty('review');
    if (data.vitals.health.memory.review !== true) {
      expect(data.needsDan.join('\n')).not.toMatch(/^Memory:/m);
    }
    expect(data.vitals.health.disk).toHaveProperty('review');
    if (data.vitals.health.disk.review !== true) {
      expect(data.needsDan.join('\n')).not.toMatch(/^Disk:/m);
    }
    expect(data.services).toHaveProperty('adguard');
    expect(data.services).toHaveProperty('homebridge');
    expect(data.services).toHaveProperty('tailscale');
    expect(data.services).toHaveProperty('internet');
    expect(data.services).toHaveProperty('openclaw');
    expect(data.services).toHaveProperty('backups');
    expect(data.insights).toHaveProperty('teddySays');
    expect(Array.isArray(data.insights.cards)).toBe(true);
    expect(data).toHaveProperty('intelligence');
    expect(data.intelligence).toHaveProperty('adguard');
    expect(data.intelligence).toHaveProperty('homebridge');
    expect(data.intelligence.homebridge).toHaveProperty('accessories');
    expect(data.intelligence.homebridge).toHaveProperty('doorLocks');
    expect(data.intelligence.homebridge.doorLocks).toEqual(expect.objectContaining({
      state: 'info',
      value: 'ignored',
      detail: expect.any(String),
      confidence: 'degraded',
      hidden: true,
      items: expect.any(Array)
    }));
    expect(data.intelligence.homebridge.doorLocks.detail).not.toMatch(/^.*: unlocked, \d+% battery$/);
    expect(data.intelligence.homebridge.doorLocks.detail).not.toMatch(/\bunlocked\b/i);
    expect(data.needsDan.join('\n')).not.toMatch(/^Door locks:/m);
    expect(data.intelligence.homebridge).toHaveProperty('logHealth');
    expect(data.intelligence.homebridge.logHealth.detail).not.toMatch(/^\d+\s+recent warnings or errors\.$/);
    expect(data.needsDan.join('\n')).not.toMatch(/^Homebridge Log: \d+$/m);
    expect(data.intelligence.homebridge).toHaveProperty('version');
    expect(data.intelligence.homebridge.version.items.map(item => item.name)).toEqual(['Homebridge', 'Homebridge UI']);
    if (data.intelligence.homebridge.version.items[0].state === 'ok') {
      expect(data.intelligence.homebridge.version.state).not.toBe('warn');
    }
    expect(data.intelligence).toHaveProperty('tailscaleFunnel');
    expect(data.intelligence).toHaveProperty('publicAccess');
    expect(data.services.tailscale).toHaveProperty('confidence');
    expect(data.intelligence.tailscaleFunnel).toHaveProperty('confidence');
    expect(data.intelligence.publicAccess.source).toBe('Tailscale Funnel');
    expect(data.intelligence.publicAccess).toHaveProperty('acceptedRoutes');
    expect(data.intelligence.tailscaleFunnel.detail).not.toMatch(/Extra port detected/i);
    if (data.intelligence.tailscaleFunnel.metric.includes('8443')) {
      expect(data.intelligence.tailscaleFunnel.detail).toContain('BlueBubbles');
      expect(data.intelligence.publicAccess.acceptedRoutes.map(route => route.name)).toContain('BlueBubbles');
      expect(data.intelligence.publicAccess.unexpectedRoutes).toHaveLength(0);
      expect(data.intelligence.tailscaleFunnel.state).toBe('info');
      expect(data.needsDan.join('\n')).not.toMatch(/^External access:/m);
    }
    expect(data.intelligence).toHaveProperty('wanQuality');
    expect(data.intelligence).toHaveProperty('serviceLogs');
    expect(data.intelligence.serviceLogs).toEqual(expect.objectContaining({
      state: expect.any(String),
      value: expect.any(String),
      detail: expect.any(String),
      items: expect.any(Array)
    }));
    expect(data.intelligence).toHaveProperty('softwareUpdates');
    expect(data.intelligence.softwareUpdates).toHaveProperty('items');
    expect(Array.isArray(data.intelligence.softwareUpdates.items)).toBe(true);
    expect(data.intelligence).toHaveProperty('macUpdates');
    expect(data.intelligence.macUpdates).toHaveProperty('checkedAt');
    expect(data.intelligence).toHaveProperty('systemLogs');
    expect(data.intelligence.systemLogs.detail).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(Array.isArray(data.intelligence.weirdThings)).toBe(true);
    expect(data).toHaveProperty('visualEvidence');
    expect(data).toHaveProperty('houseState');
    expect(data).toHaveProperty('dailyDecision');
    expect(data.dailyDecision.slots.map(slot => slot.key)).toEqual(['now', 'watch', 'later']);
    expect(data.dailyDecision.slots.map(slot => slot.label)).toEqual(['Now', 'Watch', 'Later']);
    expect(JSON.stringify(data.dailyDecision.slots)).not.toMatch(/Eufy|Door locks|Garage side door|Front Door|Side Door/i);
    expect(JSON.stringify(data.dailyDecision.slots)).not.toMatch(/\b(?:bad|warn|ok)\s*->\s*(?:bad|warn|ok)\b/i);
    if (data.needsDan.length === 0) {
      expect(data.dailyDecision.slots[0].text).toBe('Nothing needs Dan.');
      expect(data.dailyDecision.slots[0].text).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d{2,5},\s*\d{2,5}\b|\b(?:\d+\.){2,}\d+\b|\b\d+\s*(ms|warnings?|errors?|issues?|findings?)\b/i);
    }
    expect(data.houseState.headline).toEqual(expect.any(String));
    const zoneIds = data.houseState.zones.map(zone => zone.id);
    expect(new Set(zoneIds)).toEqual(new Set(['outside-access', 'network', 'smart-home', 'mac-mini']));
    if (data.houseState.incident) {
      expect(zoneIds[0]).toBe('mac-mini');
      expect(data.houseState.headline).toMatch(/Mac mini restarted/i);
    }
    expect(data.intelligence).not.toHaveProperty('androidDesk');
    expect(JSON.stringify(data.houseState.zones)).not.toMatch(/Android desk|Front Door|Side Door|Door locks/i);
    expect(data.visualEvidence).toHaveProperty('latest');
    expect(data.visualEvidence.latest.visuals.readinessScore.type).toBe('computed-ring');
    expect(data.visualEvidence.latest.visuals.houseState.type).toBe('zone-state');
    expect(data.visualEvidence.latest.visuals.dailyDecision.type).toBe('decision-strip');
    expect(data.visualEvidence.latest.visuals.dailyDecision.inputs.map(slot => slot.key)).toEqual(['now', 'watch', 'later']);
    expect(new Set(data.visualEvidence.latest.visuals.houseState.inputs.map(zone => zone.id))).toEqual(new Set(data.presentation.defaultZoneKeys));
    expect(data.visualEvidence.latest.visuals.readinessScore.inputs).toHaveProperty('adguard');
    expect(data.visualEvidence.latest.visuals.signalGrid.inputs).toHaveProperty('wanQuality');
    expect(data.visualEvidence.latest.visuals.dependencyMap.type).toBe('static-topology');
    expect(data).toHaveProperty('presentation');
    expect(data.presentation.defaultServiceKeys).toEqual(['adguard', 'homebridge', 'tailscale', 'internet', 'openclaw']);
    expect(data.presentation.defaultZoneKeys).toEqual(['outside-access', 'network', 'smart-home', 'mac-mini']);
    expect(data.presentation.hiddenByDefault.services).toContain('backups');
    expect(data.presentation.hiddenByDefault.signals).toContain('weirdThings');
    expect(data.presentation.hiddenByDefault.sections).toEqual(expect.arrayContaining(['readout', 'dependencyMap']));
    expect(data.vitals).toHaveProperty('memory');
    expect(data.vitals).toHaveProperty('health');
    expect(data.vitals.health.cpu).toEqual(expect.objectContaining({
      state: expect.any(String),
      detail: expect.any(String)
    }));
    const changes = data.houseState.recentChanges || [];
    const duplicateKeys = changes.map(event => `${event.title}|${event.detail}|${event.state}`);
    expect(new Set(duplicateKeys).size).toBe(duplicateKeys.length);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.timeline)).toBe(true);
  }, 12000);

  it('derives a house-language public-access rollup from Funnel state', () => {
    const accepted = teddyHouseInternals.publicAccessRollup({
      state: 'info',
      metric: '8443, 10000',
      detail: 'Known public routes: Teddy Homebase on 10000 and BlueBubbles on 8443.',
      confidence: 'live'
    });
    expect(accepted).toEqual(expect.objectContaining({
      state: 'info',
      value: 'Known',
      source: 'Tailscale Funnel'
    }));
    expect(accepted.acceptedRoutes.map(route => route.name)).toEqual(['BlueBubbles', 'Teddy Homebase']);
    expect(accepted.unexpectedRoutes).toHaveLength(0);

    const drift = teddyHouseInternals.publicAccessRollup({
      state: 'warn',
      metric: '10000, 12345',
      detail: '12345 proxies to a local service; confirm it should be public.',
      confidence: 'live'
    });
    expect(drift.state).toBe('warn');
    expect(drift.value).toBe('Needs review');
    expect(drift.unexpectedRoutes).toEqual([{ port: '12345', name: 'Unknown public route' }]);
    expect(drift.detail).toContain('12345');
  });

  it('keeps a persistent house timeline instead of only the last probe', async () => {
    const first = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(first.status).toBe(200);
    const firstData = await first.json();

    const second = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(second.status).toBe(200);
    const secondData = await second.json();

    expect(firstData.timeline.length).toBeGreaterThan(0);
    expect(secondData.timeline.length).toBeGreaterThan(0);
    expect(secondData.timeline[0]).toHaveProperty('at');
    expect(secondData.timeline[0]).toHaveProperty('title');
    expect(secondData.timeline[0]).toHaveProperty('detail');
    expect(secondData.timeline.length).toBeGreaterThanOrEqual(firstData.timeline.length);
  }, 16000);

  it('keeps resolved log warnings out of the house-state recent changes', async () => {
    const dataDir = join(srv.cwd, 'data', 'teddy-house');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'ok',
      detail: 'No recent panic, kernel, thermal, watchdog, disk, or corruption diagnostic reports.',
      metric: '0',
      check: 'System logs',
      confidence: 'live'
    }, null, 2));
    writeFileSync(join(dataDir, 'timeline.json'), JSON.stringify({
      events: [
        {
          at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          time: '9:57 PM',
          title: 'Service logs',
          detail: '130 service log signal changed.',
          state: 'warn'
        },
        {
          at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          time: '9:55 PM',
          title: 'System logs',
          detail: 'Recent Mac logs need attention.',
          state: 'warn'
        },
        {
          at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          time: '1:53 AM',
          title: 'adguard changed',
          detail: 'bad -> ok',
          state: 'warn'
        }
      ]
    }, null, 2));

    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intelligence.systemLogs.state).toBe('ok');
    expect(JSON.stringify(data.houseState.recentChanges)).not.toMatch(/System logs|Recent Mac logs need attention/);
    expect(JSON.stringify(data.houseState.recentChanges)).not.toMatch(/Service logs|service log signal changed/);
    expect(JSON.stringify(data.houseState.recentChanges)).not.toMatch(/adguard changed|bad -> ok/);
    expect(JSON.stringify(data.dailyDecision.slots)).not.toMatch(/System logs|Recent Mac logs need attention/);
    expect(JSON.stringify(data.dailyDecision.slots)).not.toMatch(/service log signal changed/);
    expect(data.timeline.some(event => event.title === 'Mac restart incident')).toBe(true);
  }, 12000);

  it('promotes active warnings into the daily decision Now slot', async () => {
    const dataDir = join(srv.cwd, 'data', 'teddy-house');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'warn',
      detail: '1 critical diagnostic report in the last 24 hours.',
      metric: '1',
      check: 'System logs',
      confidence: 'live'
    }, null, 2));

    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dailyDecision.slots[0]).toEqual(expect.objectContaining({
      key: 'now',
      label: 'Now',
      state: 'warn',
      source: 'Mac restart incident'
    }));
    expect(data.dailyDecision.slots[0].text).toBe('Review the Mac mini restart.');
    expect(data.dailyDecision.slots[0].text).not.toMatch(/\b1 critical\b/);

    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'ok',
      detail: 'No recent panic, kernel, thermal, watchdog, disk, or corruption diagnostic reports.',
      metric: '0',
      check: 'System logs',
      confidence: 'live'
    }, null, 2));
  }, 12000);

  it('promotes recent Mac restart incidents above lower-priority evidence', async () => {
    const dataDir = join(srv.cwd, 'data', 'teddy-house');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'warn',
      detail: 'WindowServer watchdog panic in the last 24 hours.',
      metric: '1',
      check: 'System logs',
      confidence: 'live',
      incident: {
        title: 'WindowServer watchdog panic',
        reports: [{ file: 'panic-base+socd-example.panic', kind: 'WindowServer watchdog panic' }],
        count: 1
      }
    }, null, 2));

    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.houseState.headline).toBe('Mac mini restarted this morning.');
    expect(data.houseState.summary).toBe('Start with the Mac mini restart; house services are online.');
    expect(data.houseState.zones[0]).toEqual(expect.objectContaining({
      id: 'mac-mini',
      detail: expect.stringContaining('WindowServer watchdog panic')
    }));
    expect(data.needsDan[0]).toBe('Mac restart incident');

    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'ok',
      detail: 'No recent panic, kernel, thermal, watchdog, disk, or corruption diagnostic reports.',
      metric: '0',
      check: 'System logs',
      confidence: 'live'
    }, null, 2));
  }, 12000);

  it('routes Homebridge and Govee service-log noise to Automations instead of Mac mini', () => {
    const { _internals } = require('../pages/teddy-house/api.cjs');
    const services = {
      adguard: { state: 'ok', metric: 'ok', detail: 'DNS is responding.' },
      homebridge: { state: 'ok', metric: '8581', detail: 'Homebridge responded.' },
      tailscale: { state: 'ok', metric: 'online', detail: 'Tailscale is online.' },
      internet: { state: 'ok', metric: 'ok', detail: 'Internet is responding.' },
      openclaw: { state: 'ok', metric: 'ok', detail: 'OpenClaw is responding.' },
      backups: { state: 'info', metric: 'ignored', detail: 'Backups are not part of daily state.' }
    };
    const serviceLogs = {
      checkedAt: new Date().toISOString(),
      state: 'bad',
      value: 'Govee connection degraded',
      metric: 'Govee connection degraded',
      label: 'needs review',
      detail: 'Govee connection degraded in the recent Homebridge log window.',
      confidence: 'live',
      source: 'local service logs',
      items: [
        {
          name: 'Homebridge',
          state: 'bad',
          issues: 180,
          issueLabel: 'Govee connection degraded',
          detail: 'Govee connection degraded in the recent Homebridge log window.'
        },
        {
          name: 'Homebase',
          state: 'ok',
          issues: 0,
          detail: 'Homebase log is quiet.'
        },
        {
          name: 'OpenClaw',
          state: 'ok',
          issues: 0,
          detail: 'OpenClaw log is quiet.'
        },
        {
          name: 'Tailscale',
          state: 'ok',
          issues: 0,
          detail: 'Tailscale status has no health warnings.'
        }
      ]
    };
    Object.assign(serviceLogs, _internals.domainServiceLogs(serviceLogs));
    const intelligence = {
      adguard: { state: 'info', metric: 'locked', detail: 'AdGuard stats need login.' },
      homebridge: {
        accessories: { state: 'ok', count: 103, detail: 'Accessories loaded.' },
        doorLocks: { state: 'info', hidden: true, value: 'ignored', detail: 'Door locks ignored.' },
        logHealth: { state: 'ok', metric: 'quiet', detail: 'Homebridge log below action threshold.' },
        version: { state: 'ok', metric: 'current', detail: 'Homebridge is current.' }
      },
      tailscaleFunnel: { state: 'info', metric: 'accepted', detail: 'Known public routes.' },
      wanQuality: { state: 'ok', metric: 'normal', detail: 'WAN is normal.' },
      serviceLogs,
      automationLogs: serviceLogs.automationLogs,
      macMiniLogs: serviceLogs.macMiniLogs,
      networkLogs: serviceLogs.networkLogs,
      softwareUpdates: { state: 'ok', metric: 'current', detail: 'Apps are current.' },
      macUpdates: { state: 'ok', metric: 'current', detail: 'macOS is current.' },
      systemLogs: { state: 'ok', metric: '0', detail: 'No critical system reports.' },
      weirdThings: []
    };
    const systemVitals = {
      uptimeSeconds: 8 * 24 * 60 * 60,
      health: {
        cpu: { state: 'ok', metric: '2.0', detail: 'CPU normal.' },
        memory: { state: 'ok', metric: '60% free', detail: 'Memory normal.' },
        disk: { state: 'ok', metric: '12%', detail: 'Disk normal.' }
      }
    };
    const reviewItems = _internals.needsDan(services, intelligence, systemVitals);
    const score = _internals.scoreServices(services, intelligence, systemVitals);
    const houseState = _internals.deriveHouseState(services, intelligence, systemVitals, reviewItems, [], score);
    const decision = _internals.deriveDailyDecision(services, intelligence, systemVitals, reviewItems, houseState);

    expect(houseState.zones[0]).toEqual(expect.objectContaining({
      id: 'smart-home',
      state: 'bad',
      detail: expect.stringContaining('Govee connection degraded')
    }));
    expect(houseState.zones.find(zone => zone.id === 'mac-mini')).toEqual(expect.objectContaining({
      state: 'ok'
    }));
    expect(reviewItems[0]).toBe('Automation logs: Govee connection degraded');
    expect(decision.slots[0]).toEqual(expect.objectContaining({
      source: 'Automation logs',
      text: 'Check automations first.'
    }));
  });

  it('normalizes repeated system-log timeline entries into one incident lane', async () => {
    const dataDir = join(srv.cwd, 'data', 'teddy-house');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'warn',
      detail: 'WindowServer watchdog panic in the last 24 hours.',
      metric: '1',
      check: 'System logs',
      confidence: 'live',
      incident: {
        title: 'WindowServer watchdog panic',
        reports: [{ file: 'panic-base+socd-example.panic', kind: 'WindowServer watchdog panic' }],
        count: 1
      }
    }, null, 2));
    writeFileSync(join(dataDir, 'timeline.json'), JSON.stringify({
      events: [
        {
          at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          time: '9:57 PM',
          title: 'System logs',
          detail: 'Recent Mac logs need attention.',
          state: 'warn'
        }
      ]
    }, null, 2));

    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const incidentEvents = data.timeline.filter(event => event.title === 'Mac restart incident');
    expect(incidentEvents).toHaveLength(1);
    expect(JSON.stringify(data.timeline)).not.toMatch(/Recent Mac logs need attention|System logs/);

    writeFileSync(join(dataDir, 'system-logs.json'), JSON.stringify({
      checkedAt: new Date().toISOString(),
      schema: 'system-logs-v4',
      state: 'ok',
      detail: 'No recent panic, kernel, thermal, watchdog, disk, or corruption diagnostic reports.',
      metric: '0',
      check: 'System logs',
      confidence: 'live'
    }, null, 2));
  }, 12000);

  it('keeps default graphs backed by real health signals', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const visuals = data.visualEvidence.latest.visuals;

    expect(visuals.serviceGrid.type).toBe('probe-cards');
    expect(visuals.houseState.type).toBe('zone-state');
    expect(visuals.houseState.defaultKeys).toEqual(data.presentation.defaultZoneKeys);
    expect(visuals.houseState.inputs).toHaveLength(4);
    expect(visuals.serviceGrid.defaultKeys).toEqual(data.presentation.defaultServiceKeys);
    expect(Object.keys(visuals.serviceGrid.inputs)).toEqual(data.presentation.defaultServiceKeys);
    for (const key of data.presentation.defaultServiceKeys) {
      expect(visuals.serviceGrid.inputs[key]).toEqual(expect.objectContaining({
        state: expect.any(String),
        check: expect.any(String)
      }));
    }

    expect(visuals.signalGrid.type).toBe('metric-cards');
    expect(visuals.signalGrid.defaultKeys).toEqual(data.presentation.defaultSignalKeys);
    expect(data.presentation.defaultSignalKeys).toEqual([
      'adguardBlocks',
      'homebridgeAccessories',
      'homebridgeLogs',
      'publicFunnel',
      'wanQuality',
      'serviceLogs',
      'softwareUpdates',
      'macUpdates',
      'systemLogs'
    ]);
    for (const key of data.presentation.defaultSignalKeys) {
      expect(visuals.signalGrid.inputs[key]).toBeTruthy();
    }
    expect(visuals.signalGrid.inputs.weirdThings).toEqual(expect.any(Number));
    expect(visuals.timeline.source).toBe('data/teddy-house/timeline.json');
  }, 12000);

  it('backs every visible history-style metric with persisted source evidence', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const visuals = data.visualEvidence.latest.visuals;

    expect(data.vitals.health.cpu.secondary).toMatch(/^Peak \d+\.\d{2} \/ 6h$/);
    expect(data.vitals.vitalsHistory).toEqual(expect.objectContaining({
      window: '6h',
      source: 'data/teddy-house/vitals-history.json',
      scopedToBoot: expect.any(Boolean),
      samples: expect.any(Number),
      lastSampleAt: expect.any(String)
    }));
    expect(data.vitals.vitalsHistory.samples).toBeGreaterThan(0);
    expect(visuals.vitalsGrid.inputs.vitalsHistory.source).toBe('data/teddy-house/vitals-history.json');
    expect(visuals.vitalsGrid.inputs.vitalsHistory.window).toBe('6h');
    expect(visuals.vitalsGrid.inputs.vitalsHistory.samples).toBeGreaterThan(0);
    expect(visuals.timeline.type).toBe('persistent-events');
    expect(visuals.timeline.source).toBe('data/teddy-house/timeline.json');
    expect(visuals.timeline.count).toBe(data.timeline.length);
    expect(Array.isArray(data.historicalSummaries)).toBe(true);
    expect(data.historicalSummaries.length).toBeGreaterThanOrEqual(6);
    const cpuSummary = data.historicalSummaries.find(summary => summary.id === 'cpu-peak-6h');
    expect(cpuSummary).toEqual(expect.objectContaining({
      title: 'CPU peak',
      window: '6h',
      source: 'data/teddy-house/vitals-history.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    expect(cpuSummary.sampleCount).toBeGreaterThan(0);
    expect(new Date(cpuSummary.checkedAt).getTime()).not.toBeNaN();
    const bootSummary = data.historicalSummaries.find(summary => summary.id === 'mac-boot-7d');
    expect(bootSummary).toEqual(expect.objectContaining({
      title: 'Mac boot',
      window: '7d',
      source: 'data/teddy-house/boot-history.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      restartCount7d: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    expect(bootSummary.sampleCount).toBeGreaterThan(0);
    expect(new Date(bootSummary.checkedAt).getTime()).not.toBeNaN();
    expect(data.vitals.bootHistory).toEqual(expect.objectContaining({
      window: '7d',
      source: 'data/teddy-house/boot-history.json',
      sampleCount: expect.any(Number),
      restartCount7d: expect.any(Number),
      lastSeenAt: expect.any(String)
    }));
    const changesSummary = data.historicalSummaries.find(summary => summary.id === 'house-changes-24h');
    expect(changesSummary).toEqual(expect.objectContaining({
      title: 'House changes',
      window: '24h',
      source: 'data/teddy-house/timeline.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      meaningfulCount: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    const wanSummary = data.historicalSummaries.find(summary => summary.id === 'wan-latency-24h');
    expect(wanSummary).toEqual(expect.objectContaining({
      title: 'WAN latency',
      window: '24h',
      source: 'data/teddy-house/wan-history.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    expect(wanSummary.sampleCount).toBeGreaterThan(0);
    expect(new Date(wanSummary.checkedAt).getTime()).not.toBeNaN();
    expect(data.intelligence.wanQuality.wanHistory).toEqual(expect.objectContaining({
      window: '24h',
      source: 'data/teddy-house/wan-history.json',
      sampleCount: expect.any(Number),
      lastSampleAt: expect.any(String)
    }));
    const publicAccessSummary = data.historicalSummaries.find(summary => summary.id === 'public-access-routes');
    expect(publicAccessSummary).toEqual(expect.objectContaining({
      title: 'Public access',
      window: 'current',
      source: 'data/teddy-house/public-access-history.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    expect(publicAccessSummary.sampleCount).toBeGreaterThan(0);
    expect(data.intelligence.publicAccess.publicAccessHistory).toEqual(expect.objectContaining({
      window: 'current',
      source: 'data/teddy-house/public-access-history.json',
      sampleCount: expect.any(Number),
      currentLabel: expect.any(String)
    }));
    const automationSummary = data.historicalSummaries.find(summary => summary.id === 'automation-log-state');
    expect(automationSummary).toEqual(expect.objectContaining({
      title: 'Automation logs',
      window: 'current',
      source: 'data/teddy-house/automation-log-history.json',
      confidence: 'persisted',
      sampleCount: expect.any(Number),
      issueCount: expect.any(Number),
      checkedAt: expect.any(String),
      freshness: expect.any(String)
    }));
    expect(automationSummary.sampleCount).toBeGreaterThan(0);
    expect(data.intelligence.automationLogs.automationLogHistory).toEqual(expect.objectContaining({
      window: 'current',
      source: 'data/teddy-house/automation-log-history.json',
      sampleCount: expect.any(Number),
      currentLabel: expect.any(String)
    }));
    expect(visuals.historicalSummaries).toEqual(expect.objectContaining({
      type: 'persisted-summaries',
      count: data.historicalSummaries.length,
      inputs: data.historicalSummaries
    }));
    for (const summary of visuals.historicalSummaries.inputs) {
      expect(summary.source).toMatch(/^data\/teddy-house\//);
      expect(summary.window).toMatch(/^(6h|7d|24h|current)$/);
      expect(summary.sampleCount).toEqual(expect.any(Number));
      expect(summary.freshness).toEqual(expect.any(String));
    }
  }, 12000);

  it('keeps the default dashboard view quiet', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');

    expect(html).not.toContain('class="insight-band"');
    expect(html).not.toContain('Readout');
    expect(html).not.toContain('class="panel map-panel"');
    expect(script).not.toContain('["backups", "Backups"]');
    expect(script).not.toContain('renderInsights(data.insights)');
    expect(script).toContain('if (weirdFindings.length > 0)');
  });

  it('keeps a guard for the noisy Family Room Credenza TP-Link loop', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain('Family Room Credenza');
    expect(api).toContain('192\\.168\\.7\\.242');
    expect(api).toContain('TP-Link loop');
    expect(api).toContain('keep it excluded or fix the device network');
  });

  it('keeps orphaned Focus Room out of Homebase', async () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');

    expect(html).not.toContain('href="/pages/focus-room/"');
    expect(html).not.toContain('teddy-focus-room-preview.mp4');

    const page = await fetch(`${srv.baseUrl}/pages/focus-room/`);
    expect(page.status).toBe(404);

    const asset = await fetch(`${srv.baseUrl}/pages/focus-room/teddy-focus-room-preview.mp4`);
    expect(asset.status).toBe(404);
  });

  it('keeps Teddy personality restrained in the dashboard shell', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'pages/teddy-house/style.css'), 'utf8');

    expect(html).toContain('Teddy Homebase');
    expect(html).toContain('Private status');
    expect(html).toContain('class="teddy-card"');
    expect(html).not.toContain('class="teddy-mode"');
    expect(html).not.toContain('class="teddy-hero"');
    expect(css).not.toContain('--honey');
    expect(css).not.toContain('.teddy-hero');
    expect(css).not.toContain('.teddy-says-top');
  });

  it('keeps the pinned dashboard responsive for iPad and iPhone', () => {
    const css = readFileSync(join(process.cwd(), 'pages/teddy-house/style.css'), 'utf8');

    expect(css).toContain('min-height: 100dvh');
    expect(css).toContain('@media (max-width: 1240px)');
    expect(css).toContain('@media (max-width: 860px)');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.service-grid,[\s\S]*\.signal-grid,[\s\S]*\.vitals-grid[\s\S]*grid-template-columns: 1fr;/);
  });

  it('does not classify ordinary diagnostic filenames as critical I/O reports', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain('function isCriticalDiagnosticReport');
    expect(api).toContain('i\\/o|\\bi[-_ ]?o\\b');
    expect(api).not.toContain('disk|io|i\\/o');
  });

  it('keeps Homebridge service-log counts tied to dated top-level entries', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain('requireDate: true');
    expect(api).toContain('ignorePattern: /\\[EufySecurity\\]/i');
    expect(api).toContain('Govee connection degraded');
    expect(api).toContain('issueLabel');
  });

  it('segments vitals history by the current Mac boot session', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain('uptimeSeconds');
    expect(api).toContain('bootedAt');
    expect(api).toContain('scopedToBoot');
  });

  it('keeps routine app update availability out of the health warning path', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain("state: gitState.state === 'warn' ? 'warn' : updatesAvailable > 0 ? 'info' : 'ok'");
    expect(api).toContain("state: gitState.state === 'warn' ? 'warn' : cachedUpdates > 0 ? 'info' : 'ok'");
    expect(api).toContain('function reconcileCachedSoftwareItems');
    expect(api).toContain('updateItemFromInstalled');
    expect(api).not.toContain("updatesAvailable > 0 || gitState.state === 'warn' ? 'warn' : 'ok'");
  });

  it('reads the active OpenClaw log before older fallback logs', () => {
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(api).toContain('function openClawLogCandidates');
    expect(api).toContain('/tmp/openclaw/openclaw-${localDateStamp(0)}.log');
    expect(api).toContain('logFileSummary(\'OpenClaw\', openClawLogCandidates()');
    expect(api).toContain('JSON.parse(text)');
    expect(api).toContain('function logLineMessage');
    expect(api).toContain('payload.message || payload[1] || payload[0]');
  });

  it('keeps empty dashboard sections hidden until health data loads', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'pages/teddy-house/style.css'), 'utf8');
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');

    expect(html).toContain('<body class="homebase-loading">');
    expect(html).toContain('house-state-panel hidden-until-loaded');
    expect(html).toContain('evidence-panel hidden-until-loaded');
    expect(html).toContain('signals-panel hidden-until-loaded');
    expect(html).toContain('lower-grid hidden-until-loaded');
    expect(css).toContain('.homebase-loading .hidden-until-loaded');
    expect(script).toContain('function setLoadedState');
    expect(script).toContain('setLoadedState(true)');
    expect(script).toContain('setLoadedState(false)');
  });

  it('keeps dashboard copy quiet and direct', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(html).toContain('Checking the house');
    expect(html).toContain('Waiting for first check');
    expect(html).toContain('Internet, automations, public access, and the Mac mini.');
    expect(html).toContain('Running checks');
    expect(html).toContain('Ask about this status');
    expect(html).toContain('Ask what changed, what matters, or what to check first.');
    expect(html).toContain('placeholder="Ask what changed, what matters, or what to check first."');
    expect(html).toContain('House State');
    expect(html).toContain('Daily state');
    expect(html).toContain('Evidence signals');
    expect(html).toContain('Mac vitals');
    expect(html).toContain('Core service health');
    expect(html).toContain('Readiness');
    expect(html).toContain('Private');
    expect(html).not.toContain('Not checked yet');
    expect(html).not.toContain('Checking status.');
    expect(html).not.toContain('Network, automation, and Mac mini signals.');
    expect(html).not.toContain('Preparing report.');
    expect(html).not.toContain('Bring the dashboard with you.');
    expect(html).not.toContain('Ask a question or send the current status.');
    expect(html).not.toContain('Deep signals');
    expect(html).not.toContain('Persistent truth');
    expect(html).not.toContain('Protected');
    expect(script).toContain("Dan's house is steady.");
    expect(script).toContain('Clear for now.');
    expect(script).toContain('Start with');
    expect(script).toContain('Online');
    expect(script).toContain('to review');
    expect(script).toContain('DNS blocks');
    expect(script).toContain("What's exposed");
    expect(script).toContain('House devices');
    expect(script).toContain('Homebridge version');
    expect(script).toContain('App versions');
    expect(script).toContain('System logs');
    expect(script).not.toMatch(/needs eyes|worth eyes/i);
    expect(script).not.toMatch(/Everything important|Nothing to do|Live reads|Real data/i);
    expect(script).not.toContain('No action needed.');
    expect(script).not.toContain('Review the flagged item.');
    expect(script).not.toContain('Getting the latest dashboard status first...');
    expect(script).not.toContain('return "Good"');
    expect(script).not.toContain('Readiness is');
    expect(script).not.toContain('Review lane');
    expect(api).not.toContain('Openclaw');
    expect(script).not.toContain('Teddy could not finish the check.');
  });

  it('logs visual evidence for rendered score, cards, signals, and timeline', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    await res.json();

    const evidencePath = join(srv.cwd, 'data', 'teddy-house', 'visual-evidence.json');
    expect(existsSync(evidencePath)).toBe(true);
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    expect(Array.isArray(evidence.entries)).toBe(true);
    expect(evidence.entries.length).toBeGreaterThan(0);
    expect(evidence.entries[0].visuals.serviceGrid.source).toBe('live service checks');
    expect(evidence.entries[0].visuals.serviceGrid.hiddenKeys).toContain('backups');
    expect(evidence.entries[0].visuals.signalGrid.hiddenKeys).toContain('weirdThings');
    expect(evidence.entries[0].visuals.signalGrid.hiddenKeys).toContain('doorLocks');
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('doorLocks');
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('serviceLogs');
    expect(evidence.entries[0].visuals.serviceLogSources.inputs.length).toBeGreaterThan(0);
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('macUpdates');
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('systemLogs');
    expect(evidence.entries[0].visuals.vitalsGrid.inputs.vitalsHistory.source).toBe('data/teddy-house/vitals-history.json');
    expect(evidence.entries[0].visuals.vitalsGrid.inputs.health.cpu.secondary).toMatch(/^Peak \d+\.\d{2} \/ 6h$/);
    expect(evidence.entries[0].visuals.vitalsGrid.inputs.health.memory.detail).toMatch(/Memory/);
    expect(evidence.entries[0].visuals.timeline.source).toBe('data/teddy-house/timeline.json');
    expect(evidence.entries[0].visuals.historicalSummaries.type).toBe('persisted-summaries');
    expect(evidence.entries[0].visuals.historicalSummaries.inputs.every(summary => summary.source && summary.window)).toBe(true);
  }, 12000);

  it('does not render fake trend or sparkline charts', () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'pages/teddy-house/style.css'), 'utf8');

    expect(script).not.toMatch(/sparkline|SPARKS|trend/i);
    expect(css).not.toMatch(/sparkline/i);
  });

  it('keeps Time Machine parked out of the Dan action lane', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    const data = await res.json();

    expect(data.services.backups.state).toBe('info');
    expect(data.presentation.defaultServiceKeys).not.toContain('backups');
    expect(data.needsDan.join(' ')).not.toMatch(/backup|time machine/i);
  }, 12000);

  it('keeps hidden widgets available without making them default UI requirements', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const visuals = data.visualEvidence.latest.visuals;

    expect(data.services).toHaveProperty('backups');
    expect(Array.isArray(data.intelligence.weirdThings)).toBe(true);
    expect(data.insights).toHaveProperty('cards');
    expect(visuals.dependencyMap.inputs.length).toBeGreaterThan(0);

    expect(visuals.serviceGrid.inputs).not.toHaveProperty('backups');
    expect(visuals.insightGrid.defaultVisible).toBe(false);
    expect(visuals.dependencyMap.defaultVisible).toBe(false);
    expect(data.presentation.hiddenByDefault).toEqual({
      services: ['backups'],
      signals: ['doorLocks', 'weirdThings'],
      sections: ['readout', 'dependencyMap']
    });
  }, 12000);
});

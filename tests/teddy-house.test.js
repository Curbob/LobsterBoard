/**
 * Teddy Homebase custom page tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from '../helpers/server.js';

let srv;

beforeAll(async () => {
  srv = await startServer();
});

afterAll(async () => { if (srv) await srv.kill(); });

describe('Teddy Homebase page', () => {
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
  });

  it('links to the current Teddy Weather PWA and widget from Homebase', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/teddy-house/`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('id="weather"');
    expect(html).toContain('Teddy Weather');
    expect(html).toContain("Dan and Maria's Lafayette read.");
    expect(html).toContain('https://teddy-weather-kappa.vercel.app/?review=1');
    expect(html).toContain('https://teddy-weather-kappa.vercel.app/?review=1&amp;surface=widget');
    expect(html).toContain('Open Weather');
    expect(html).toContain('Open Widget');
    expect(html).not.toContain('https://teddy-weather.vercel.app');
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
    const locked = await startServer({ password: 'test-homebase-lock' });
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
          }
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
    expect(data.intelligence.homebridge).toHaveProperty('logHealth');
    expect(data.intelligence).toHaveProperty('tailscaleFunnel');
    expect(data.intelligence).toHaveProperty('wanQuality');
    expect(data.intelligence).toHaveProperty('softwareUpdates');
    expect(data.intelligence.softwareUpdates).toHaveProperty('items');
    expect(Array.isArray(data.intelligence.softwareUpdates.items)).toBe(true);
    expect(data.intelligence).toHaveProperty('macUpdates');
    expect(data.intelligence.macUpdates).toHaveProperty('checkedAt');
    expect(data.intelligence).toHaveProperty('systemLogs');
    expect(data.intelligence.systemLogs.detail).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(Array.isArray(data.intelligence.weirdThings)).toBe(true);
    expect(data).toHaveProperty('visualEvidence');
    expect(data.visualEvidence).toHaveProperty('latest');
    expect(data.visualEvidence.latest.visuals.readinessScore.type).toBe('computed-ring');
    expect(data.visualEvidence.latest.visuals.readinessScore.inputs).toHaveProperty('adguard');
    expect(data.visualEvidence.latest.visuals.signalGrid.inputs).toHaveProperty('wanQuality');
    expect(data.visualEvidence.latest.visuals.dependencyMap.type).toBe('static-topology');
    expect(data).toHaveProperty('presentation');
    expect(data.presentation.defaultServiceKeys).toEqual(['adguard', 'homebridge', 'tailscale', 'internet', 'openclaw']);
    expect(data.presentation.hiddenByDefault.services).toContain('backups');
    expect(data.presentation.hiddenByDefault.signals).toContain('weirdThings');
    expect(data.presentation.hiddenByDefault.sections).toEqual(expect.arrayContaining(['readout', 'dependencyMap']));
    expect(data.vitals).toHaveProperty('memory');
    expect(data.vitals).toHaveProperty('health');
    expect(data.vitals.health.cpu).toEqual(expect.objectContaining({
      state: expect.any(String),
      detail: expect.any(String)
    }));
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.timeline)).toBe(true);
  }, 12000);

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

  it('keeps default graphs backed by real health signals', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages/teddy-house/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const visuals = data.visualEvidence.latest.visuals;

    expect(visuals.serviceGrid.type).toBe('probe-cards');
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

  it('keeps dashboard copy quiet and direct', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const api = readFileSync(join(process.cwd(), 'pages/teddy-house/api.cjs'), 'utf8');

    expect(html).toContain('Checking status.');
    expect(html).toContain('Core service health');
    expect(html).toContain('Readiness');
    expect(html).toContain('No action needed.');
    expect(html).toContain('Private');
    expect(html).not.toContain('Deep signals');
    expect(html).not.toContain('Persistent truth');
    expect(html).not.toContain('Protected');
    expect(script).toContain('All core systems are online.');
    expect(script).toContain('No action needed.');
    expect(script).toContain('to review');
    expect(script).toContain('DNS blocks');
    expect(script).toContain('External access');
    expect(script).toContain('App versions');
    expect(script).toContain('System logs');
    expect(script).not.toMatch(/needs eyes|worth eyes/i);
    expect(script).not.toMatch(/Everything important|Nothing to do|Live reads|Real data/i);
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
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('macUpdates');
    expect(evidence.entries[0].visuals.signalGrid.inputs).toHaveProperty('systemLogs');
    expect(evidence.entries[0].visuals.vitalsGrid.inputs.health.memory.detail).toMatch(/Memory/);
    expect(evidence.entries[0].visuals.timeline.source).toBe('data/teddy-house/timeline.json');
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
      signals: ['weirdThings'],
      sections: ['readout', 'dependencyMap']
    });
  }, 12000);
});

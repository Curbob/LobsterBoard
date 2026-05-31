/**
 * Teddy Homebase design guardrails.
 *
 * These tests catch UI regressions that are easy to miss in API checks:
 * scaffold copy, noisy healthy cards, hidden loading sections, and Ask verbosity.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

function homebaseDom() {
  return new JSDOM(`<!doctype html>
    <body class="homebase-loading">
      <button id="refresh-button"></button>
      <form id="ask-form">
        <textarea id="ask-input"></textarea>
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
      <section id="daily-decision" class="decision-strip hidden-until-loaded">
        <article class="decision-slot" data-decision-slot="now">
          <p class="eyebrow"></p>
          <h3></h3>
        </article>
        <article class="decision-slot" data-decision-slot="watch">
          <p class="eyebrow"></p>
          <h3></h3>
        </article>
        <article class="decision-slot" data-decision-slot="later">
          <p class="eyebrow"></p>
          <h3></h3>
        </article>
      </section>
      <section id="review-lane" class="needs-lane">
        <div id="needs-title"></div>
        <div id="needs-list"></div>
      </section>
      <section id="house-state" class="house-state-panel hidden-until-loaded">
        <span id="house-state-pill"></span>
        <div id="house-zone-grid"></div>
      </section>
      <section id="server" class="vitals-panel hidden-until-loaded">
        <span id="vitals-pill"></span>
        <div id="vitals-grid"></div>
      </section>
      <section id="ask-teddy"></section>
      <section id="service-grid" class="service-grid hidden-until-loaded"></section>
      <section id="signals" class="signals-panel hidden-until-loaded">
        <h3 id="signals-title"></h3>
        <span class="state-pill"></span>
        <div id="signal-grid"></div>
      </section>
      <section id="history" class="history-panel hidden-until-loaded">
        <div id="history-grid"></div>
      </section>
      <section class="lower-grid hidden-until-loaded">
        <div id="events-list"></div>
      </section>
    </body>`, {
    url: 'http://127.0.0.1/pages/teddy-house/',
    runScripts: 'outside-only'
  });
}

function healthyWithOneWarning() {
  return {
    checkedAt: '2026-05-16T23:00:00.000Z',
    score: 100,
    needsDan: [],
    houseState: {
      headline: "Dan's house is steady.",
      summary: 'Internet, automations, public access, and the Mac mini are quiet.',
      tone: 'steady',
      primaryAction: 'No review items.',
      zones: [
        { id: 'outside-access', title: 'Public access', state: 'info', value: 'Known', detail: 'Expected public routes are accounted for.', evidence: ['Tailscale Funnel'] },
        { id: 'network', title: 'Internet', state: 'ok', value: 'Normal', detail: 'Internet, DNS, and Tailscale are responding.', evidence: ['Internet', 'DNS', 'Tailscale'] },
        { id: 'smart-home', title: 'Automations', state: 'ok', value: 'Responding', detail: 'Homebridge and accessories are responding.', evidence: ['Homebridge', 'Accessories'] },
        { id: 'mac-mini', title: 'Mac mini', state: 'ok', value: 'Healthy', detail: 'System checks, updates, and service logs are quiet.', evidence: ['OpenClaw', 'macOS'] }
      ],
      recentChanges: []
    },
    dailyDecision: {
      tone: 'steady',
      slots: [
        { key: 'now', label: 'Now', text: 'Nothing needs Dan.', state: 'ok', source: 'needsDan' },
        { key: 'watch', label: 'Watch', text: 'Public access is known and passworded.', state: 'info', source: 'tailscaleFunnel' },
        { key: 'later', label: 'Later', text: 'Homebridge UI has a patch update when convenient.', state: 'info', source: 'maintenance' }
      ]
    },
    services: {
      adguard: { state: 'ok', metric: '12 ms', check: 'DNS', detail: 'DNS answered.' },
      homebridge: { state: 'ok', metric: '8581', check: 'Port', detail: 'Homebridge answered.' },
      tailscale: { state: 'ok', metric: '100.64.0.1', check: 'Tailscale', detail: 'Tailscale online.' },
      internet: { state: 'ok', metric: '20 ms', check: 'WAN', detail: 'WAN is fine.' },
      openclaw: { state: 'ok', metric: '18789', check: 'Gateway', detail: 'Gateway is up.' }
    },
    vitals: {
      cpu: '7.0',
      memory: '96%',
      memoryPressure: '28% free',
      disk: '11%',
      uptime: '5d',
      network: 'local',
      host: 'mini',
      health: {
        cpu: { state: 'ok', detail: 'CPU normal.', peak6h: '8.20', secondary: 'Peak 8.20 / 6h' },
        memory: { state: 'ok', metric: '96%', displayMetric: '28% free', detail: 'Memory pressure looks normal: 28% free by macOS pressure check. 96% used includes cache.' },
        disk: { state: 'ok', detail: 'Disk normal.' }
      }
    },
    intelligence: {
      adguard: { state: 'info', value: 'locked', label: 'locked', detail: 'Blocked-query stats need the local AdGuard login.' },
      homebridge: {
        doorLocks: { state: 'ok', value: 'locked', label: '2 locks', detail: 'Front Door: locked. Side Door: locked.', items: [] },
        accessories: { state: 'ok', count: 102, detail: 'Accessories loaded.' },
        logHealth: { state: 'ok', value: '8', label: 'recent issues', detail: 'Recent log is quiet.' },
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
    historicalSummaries: [
      { id: 'cpu-peak-6h', title: 'CPU peak', window: '6h', value: 'Peak 8.20', detail: 'Scoped to the current Mac mini boot session.', sampleCount: 12, source: 'data/teddy-house/vitals-history.json', confidence: 'persisted', freshness: '2m ago' },
      { id: 'mac-boot-7d', title: 'Mac boot', window: '7d', value: 'Current boot stable', detail: 'Current boot started 5d ago.', sampleCount: 1, source: 'data/teddy-house/boot-history.json', confidence: 'persisted', freshness: '2m ago' },
      { id: 'wan-latency-24h', title: 'WAN latency', window: '24h', value: '20 ms now', detail: 'Worst check 32.0 ms across 8 persisted samples.', sampleCount: 8, source: 'data/teddy-house/wan-history.json', confidence: 'persisted', freshness: '2m ago' }
    ],
    timeline: []
  };
}

describe('Teddy Homebase design guardrails', () => {
  it('loads from one calm first-check state instead of showing empty dashboard chrome', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'pages/teddy-house/style.css'), 'utf8');

    expect(html).toContain('<body class="homebase-loading">');
    expect(html).toContain('Waiting for first check');
    expect(html).toContain('Checking the house');
    expect(html).toContain('Running checks');
    expect(html).toContain('house-state');
    expect(html).toContain('hidden-until-loaded');
    expect(css).toContain('.homebase-loading .hidden-until-loaded');

    [
      'Not checked yet',
      'Checking status.',
      'Preparing report.',
      'Bring the dashboard with you.',
      'Ask a question or send the current status.'
    ].forEach(copy => expect(html).not.toContain(copy));
  });

  it('keeps launcher shortcuts below the ranked health story', () => {
    const html = readFileSync(join(process.cwd(), 'pages/teddy-house/index.html'), 'utf8');

    const houseStateIndex = html.indexOf('id="house-state"');
    const vitalsIndex = html.indexOf('id="server"');
    const askIndex = html.indexOf('id="ask-teddy"');
    const evidenceIndex = html.indexOf('id="evidence"');
    const historyIndex = html.indexOf('id="history"');
    const timelineIndex = html.indexOf('id="timeline"');
    const localLinksIndex = html.indexOf('id="local-links"');

    expect(houseStateIndex).toBeGreaterThan(-1);
    expect(vitalsIndex).toBeGreaterThan(houseStateIndex);
    expect(askIndex).toBeGreaterThan(vitalsIndex);
    expect(evidenceIndex).toBeGreaterThan(askIndex);
    expect(historyIndex).toBeGreaterThan(evidenceIndex);
    expect(timelineIndex).toBeGreaterThan(historyIndex);
    expect(localLinksIndex).toBeGreaterThan(timelineIndex);
  });

  it('renders house state first and keeps service evidence subordinate', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = homebaseDom();
    const health = healthyWithOneWarning();

    dom.window.fetch = vi.fn(async url => {
      if (url === '/api/pages/teddy-house/health') return { ok: true, json: async () => health };
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const document = dom.window.document;
    expect(document.body.classList.contains('homebase-loading')).toBe(false);
    expect(document.getElementById('summary-title').textContent).toBe("Dan's house is steady.");
    expect(document.getElementById('review-lane').hidden).toBe(true);
    expect(document.getElementById('needs-list').textContent).toBe('');
    expect(document.querySelectorAll('#daily-decision .decision-slot')).toHaveLength(3);
    expect([...document.querySelectorAll('#daily-decision h3')].map(el => el.textContent)).toEqual([
      'Nothing needs Dan.',
      'Public access is known and passworded.',
      'Homebridge UI has a patch update when convenient.'
    ]);
    expect(document.getElementById('daily-decision').previousElementSibling.id).toBe('teddy-line');
    expect(document.getElementById('daily-decision').nextElementSibling.id).toBe('review-lane');
    expect(document.getElementById('daily-decision').textContent).not.toMatch(/Front Door|Side Door|Door locks|100\.64|8443, 10000|5\.22\.0/i);
    expect(document.querySelectorAll('.house-zone-card')).toHaveLength(4);
    expect([...document.querySelectorAll('#house-zone-grid .tiny-label')].map(el => el.textContent)).toEqual([
      'Public access',
      'Internet',
      'Automations',
      'Mac mini'
    ]);
    expect(document.getElementById('house-zone-grid').textContent).not.toMatch(/Front Door|Side Door|Door locks/i);
    expect(document.getElementById('server').previousElementSibling.id).toBe('house-state');
    expect(document.getElementById('server').nextElementSibling.id).toBe('ask-teddy');
    expect([...document.querySelectorAll('#vitals-grid .tiny-label')].map(el => el.textContent).slice(0, 3)).toEqual([
      'CPU load',
      'Memory pressure',
      'Disk used'
    ]);
    expect(document.querySelector('#vitals-grid .vital-detail').textContent).toBe('Peak 8.20 / 6h');
    expect(document.querySelectorAll('.service-card')).toHaveLength(5);
    expect(document.querySelectorAll('.service-detail')).toHaveLength(0);
    expect([...document.querySelectorAll('.service-card .tiny-label')].every(el => el.textContent === 'Online')).toBe(true);

    const signalDetails = [...document.querySelectorAll('.signal-card p')].map(el => el.textContent);
    expect(signalDetails).toEqual([
      'Blocked-query stats need the local AdGuard login.',
      'Homebridge is current at 2.0.2. Homebridge UI has a patch update available when convenient: 5.22.0 to 5.23.0.',
      'Known public routes: Teddy Homebase on 10000 and BlueBubbles on 8443.'
    ]);
    expect(signalDetails.join('\n')).not.toContain('WAN is fine');
    expect(signalDetails.join('\n')).not.toContain('Apps are current');
    expect(signalDetails.join('\n')).not.toContain('No updates');
    expect(signalDetails.join('\n')).not.toContain('Logs are quiet');
    expect([...document.querySelectorAll('#history-grid .tiny-label')].map(el => el.textContent)).toEqual([
      'CPU peak',
      'Mac boot',
      'WAN latency'
    ]);
    expect(document.getElementById('history-grid').textContent).toContain('Persisted');
    expect(document.getElementById('history-grid').textContent).toContain('8 samples');
    expect(document.getElementById('history-grid').textContent).toContain('2m ago');
    expect(document.getElementById('next-action').textContent).toBe('No review items.');
  });
});

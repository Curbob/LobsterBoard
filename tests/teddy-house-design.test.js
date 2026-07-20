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
      <div id="ask-progress" hidden>
        <div data-ask-step="context"></div>
        <div data-ask-step="teddy"></div>
        <div data-ask-step="approval"></div>
      </div>
      <div id="summary-title"></div>
      <div id="summary-copy"></div>
      <div id="health-score"></div>
      <div id="score-ring"></div>
      <div id="next-action"></div>
      <button id="primary-fix-button"></button>
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
      <div class="primary-grid hidden-until-loaded">
        <section id="house-state" class="house-state-panel">
          <span id="house-state-pill"></span>
          <div id="house-zone-grid"></div>
        </section>
        <section id="ask-teddy"></section>
      </div>
      <div class="context-grid hidden-until-loaded">
        <section id="home-stats" class="home-stats-panel">
          <span id="home-stats-pill"></span>
          <div id="home-stats-grid"></div>
        </section>
        <section id="server" class="vitals-panel">
          <span id="vitals-pill"></span>
          <div id="vitals-grid"></div>
        </section>
      </div>
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
      summary: 'Core services are responding. Public access is expected and passworded.',
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
      openclaw: { state: 'ok', metric: '18789', check: 'Gateway', detail: 'Gateway is up.' },
      teddycam: { state: 'ok', metric: 'H264 1280x720', check: 'Private camera', detail: 'Private tailnet camera lane is active.' }
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
    homeStats: {
      localTime: '9:44 PM',
      localDate: 'Sun, Jun 14',
      insideTemperature: '74°F',
      humidity: '48%',
      outsideTemperature: '68°F',
      weatherSummary: 'Clear',
      source: 'Homebridge: AIr Quality Monitor',
      freshness: 'Fresh 4m ago',
      indoorSource: 'Homebridge: AIr Quality Monitor',
      indoorFreshness: 'Fresh 4m ago',
      weatherSource: 'Local weather fallback'
    },
    intelligence: {
      adguard: { state: 'info', value: 'needs login', label: 'Needs login', detail: 'AdGuard blocked-query stats need the Teddy service login.', confidence: 'needs-login' },
      homebridge: {
        doorLocks: { state: 'ok', value: 'locked', label: '2 locks', detail: 'Front Door: locked. Side Door: locked.', items: [] },
        accessories: { state: 'ok', count: 102, detail: 'Accessories loaded.' },
        logHealth: { state: 'ok', value: '8', label: 'recent issues', detail: 'Recent log is quiet.' },
        version: { state: 'info', value: '1', label: 'optional UI update', detail: 'Homebridge is current at 2.0.2. Homebridge UI has a patch update available when convenient: 5.22.0 to 5.23.0.' }
      },
      tailscaleFunnel: { state: 'info', metric: '8443, 10000', check: 'Accepted access', detail: 'Known public routes: Teddy Homebase on 10000 and BlueBubbles on 8443.' },
      teddyCam: { state: 'ok', metric: 'H264 1280x720', check: 'Private camera', detail: 'Private tailnet camera lane is active.' },
      wanQuality: { state: 'ok', metric: '20 ms', check: 'WAN', detail: 'WAN is fine.' },
      serviceLogs: { state: 'ok', value: 'quiet', label: 'quiet', detail: 'Service logs are quiet.', items: [] },
      softwareUpdates: { state: 'ok', value: 'current', label: 'version check', detail: 'Apps are current.' },
      macUpdates: { state: 'ok', metric: 'current', check: 'macOS', detail: 'No updates.' },
      systemLogs: { state: 'ok', metric: '0', check: 'System logs', detail: 'Logs are quiet.' },
      weirdThings: []
    },
    historicalSummaries: [
      {
        id: 'cpu-peak-6h',
        title: 'CPU peak',
        window: '6h',
        value: 'Peak 8.20',
        detail: 'Scoped to the current Mac mini boot session.',
        sampleCount: 12,
        points: [
          { at: '2026-05-31T20:00:00.000Z', cpu: 2.1 },
          { at: '2026-05-31T20:05:00.000Z', cpu: 8.2 },
          { at: '2026-05-31T20:10:00.000Z', cpu: 4.6 }
        ],
        source: 'data/teddy-house/vitals-history.json',
        confidence: 'persisted',
        freshness: '2m ago'
      },
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

    const vitalsIndex = html.indexOf('id="server"');
    const dailyIndex = html.indexOf('id="daily-decision"');
    const houseStateIndex = html.indexOf('id="house-state"');
    const homeStatsIndex = html.indexOf('id="home-stats"');
    const askIndex = html.indexOf('id="ask-teddy"');
    const evidenceIndex = html.indexOf('id="evidence"');
    const historyIndex = html.indexOf('id="history"');
    const timelineIndex = html.indexOf('id="timeline"');
    const localLinksIndex = html.indexOf('id="local-links"');

    expect(houseStateIndex).toBeGreaterThan(-1);
    expect(vitalsIndex).toBeGreaterThan(-1);
    expect(dailyIndex).toBeLessThan(houseStateIndex);
    expect(houseStateIndex).toBeLessThan(askIndex);
    expect(askIndex).toBeLessThan(homeStatsIndex);
    expect(homeStatsIndex).toBeLessThan(vitalsIndex);
    expect(evidenceIndex).toBeGreaterThan(askIndex);
    expect(historyIndex).toBeGreaterThan(evidenceIndex);
    expect(timelineIndex).toBeGreaterThan(historyIndex);
    expect(localLinksIndex).toBeGreaterThan(timelineIndex);
  });

  it('renders decisions and actions first while keeping context and evidence subordinate', async () => {
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
    expect(document.getElementById('primary-fix-button').disabled).toBe(true);
    expect(document.getElementById('primary-fix-button').hidden).toBe(true);
    expect(document.getElementById('primary-fix-button').textContent).toBe('Ask Teddy to Fix');
    expect(document.getElementById('daily-decision').hidden).toBe(true);
    expect(document.querySelectorAll('#daily-decision .decision-slot')).toHaveLength(3);
    expect([...document.querySelectorAll('#daily-decision h3')].map(el => el.textContent)).toEqual([
      'Nothing needs Dan.',
      'Public access is known and passworded.',
      'Homebridge UI has a patch update when convenient.'
    ]);
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
    expect(document.getElementById('review-lane').nextElementSibling.classList.contains('primary-grid')).toBe(true);
    expect(document.getElementById('house-state').nextElementSibling.id).toBe('ask-teddy');
    expect(document.querySelector('.primary-grid').nextElementSibling.classList.contains('context-grid')).toBe(true);
    expect(document.getElementById('home-stats').nextElementSibling.id).toBe('server');
    expect([...document.querySelectorAll('#home-stats-grid .tiny-label')].map(el => el.textContent)).toEqual([
      'Home time',
      'Inside',
      'Humidity',
      'Outside',
      'Weather'
    ]);
    expect([...document.querySelectorAll('#vitals-grid .tiny-label')].map(el => el.textContent).slice(0, 3)).toEqual([
      'CPU load',
      'Memory pressure',
      'Disk used'
    ]);
    expect(document.querySelector('#vitals-grid .vital-detail').textContent).toBe('Peak 8.20 / 6h');
    expect(document.querySelectorAll('.service-card')).toHaveLength(6);
    expect(document.querySelectorAll('.service-detail')).toHaveLength(0);
    expect([...document.querySelectorAll('.service-card .tiny-label')].every(el => el.textContent === 'Online')).toBe(true);

    const signalDetails = [...document.querySelectorAll('.signal-card p')].map(el => el.textContent);
    expect(signalDetails).toEqual([
      'AdGuard blocked-query stats need the Teddy service login.',
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
    expect(document.querySelectorAll('#history-grid .history-sample')).toHaveLength(3);
    expect(document.querySelector('#history-grid .history-samples').getAttribute('aria-label')).toContain('data/teddy-house/vitals-history.json');
    expect(document.getElementById('next-action').textContent).toBe('No trusted signal needs review.');
  });

  it('enables the primary fix button only when a review item exists', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = homebaseDom();
    const health = healthyWithOneWarning();
    health.score = 45;
    health.needsDan = ['DNS: failed'];
    health.reviewEvidence = [{
      label: 'DNS: failed',
      source: 'AdGuard DNS probe',
      confidence: 'live',
      checkedAt: health.checkedAt
    }];
    health.houseState = {
      ...health.houseState,
      headline: 'Homebase found an issue.',
      summary: 'Recurring internet issue. Check DNS first.',
      tone: 'issue',
      primaryAction: 'Check DNS first.'
    };

    dom.window.fetch = vi.fn(async url => {
      if (url === '/api/pages/teddy-house/health') return { ok: true, json: async () => health };
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const button = dom.window.document.getElementById('primary-fix-button');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Ask Teddy to Fix');
    expect(button.title).toContain('DNS: failed');
  });

  it('targets the ranked incident when the evidence list has lower-level noise first', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = homebaseDom();
    const health = healthyWithOneWarning();
    let askBody = null;
    health.score = 63;
    health.needsDan = ['Tailscale: unknown', 'Network service logs: AdGuard'];
    health.reviewEvidence = [
      {
        label: 'Tailscale: unknown',
        source: 'tailscale status --json',
        confidence: 'live',
        checkedAt: health.checkedAt,
        detail: 'Tailscale state was unavailable.'
      },
      {
        label: 'Network service logs: AdGuard',
        source: 'local service logs',
        confidence: 'live',
        checkedAt: health.checkedAt,
        detail: 'AdGuard login errors appeared in recent logs.'
      }
    ];
    health.houseState = {
      ...health.houseState,
      headline: 'Something needs a look.',
      summary: 'Recurring public access issue. Check public access first.',
      tone: 'review',
      primaryAction: 'Check public access first.',
      incident: {
        title: 'Public route drift',
        source: 'Tailscale Funnel',
        detail: 'A public route changed and needs confirmation.',
        nextAction: 'Check public access first.'
      }
    };
    health.intelligence.networkLogs = {
      state: 'bad',
      value: 'AdGuard',
      detail: 'AdGuard login errors appeared in recent logs.',
      source: 'local service logs',
      items: Array.from({ length: 20 }, (_, index) => ({ line: `verbose log line ${index}` }))
    };

    dom.window.fetch = vi.fn(async (url, options = {}) => {
      if (url === '/api/pages/teddy-house/health') return { ok: true, json: async () => health };
      if (url === '/api/pages/teddy-house/ask') {
        askBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({ status: 'complete', source: 'teddy', answer: 'Dry-run plan ready.' }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const button = dom.window.document.getElementById('primary-fix-button');
    expect(button.disabled).toBe(false);
    expect(button.title).toContain('Public route drift');
    button.click();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    expect(askBody.action).toBe('prepare-fix');
    expect(askBody.clicked).toEqual({ type: 'primary-fix', label: 'Public route drift', source: 'Tailscale Funnel' });
    expect(askBody.prompt).toContain('Do not run commands or change settings');
    expect(askBody.prompt).toContain('Check public access first');
    expect(askBody.prompt).toContain('A public route changed and needs confirmation.');
    expect(JSON.stringify(askBody.context).length).toBeLessThan(8000);
    expect(askBody.context.houseState.incident.title).toBe('Public route drift');
    expect(askBody.context.intelligence.networkLogs.items).toBeUndefined();
  });

  it('keeps one network warning actionable while scoping Explain to its evidence', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = homebaseDom();
    const health = healthyWithOneWarning();
    let askBody = null;
    health.score = 92;
    health.needsDan = ['Network service logs: AdGuard'];
    health.reviewEvidence = [{
      label: 'Network service logs: AdGuard',
      source: 'local service logs',
      confidence: 'live',
      checkedAt: health.checkedAt,
      detail: 'AdGuard login errors appeared in recent logs.'
    }];
    health.historicalSummaries = [{
      title: 'Mac boot',
      value: 'Current boot stable',
      source: 'data/teddy-house/boot-history.json'
    }];
    health.houseState = {
      ...health.houseState,
      headline: 'Something needs a look.',
      summary: 'Network log evidence needs review.',
      tone: 'review',
      primaryAction: 'Check network service logs first.'
    };
    health.dailyDecision.slots[0] = {
      key: 'now',
      label: 'Now',
      text: 'Check network service logs first.',
      state: 'warn',
      source: 'networkLogs'
    };
    health.intelligence.networkLogs = {
      state: 'warn',
      value: 'AdGuard',
      detail: 'AdGuard login errors appeared in recent logs.'
    };
    health.intelligence.serviceLogs = {
      state: 'warn',
      value: 'AdGuard',
      label: 'review',
      detail: 'AdGuard login errors appeared in recent logs.'
    };

    dom.window.fetch = vi.fn(async (url, options = {}) => {
      if (url === '/api/pages/teddy-house/health') return { ok: true, json: async () => health };
      if (url === '/api/pages/teddy-house/ask') {
        askBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({ status: 'complete', source: 'local', answer: 'Focused explanation.' }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const serviceLogsCard = [...dom.window.document.querySelectorAll('.signal-card')]
      .find(card => card.querySelector('.tiny-label')?.textContent === 'Service logs');
    expect(serviceLogsCard.textContent).toContain('Covered by Review');
    expect(serviceLogsCard.textContent).not.toContain('AdGuard login errors appeared in recent logs.');
    expect(dom.window.document.getElementById('next-action').textContent).toBe('1 review item');

    dom.window.document.querySelector('#needs-list .ask-mini').click();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    expect(askBody.action).toBe('explain');
    expect(askBody.context.needsDan).toEqual(['Network service logs: AdGuard']);
    expect(askBody.context.reviewEvidence).toHaveLength(1);
    expect(askBody.context.historicalSummaries).toEqual([]);
    expect(Object.keys(askBody.context.services)).toEqual(['adguard', 'tailscale', 'internet']);
    expect(askBody.context.vitals).toBeNull();
    expect(dom.window.document.getElementById('ask-progress').hidden).toBe(true);
  });

  it('shows progress while Teddy is preparing a fix plan', async () => {
    const script = readFileSync(join(process.cwd(), 'pages/teddy-house/script.js'), 'utf8');
    const dom = homebaseDom();
    const health = healthyWithOneWarning();
    let resolveAsk;
    health.score = 78;
    health.needsDan = ['Public access: 443, 8443, 10000'];
    health.reviewEvidence = [{
      label: 'Public access: 443, 8443, 10000',
      source: 'Tailscale Funnel',
      confidence: 'live',
      checkedAt: health.checkedAt,
      detail: 'Unexpected public route detected.'
    }];
    health.houseState = {
      ...health.houseState,
      headline: 'Something needs a look.',
      summary: 'Recurring public access issue. Check public access first.',
      tone: 'review',
      primaryAction: 'Check public access first.',
      incident: {
        title: 'Public route drift',
        source: 'Tailscale Funnel',
        detail: 'Unexpected public route detected.',
        nextAction: 'Check public access first.'
      }
    };

    dom.window.fetch = vi.fn(async (url) => {
      if (url === '/api/pages/teddy-house/health') return { ok: true, json: async () => health };
      if (url === '/api/pages/teddy-house/ask') {
        return new Promise(resolve => {
          resolveAsk = () => resolve({ ok: true, json: async () => ({ status: 'complete', source: 'teddy', answer: 'Plan ready.' }) });
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    dom.window.eval(script);
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const button = dom.window.document.getElementById('primary-fix-button');
    button.click();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));

    const progress = dom.window.document.getElementById('ask-progress');
    expect(progress.hidden).toBe(false);
    expect(progress.dataset.phase).toBe('teddy');
    expect(button.textContent).toBe('Teddy is planning');
    expect(dom.window.document.querySelector('[data-ask-step="context"]').classList.contains('is-done')).toBe(true);
    expect(dom.window.document.querySelector('[data-ask-step="teddy"]').classList.contains('is-active')).toBe(true);

    resolveAsk();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    expect(progress.dataset.phase).toBe('done');
    expect(progress.dataset.source).toBe('teddy');
    expect(dom.window.document.querySelector('[data-ask-step="approval"]').classList.contains('is-done')).toBe(true);
    expect(button.textContent).toBe('Ask Teddy to Fix');
  });
});

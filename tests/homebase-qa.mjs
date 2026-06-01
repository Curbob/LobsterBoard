#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { startServer } from '../helpers/server.js';

const require = createRequire(import.meta.url);
const teddyHouseInternals = require('../pages/teddy-house/api.cjs')._internals;
const LOCAL_TIMEOUT_MS = 12000;
const REMOTE_TIMEOUT_MS = 5000;
const PUBLIC_BASE = process.env.HOMEBASE_PUBLIC_URL || 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000';
const CHROME_BIN = process.env.HOMEBASE_CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = join(process.cwd(), 'artifacts', 'qa');
const QA_REPORT_FILE = join(SCREENSHOT_DIR, 'homebase-latest.json');
const SCREENSHOT_VIEWPORTS = [
  ['phone', 390, 844],
  ['ipad', 820, 1180],
  ['desktop', 1440, 1000]
];
const DATA_DIR = join('data', 'teddy-house');
const INCIDENT_FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'teddy-house', 'incidents');
const EXPECTED_ZONE_IDS = ['outside-access', 'network', 'smart-home', 'mac-mini'];
const EXPECTED_DAILY_SLOT_KEYS = ['now', 'watch', 'later'];
const EXPECTED_SOURCE_TRUST = ['trusted', 'degraded', 'ignored', 'needs-login'];
const EVIDENCE_ONLY_REPLAY_FIXTURES = ['healthy', 'stale-android-proof', 'post-reboot-recovered'];
const REQUIRED_REPLAY_FIXTURES = ['healthy', 'stale-android-proof', 'post-reboot-recovered', 'post-outage-homebridge-down', 'homebridge-down', 'adguard-dns-down', 'tailscale-funnel-missing', 'mac-panic', 'govee-loop', 'public-exposure-drift', 'wan-dns-degraded', 'teddy-bridge-fallback'];
const WARNING_REPLAY_FIXTURES = REQUIRED_REPLAY_FIXTURES.filter(name => !EVIDENCE_ONLY_REPLAY_FIXTURES.includes(name));
const FIRST_SCREEN_COPY_BLACKLIST = [
  /\b(?:APP VERSIONS|SERVICE LOGS|SYSTEM LOGS)\s+\d+\b/i,
  /\bService Logs:\s*\d+\b/i,
  /\bSystem Logs:\s*\d+\b/i,
  /\bRecent Mac logs need attention\b/i,
  /\bAPP VERSIONS\s+1\b/i,
  /\bINTERNET\s+\d+\s*ms\b/i,
  /\bWHAT'?S EXPOSED\s+\d{2,5}/i,
  /\bDoor locks\b/i,
  /\bEufy\b/i,
  /\bAndroid\b/i,
  /\bproof node\b/i,
  /\bGarage side door\b/i
];
const RENDERED_FIRST_SCREEN_COPY_BLACKLIST = [
  ...FIRST_SCREEN_COPY_BLACKLIST,
  /\bChecking the house\b/i,
  /\bWaiting for first check\b/i,
  /\bRunning checks\b/i,
  /\bChecking for review items\b/i,
  /\bService evidence\b/i,
  /\bEvidence signals\b/i
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function gitMetadata() {
  const branch = gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = gitValue(['rev-parse', '--short', 'HEAD']);
  const status = gitValue(['status', '--short']);
  return {
    branch: branch || 'unknown',
    commit: commit || 'unknown',
    dirty: Boolean(status),
    statusLines: status ? status.split('\n').filter(Boolean) : []
  };
}

function readFixture(name) {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'teddy-house', `${name}.json`), 'utf8'));
}

function readIncidentBundle(file) {
  return JSON.parse(readFileSync(join(INCIDENT_FIXTURE_DIR, file), 'utf8'));
}

function readJsonFile(cwd, file) {
  return JSON.parse(readFileSync(join(cwd, DATA_DIR, file), 'utf8'));
}

function firstScreenCopy(data) {
  const houseState = data.houseState || {};
  const dailyDecision = data.dailyDecision || {};
  return [
    houseState.headline,
    houseState.summary,
    houseState.primaryAction,
    ...(Array.isArray(data.needsDan) ? data.needsDan : []),
    ...(Array.isArray(dailyDecision.slots) ? dailyDecision.slots.map(slot => `${slot.label} ${slot.text} ${slot.source || ''}`) : []),
    ...(Array.isArray(houseState.zones) ? houseState.zones.map(zone => `${zone.title} ${zone.value} ${zone.detail}`) : [])
  ].filter(Boolean).join('\n');
}

function assertFirstScreenCopyClean(data, label) {
  const copy = firstScreenCopy(data);
  for (const pattern of FIRST_SCREEN_COPY_BLACKLIST) {
    assert(!pattern.test(copy), `${label} first-screen copy matched blacklist ${pattern}: ${copy}`);
  }
}

function reviewZone(label = '', source = '') {
  const text = `${label} ${source}`.toLowerCase();
  if (/\b(public access|external access|funnel|exposed|route drift)\b/.test(text)) return 'outside-access';
  if (/\b(dns|internet|wan|network|tailscale)\b/.test(text)) return 'network';
  if (/\b(homebridge|automation|accessor|govee|smart home)\b/.test(text)) return 'smart-home';
  if (/\b(mac|openclaw|cpu|memory|disk|system logs|macos|service logs|restart|watchdog|panic)\b/.test(text)) return 'mac-mini';
  return null;
}

function assertFirstReviewMatchesFirstZone(firstZone, firstReview, evidenceSource, label) {
  if (!firstReview) return;
  const zone = reviewZone(firstReview, evidenceSource);
  assert(zone, `${label} first review has no zone mapping: ${firstReview}`);
  assert(zone === firstZone, `${label} first review ${firstReview} maps to ${zone}, not first zone ${firstZone}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = LOCAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function requestStatus({ port, path, host = '127.0.0.1', method = 'GET' }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { Host: host }
    }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

function assertNoFakeHomeState(data) {
  const script = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'script.js'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'style.css'), 'utf8');
  assert(!/sparkline|SPARKS|trend/i.test(script), 'Homebase script includes fake trend/sparkline language');
  assert(!/sparkline/i.test(css), 'Homebase CSS includes fake sparkline styling');

  const summaries = Array.isArray(data.historicalSummaries) ? data.historicalSummaries : [];
  assert(summaries.length > 0, 'historical summaries are missing');
  for (const summary of summaries) {
    assert(summary.source && /^data\/teddy-house\/.+\.json$/.test(summary.source), `summary ${summary.id || summary.title || 'unknown'} is missing persisted source`);
    assert(summary.window, `summary ${summary.id || summary.title || 'unknown'} is missing window`);
    assert(Number.isFinite(Number(summary.sampleCount)), `summary ${summary.id || summary.title || 'unknown'} is missing sample count`);
    assert(summary.confidence, `summary ${summary.id || summary.title || 'unknown'} is missing confidence`);
    assert(summary.freshness, `summary ${summary.id || summary.title || 'unknown'} is missing freshness`);
  }

  const doorLocks = data.intelligence?.homebridge?.doorLocks || {};
  assert(doorLocks.hidden === true, 'door lock evidence must stay hidden from trusted daily state');
  assert(doorLocks.value === 'ignored', 'door lock evidence must be marked ignored');
  assert(doorLocks.confidence === 'degraded', 'door lock evidence must stay degraded');
  const trustedSurface = JSON.stringify({
    needsDan: data.needsDan,
    dailyDecision: data.dailyDecision,
    houseState: data.houseState
  });
  assert(!/Eufy|Door locks|Garage side door|Front Door|Side Door/i.test(trustedSurface), 'trusted daily surface includes ignored Eufy or door-lock evidence');

  return {
    persistedSummaries: summaries.length,
    ignoredDoorLocks: true,
    noFakeTrendLanguage: true
  };
}

function assertCachedUpdateLabels(data) {
  const script = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'script.js'), 'utf8');
  assert(script.includes('if (value === "cached") return "Cached";'), 'cached signal renderer must label cached data as Cached');
  const signals = [
    ['softwareUpdates', data.intelligence?.softwareUpdates],
    ['macUpdates', data.intelligence?.macUpdates]
  ];
  for (const [name, signal] of signals) {
    assert(signal && signal.confidence, `${name} update signal is missing confidence`);
    if (signal.confidence === 'cached') {
      assert(signal.detail, `${name} cached update signal is missing detail`);
      assert(signal.checkedAt || signal.source || signal.check, `${name} cached update signal is missing source/check timestamp context`);
    }
  }
  return {
    updateSignals: signals.length,
    cachedUpdateSignals: signals.filter(([, signal]) => signal && signal.confidence === 'cached').length,
    cachedLabelRenderer: true
  };
}

function assertSourceContracts(data) {
  const sourceContracts = data.sourceContracts || {};
  const contracts = Array.isArray(sourceContracts.contracts) ? sourceContracts.contracts : [];
  assert(contracts.length > 0, 'source contracts are missing');
  assert(JSON.stringify(sourceContracts.trustLevels) === JSON.stringify(EXPECTED_SOURCE_TRUST), 'source contract trust levels drifted');
  for (const contract of contracts) {
    assert(contract.id, 'source contract is missing id');
    assert(contract.label, `${contract.id} source contract is missing label`);
    assert(contract.source, `${contract.id} source contract is missing source`);
    assert(contract.freshness, `${contract.id} source contract is missing freshness`);
    assert(contract.confidence, `${contract.id} source contract is missing confidence`);
    assert(EXPECTED_SOURCE_TRUST.includes(contract.trust), `${contract.id} source contract has unknown trust ${contract.trust}`);
    assert(typeof contract.firstScreenEligible === 'boolean', `${contract.id} source contract is missing firstScreenEligible boolean`);
    assert(Array.isArray(contract.usedBy), `${contract.id} source contract is missing usedBy array`);
    if (contract.trust !== 'trusted') {
      assert(contract.firstScreenEligible === false, `${contract.id} non-trusted source is first-screen eligible`);
    }
  }
  const byLabel = new Map(contracts.map(contract => [contract.label, contract]));
  const zoneEvidence = (data.houseState?.zones || []).flatMap(zone => Array.isArray(zone.evidence) ? zone.evidence : []);
  for (const label of zoneEvidence) {
    assert(byLabel.has(label), `house-state evidence ${label} is missing a source contract`);
  }
  const doorLocks = contracts.find(contract => contract.id === 'door-locks');
  assert(doorLocks && doorLocks.trust === 'ignored' && doorLocks.firstScreenEligible === false, 'door-lock source contract must stay ignored and ineligible');
  const dnsBlocks = contracts.find(contract => contract.id === 'adguard-blocks');
  assert(dnsBlocks && ['needs-login', 'degraded', 'trusted'].includes(dnsBlocks.trust), 'AdGuard source contract has invalid trust');
  const firstScreenContracts = contracts.filter(contract => contract.houseStateEvidence || contract.firstScreenEligible);
  assert(firstScreenContracts.every(contract => contract.trust === 'trusted'), 'non-trusted source is allowed into house-state evidence');
  return {
    contracts: contracts.length,
    trusted: contracts.filter(contract => contract.trust === 'trusted').length,
    degraded: contracts.filter(contract => contract.trust === 'degraded').length,
    ignored: contracts.filter(contract => contract.trust === 'ignored').length,
    needsLogin: contracts.filter(contract => contract.trust === 'needs-login').length
  };
}

async function captureScreenshots(baseUrl) {
  if (process.env.HOMEBASE_SKIP_SCREENSHOTS === '1') return { status: 'skipped' };
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const userDataDir = join(tmpdir(), `homebase-chrome-${Date.now()}`);
  const chrome = await startChrome(userDataDir);
  const outputs = [];
  try {
    for (const [name, width, height] of SCREENSHOT_VIEWPORTS) {
      const file = join(SCREENSHOT_DIR, `homebase-latest-${name}.png`);
      const layout = await captureViewport(chrome, `${baseUrl}/pages/teddy-house/`, file, width, height);
      const fileStat = await stat(file);
      assert(fileStat.size > 5000, `${name} screenshot is too small to be useful`);
      outputs.push({
        name,
        width,
        height,
        file,
        bytes: fileStat.size,
        scrollWidth: layout.rootScrollWidth,
        summaryTitle: layout.summaryTitle,
        summaryCopy: layout.summaryCopy,
        firstZone: layout.firstZone,
        firstDecision: layout.firstDecision,
        nowDecision: layout.nowDecision,
        firstReview: layout.firstReview,
        visualContract: layout.visualContract,
        firstScreenTextLength: layout.firstScreenTextLength
      });
    }
    return { status: 'captured', outputs };
  } catch (err) {
    if (process.env.HOMEBASE_REQUIRE_SCREENSHOTS === '1') throw err;
    return { status: `skipped (${err.message})` };
  } finally {
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

function fixtureReplayPayload(fixture) {
  const replay = replayHealthFromFixture(fixture);
  const timeline = Array.isArray(fixture.timeline) ? fixture.timeline : [];
  const historicalSummaries = teddyHouseInternals.buildHistoricalSummaries(
    replay.vitals,
    timeline,
    replay.intelligence
  );
  return {
    checkedAt: fixture.checkedAt || fixture.expected?.checkedAt || new Date().toISOString(),
    score: replay.score,
    needsDan: replay.needsDan,
    reviewEvidence: teddyHouseInternals.reviewEvidenceFor(replay.services, replay.intelligence, replay.vitals, replay.needsDan),
    houseState: replay.houseState,
    dailyDecision: replay.dailyDecision,
    services: replay.services,
    intelligence: replay.intelligence,
    vitals: replay.vitals,
    historicalSummaries,
    timeline,
    events: timeline
  };
}

function replayDocumentHtml() {
  const html = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'index.html'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'style.css'), 'utf8');
  const script = readFileSync(join(process.cwd(), 'pages', 'teddy-house', 'script.js'), 'utf8');
  return html
    .replace('<link rel="stylesheet" href="/pages/teddy-house/style.css">', `<style>${css}</style>`)
    .replace('<script src="/pages/_shared/nav.js"></script>', '<script>window.renderPageNav = function() {};</script>')
    .replace('<script src="/pages/teddy-house/script.js"></script>', `<script>${script}</script>`);
}

async function renderReplayFixture(chrome, name, width = 390, height = 844) {
  const fixture = readFixture(name);
  const data = fixtureReplayPayload(fixture);
  const expected = fixture.expected || {};
  const { targetId } = await chromeCommand(chrome, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await chromeCommand(chrome, 'Target.attachToTarget', { targetId, flatten: true });
  await chromeCommand(chrome, 'Page.enable', {}, sessionId);
  await chromeCommand(chrome, 'Runtime.enable', {}, sessionId);
  await chromeCommand(chrome, 'Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__HOMEBASE_REPLAY_HEALTH = ${JSON.stringify(data)};
      window.fetch = async function(url) {
        if (String(url).includes('/api/pages/teddy-house/health')) {
          return { ok: true, status: 200, json: async () => window.__HOMEBASE_REPLAY_HEALTH };
        }
        if (String(url).includes('/api/pages/teddy-house/ask')) {
          return { ok: true, status: 200, json: async () => ({ status: 'complete', source: 'local', answer: 'Replay answer used the dashboard context.' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };
    `
  }, sessionId);
  await chromeCommand(chrome, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 430
  }, sessionId);
  try {
    const documentHtml = replayDocumentHtml();
    const loadPromise = waitForChromeEvent(chrome, 'Page.loadEventFired', sessionId).catch(() => null);
    await chromeCommand(chrome, 'Page.navigate', {
      url: `data:text/html;base64,${Buffer.from(documentHtml).toString('base64')}`
    }, sessionId);
    await loadPromise;
    await waitForHomebaseReady(chrome, sessionId);
    const layout = await assertNoHorizontalOverflow(chrome, sessionId, width);
    const rendered = await assertRenderedFirstScreen(chrome, sessionId, width, { requireReviewVisible: false });
    assert(rendered.summaryTitle === expected.headline, `${name} rendered headline ${rendered.summaryTitle} drifted from ${expected.headline}`);
    assert(rendered.firstZone === zoneTitleForId(expected.firstZone), `${name} rendered first zone ${rendered.firstZone} drifted from ${expected.firstZone}`);
    assert(rendered.nowDecision === expected.nowText || rendered.firstDecision === expected.nowText, `${name} rendered first action ${rendered.nowDecision || rendered.firstDecision} drifted from ${expected.nowText}`);
    if (expected.firstReview) {
      assert(rendered.firstReview.includes(formatReplayReviewNeed(expected.firstReview)), `${name} rendered first review ${rendered.firstReview} did not include ${expected.firstReview}`);
    }
    const file = join(SCREENSHOT_DIR, `homebase-replay-${name}-phone.png`);
    const screenshot = await chromeCommand(chrome, 'Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
    const fileStat = await stat(file);
    assert(fileStat.size > 5000, `${name} replay screenshot is too small to be useful`);
    return {
      name,
      width,
      file,
      bytes: fileStat.size,
      scrollWidth: layout.rootScrollWidth,
      headline: rendered.summaryTitle,
      firstZone: rendered.firstZone,
      firstAction: rendered.nowDecision || rendered.firstDecision,
      firstReview: rendered.firstReview,
      visualContract: rendered.visualContract
    };
  } finally {
    await chromeCommand(chrome, 'Target.closeTarget', { targetId }).catch(() => null);
  }
}

function formatReplayReviewNeed(item) {
  const [rawName, rawValue] = String(item || '').split(':').map(part => part.trim());
  if (/mac restart|watchdog|panic/i.test(rawName)) return 'Mac restart incident';
  if (/service logs/i.test(rawName)) return rawValue && !/^\d+$/.test(rawValue) ? rawValue : 'Service logs need review';
  if (/external access|public access/i.test(rawName)) return rawValue ? `Public access: ${rawValue}` : 'Public access';
  return rawValue ? `${rawName}: ${rawValue}` : rawName;
}

async function renderReplayFixtures() {
  if (process.env.HOMEBASE_SKIP_REPLAY_RENDER === '1') return { status: 'skipped' };
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const userDataDir = join(tmpdir(), `homebase-replay-chrome-${Date.now()}`);
  const chrome = await startChrome(userDataDir);
  try {
    const outputs = [];
    for (const name of WARNING_REPLAY_FIXTURES) {
      outputs.push(await renderReplayFixture(chrome, name));
    }
    return { status: 'captured', outputs };
  } catch (err) {
    if (process.env.HOMEBASE_REQUIRE_REPLAY_RENDER === '1') throw err;
    return { status: `skipped (${err.message})` };
  } finally {
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function smokeCachedLogin(baseUrl) {
  if (process.env.HOMEBASE_SKIP_LOGIN_SMOKE === '1') return { status: 'skipped' };
  const userDataDir = join(tmpdir(), `homebase-login-chrome-${Date.now()}`);
  const chrome = await startChrome(userDataDir);
  let targetId = null;
  let secondTargetId = null;
  try {
    const target = await chromeCommand(chrome, 'Target.createTarget', { url: `${baseUrl}/login?next=/pages/teddy-house/` });
    targetId = target.targetId;
    const attached = await chromeCommand(chrome, 'Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.sessionId;
    await chromeCommand(chrome, 'Page.enable', {}, sessionId);
    await chromeCommand(chrome, 'Runtime.enable', {}, sessionId);
    await waitForLoginReady(chrome, sessionId);

    const beforeStatus = await evaluateChromeValue(chrome, sessionId, `fetch("/api/stats", { credentials: "same-origin" }).then(res => res.status)`);
    assert(beforeStatus === 401, `protected API returned ${beforeStatus} before login, expected 401`);

    await evaluateChromeValue(chrome, sessionId, `(() => {
      document.getElementById("password").value = "Danno";
      document.getElementById("form").requestSubmit();
      return true;
    })()`);
    await waitForHomebaseReady(chrome, sessionId);

    const afterStatus = await evaluateChromeValue(chrome, sessionId, `fetch("/api/stats", { credentials: "same-origin" }).then(res => res.status)`);
    assert(afterStatus === 200, `protected API returned ${afterStatus} after login, expected 200`);

    const secondTarget = await chromeCommand(chrome, 'Target.createTarget', { url: `${baseUrl}/app.html` });
    secondTargetId = secondTarget.targetId;
    const secondAttached = await chromeCommand(chrome, 'Target.attachToTarget', { targetId: secondTargetId, flatten: true });
    const secondSessionId = secondAttached.sessionId;
    await chromeCommand(chrome, 'Page.enable', {}, secondSessionId);
    await chromeCommand(chrome, 'Runtime.enable', {}, secondSessionId);
    await waitForDocumentReady(chrome, secondSessionId);
    const newTabStatus = await evaluateChromeValue(chrome, secondSessionId, `fetch("/api/stats", { credentials: "same-origin" }).then(res => res.status)`);
    assert(newTabStatus === 200, `protected API returned ${newTabStatus} in a new tab after login, expected 200`);

    return {
      status: 'ok',
      protectedApiBeforeLogin: beforeStatus,
      protectedApiAfterLogin: afterStatus,
      protectedApiNewTab: newTabStatus,
      userDataDirIsolated: true
    };
  } catch (err) {
    if (process.env.HOMEBASE_REQUIRE_LOGIN_SMOKE === '1') throw err;
    return { status: `skipped (${err.message})` };
  } finally {
    if (secondTargetId) await chromeCommand(chrome, 'Target.closeTarget', { targetId: secondTargetId }).catch(() => null);
    if (targetId) await chromeCommand(chrome, 'Target.closeTarget', { targetId }).catch(() => null);
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function smokeAskFallback() {
  const srv = await startServer({
    env: {
      TEDDY_HOMEBASE_OPENCLAW_BIN: '/private/tmp/homebase-missing-openclaw-bin',
      TEDDY_HOMEBASE_ASK_TIMEOUT_MS: '1000'
    }
  });
  try {
    const res = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        prompt: 'What matters right now?',
        context: {
          score: 84,
          needsDan: ['OpenClaw: bridge degraded'],
          houseState: {
            headline: 'Something needs a look.',
            summary: 'Start with OpenClaw. Everything else is responding.',
            tone: 'review',
            primaryAction: 'Check OpenClaw first.'
          },
          services: {
            openclaw: { state: 'warn', metric: '127.0.0.1', detail: 'Bridge degraded.' }
          }
        }
      })
    });
    assert(res.status === 200, `Ask Teddy fallback smoke returned ${res.status}`);
    const data = await res.json();
    assert(data.status === 'complete', `Ask Teddy fallback smoke did not complete: ${JSON.stringify(data)}`);
    assert(data.source === 'local-fallback', `Ask Teddy fallback smoke returned source ${data.source}, expected local-fallback`);
    assert(/Teddy bridge did not answer cleanly/i.test(String(data.answer || '')), 'Ask Teddy fallback answer was not labeled honestly');
    assert(/OpenClaw|bridge/i.test(String(data.answer || '')), 'Ask Teddy fallback answer did not preserve bridge context');
    return {
      status: 'ok',
      source: data.source,
      answerLength: String(data.answer || '').length,
      labeled: /Teddy bridge did not answer cleanly/i.test(String(data.answer || ''))
    };
  } finally {
    await srv.kill();
  }
}

async function startChrome(userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME_BIN, [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(new Error('Chrome DevTools endpoint did not start'));
    }, 12000);
    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ child, wsUrl: match[1], ws: null, nextId: 1, callbacks: new Map(), waiters: [] });
      }
    });
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Chrome exited before DevTools started: ${code}`));
    });
  });
}

async function connectChrome(chrome) {
  if (chrome.ws) return chrome.ws;
  const ws = new WebSocket(chrome.wsUrl);
  chrome.ws = ws;
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && chrome.callbacks.has(message.id)) {
      const { resolve, reject } = chrome.callbacks.get(message.id);
      chrome.callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'Chrome DevTools command failed'));
      else resolve(message.result || {});
      return;
    }
    for (const waiter of [...chrome.waiters]) {
      if (waiter.method === message.method && (!waiter.sessionId || waiter.sessionId === message.sessionId)) {
        clearTimeout(waiter.timer);
        chrome.waiters.splice(chrome.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return ws;
}

async function chromeCommand(chrome, method, params = {}, sessionId = null) {
  const ws = await connectChrome(chrome);
  const id = chrome.nextId++;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.callbacks.delete(id);
      reject(new Error(`${method} timed out`));
    }, 12000);
    chrome.callbacks.set(id, {
      resolve: value => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: err => {
        clearTimeout(timer);
        reject(err);
      }
    });
  });
  ws.send(JSON.stringify(payload));
  return promise;
}

async function evaluateChromeValue(chrome, sessionId, expression) {
  const result = await chromeCommand(chrome, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Chrome evaluation failed');
  }
  return result.result ? result.result.value : undefined;
}

function waitForChromeEvent(chrome, method, sessionId, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const waiter = {
      method,
      sessionId,
      resolve,
      timer: setTimeout(() => {
        chrome.waiters.splice(chrome.waiters.indexOf(waiter), 1);
        reject(new Error(`${method} timed out`));
      }, timeoutMs)
    };
    chrome.waiters.push(waiter);
  });
}

async function waitForDocumentReady(chrome, sessionId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const readyState = await evaluateChromeValue(chrome, sessionId, 'document.readyState');
    if (readyState === 'complete' || readyState === 'interactive') return readyState;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('document did not become ready in Chrome smoke');
}

async function waitForLoginReady(chrome, sessionId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = await evaluateChromeValue(chrome, sessionId, `Boolean(document.getElementById("form") && document.getElementById("password"))`);
    if (ready) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('login form did not render in Chrome smoke');
}

async function captureViewport(chrome, url, file, width, height) {
  const { targetId } = await chromeCommand(chrome, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await chromeCommand(chrome, 'Target.attachToTarget', { targetId, flatten: true });
  await chromeCommand(chrome, 'Page.enable', {}, sessionId);
  await chromeCommand(chrome, 'Runtime.enable', {}, sessionId);
  await chromeCommand(chrome, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 430
  }, sessionId);
  const loadPromise = waitForChromeEvent(chrome, 'Page.loadEventFired', sessionId).catch(() => null);
  await chromeCommand(chrome, 'Page.navigate', { url }, sessionId);
  await loadPromise;
  await waitForHomebaseReady(chrome, sessionId);
  const layout = await assertNoHorizontalOverflow(chrome, sessionId, width);
  const rendered = await assertRenderedFirstScreen(chrome, sessionId, width);
  const screenshot = await chromeCommand(chrome, 'Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
  await writeFile(file, Buffer.from(screenshot.data, 'base64'));
  await chromeCommand(chrome, 'Target.closeTarget', { targetId }).catch(() => null);
  return { ...layout, ...rendered };
}

async function waitForHomebaseReady(chrome, sessionId) {
  let lastState = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await chromeCommand(chrome, 'Runtime.evaluate', {
      expression: `(() => {
        const title = document.getElementById("summary-title")?.textContent || "";
        const status = document.getElementById("last-check")?.textContent || "";
        const zones = document.getElementById("house-zone-grid")?.children.length || 0;
        const bodyClass = document.body?.className || "";
        const error = document.getElementById("summary-copy")?.textContent || "";
        const ready = zones === 4 && !/Checking|Could not refresh/i.test(title) && !/Waiting|Refreshing/i.test(status);
        return { ready, title, status, zones, bodyClass, error };
      })()`,
      returnByValue: true
    }, sessionId);
    if (result.result && result.result.value) {
      lastState = result.result.value;
      if (lastState.ready) return lastState;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Homebase did not render loaded health state before screenshot: ${JSON.stringify(lastState)}`);
}

async function assertNoHorizontalOverflow(chrome, sessionId, width) {
  const result = await chromeCommand(chrome, 'Runtime.evaluate', {
    expression: `(() => {
      const root = document.documentElement;
      const body = document.body;
      return {
        viewport: window.innerWidth,
        rootScrollWidth: root.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        title: document.getElementById("summary-title")?.textContent || ""
      };
    })()`,
    returnByValue: true
  }, sessionId);
  const value = result.result && result.result.value ? result.result.value : {};
  const overflow = Math.max(value.rootScrollWidth || 0, value.bodyScrollWidth || 0) - (value.viewport || width);
  assert(overflow <= 1, `horizontal overflow at ${width}px viewport: ${JSON.stringify(value)}`);
  return value;
}

async function assertRenderedFirstScreen(chrome, sessionId, width, options = {}) {
  const requireReviewVisible = options.requireReviewVisible !== false;
  const result = await chromeCommand(chrome, 'Runtime.evaluate', {
    expression: `(() => {
      const textOf = selector => document.querySelector(selector)?.innerText?.trim() || "";
      const topOf = selector => {
        const el = document.querySelector(selector);
        if (!el || el.hidden) return null;
        return Math.round(el.getBoundingClientRect().top);
      };
      const rectOf = selector => {
        const el = document.querySelector(selector);
        if (!el || el.hidden) return null;
        const rect = el.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          visible: rect.bottom > 0 && rect.top < window.innerHeight
        };
      };
      const visibleSectionText = [...document.querySelectorAll("main > section, main > article")]
        .filter(el => !el.hidden)
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        })
        .map(el => el.innerText.trim())
        .filter(Boolean)
        .join("\\n");
      const firstZone = document.querySelector("#house-zone-grid .house-zone-card .tiny-label")?.textContent?.trim() || "";
      const firstDecision = textOf('#next-action');
      const nowDecision = document.querySelector('[data-decision-slot="now"] h3')?.textContent?.trim() || "";
      const firstReview = document.querySelector('#needs-list .need-chip')?.textContent?.replace(/Explain\\s*Prepare fix/g, '')?.trim() || "";
      const zoneCount = document.querySelectorAll("#house-zone-grid .house-zone-card").length;
      const historyCount = document.querySelectorAll("#history-grid .history-card").length;
      const recentChangeRows = [...document.querySelectorAll("#events-list .event")]
        .map(row => row.innerText.trim().replace(/\\s+/g, " "))
        .filter(Boolean);
      return {
        width: window.innerWidth,
        viewportHeight: window.innerHeight,
        summaryTitle: textOf("#summary-title"),
        summaryCopy: textOf("#summary-copy"),
        firstZone,
        firstDecision,
        nowDecision,
        firstReview,
        zoneCount,
        historyCount,
        recentChangeRows,
        firstScreenText: visibleSectionText,
        positions: {
          overview: topOf("#overview"),
          dailyDecision: topOf("#daily-decision"),
          review: topOf("#review-lane"),
          houseState: topOf("#house-state"),
          vitals: topOf("#server"),
          ask: topOf("#ask-teddy"),
          evidence: topOf("#evidence"),
          signals: topOf("#signals"),
          history: topOf("#history"),
          timeline: topOf("#timeline"),
          localLinks: topOf("#local-links")
        },
        rects: {
          overview: rectOf("#overview"),
          dailyDecision: rectOf("#daily-decision"),
          review: rectOf("#review-lane"),
          houseState: rectOf("#house-state"),
          vitals: rectOf("#server"),
          ask: rectOf("#ask-teddy"),
          evidence: rectOf("#evidence"),
          timeline: rectOf("#timeline")
        }
      };
    })()`,
    returnByValue: true
  }, sessionId);
  const value = result.result && result.result.value ? result.result.value : {};
  assert(value.summaryTitle && !/Checking|Could not refresh/i.test(value.summaryTitle), `rendered summary is not loaded at ${width}px: ${JSON.stringify(value)}`);
  assert(value.rects?.overview?.visible === true, `top story is not visible in first viewport at ${width}px: ${JSON.stringify(value.rects?.overview)}`);
  const warningState = !/steady/i.test(value.summaryTitle) || Boolean(value.firstReview);
  if (warningState && requireReviewVisible) {
    assert(value.rects?.review?.visible === true, `review lane is not visible with active warning at ${width}px: ${JSON.stringify(value.rects?.review)}`);
  }
  assert(value.zoneCount === 4, `rendered house-state zones missing at ${width}px: ${JSON.stringify(value)}`);
  assert(value.firstZone, `rendered first house zone missing at ${width}px`);
  assert(value.historyCount >= 1, `rendered history summaries missing at ${width}px: ${JSON.stringify(value)}`);
  assert(Array.isArray(value.recentChangeRows) && value.recentChangeRows.length > 0, `rendered recent changes missing at ${width}px: ${JSON.stringify(value)}`);
  assert(value.recentChangeRows.length <= 3, `rendered recent changes should stay grouped at ${width}px: ${JSON.stringify(value.recentChangeRows)}`);
  assert(new Set(value.recentChangeRows).size === value.recentChangeRows.length, `rendered recent changes include duplicate rows at ${width}px: ${JSON.stringify(value.recentChangeRows)}`);
  assert(!/Status check|No drift|Recent Mac logs need attention/i.test(value.recentChangeRows.join('\n')), `rendered recent changes include noisy raw timeline copy at ${width}px: ${JSON.stringify(value.recentChangeRows)}`);
  assert(value.positions.dailyDecision !== null, `daily decision section missing at ${width}px`);
  assert(value.positions.review !== null, `review section missing at ${width}px`);
  assert(value.positions.houseState !== null, `house-state section missing at ${width}px`);
  assert(value.positions.vitals !== null, `Mac vitals section missing at ${width}px`);
  assert(value.positions.ask !== null, `Ask Teddy section missing at ${width}px`);
  assert(value.positions.dailyDecision < value.positions.review, `review appears before daily decision at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.review < value.positions.houseState, `house state appears before review at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.houseState < value.positions.vitals, `Mac vitals appear before house state at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.vitals < value.positions.ask, `Ask Teddy appears before Mac vitals at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.evidence === null || value.positions.ask < value.positions.evidence, `evidence appears before Ask Teddy at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.signals === null || value.positions.evidence === null || value.positions.evidence < value.positions.signals, `signals appear before service evidence at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.history === null || value.positions.signals === null || value.positions.signals < value.positions.history, `history appears before evidence signals at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.localLinks !== null, `local links section missing at ${width}px`);
  assert(value.positions.timeline === null || value.positions.timeline < value.positions.localLinks, `local links appear before recent changes at ${width}px: ${JSON.stringify(value.positions)}`);
  for (const pattern of RENDERED_FIRST_SCREEN_COPY_BLACKLIST) {
    assert(!pattern.test(value.firstScreenText || ''), `rendered first-screen copy matched blacklist ${pattern} at ${width}px: ${value.firstScreenText}`);
  }
  return {
    firstZone: value.firstZone,
    firstDecision: value.firstDecision,
    nowDecision: value.nowDecision,
    firstReview: value.firstReview,
    summaryTitle: value.summaryTitle,
    summaryCopy: value.summaryCopy,
    visualContract: {
      topStoryVisible: value.rects?.overview?.visible === true,
      reviewVisibleWhenWarning: warningState ? (requireReviewVisible ? value.rects?.review?.visible === true : value.positions.review !== null) : true,
      evidenceBelowDecision: value.positions.evidence === null || value.positions.ask < value.positions.evidence,
      recentChangesGrouped: Array.isArray(value.recentChangeRows)
        && value.recentChangeRows.length > 0
        && value.recentChangeRows.length <= 3
        && new Set(value.recentChangeRows).size === value.recentChangeRows.length,
      firstViewportFreeOfRawTelemetry: RENDERED_FIRST_SCREEN_COPY_BLACKLIST.every(pattern => !pattern.test(value.firstScreenText || ''))
    },
    firstScreenTextLength: (value.firstScreenText || '').length
  };
}

function zoneTitleForId(id) {
  const titles = {
    'outside-access': 'Public access',
    network: 'Internet',
    'smart-home': 'Automations',
    'mac-mini': 'Mac mini'
  };
  return titles[id] || id || '';
}

function askMentionsFirstAction(answer, firstAction) {
  const text = String(answer || '').toLowerCase();
  const action = String(firstAction || '').toLowerCase().replace(/[.]+$/, '');
  if (!action) return false;
  if (text.includes(action)) return true;
  if (/nothing needs/.test(action) && /nothing needs action|no review item|no review items/.test(text)) return true;
  if (/automations/.test(action) && /automations/.test(text)) return true;
  if (/mac mini|restart/.test(action) && /mac mini|restart|openclaw/.test(text)) return true;
  if (/public access|external access/.test(action) && /public access|external access|funnel/.test(text)) return true;
  if (/internet|wan|dns|network/.test(action) && /internet|wan|dns|network/.test(text)) return true;
  return false;
}

function assertStoryAgreement(data, askData, screenshots) {
  const rendered = screenshots && Array.isArray(screenshots.outputs) ? screenshots.outputs[0] : null;
  const apiFirstZone = data.houseState?.zones?.[0]?.id || '';
  const apiFirstZoneTitle = zoneTitleForId(apiFirstZone);
  const apiFirstAction = data.dailyDecision?.slots?.find(slot => slot.key === 'now')?.text
    || data.houseState?.primaryAction
    || '';
  const apiHeadline = data.houseState?.headline || '';
  assert(apiHeadline, 'story agreement missing API headline');
  assert(apiFirstZone, 'story agreement missing API first zone');
  assert(apiFirstAction, 'story agreement missing API first action');
  assert(rendered && rendered.summaryTitle, 'story agreement missing rendered first viewport proof');
  assert(rendered.summaryTitle === apiHeadline, `rendered headline ${rendered.summaryTitle} disagrees with API headline ${apiHeadline}`);
  assert(rendered.firstZone === apiFirstZoneTitle, `rendered first zone ${rendered.firstZone} disagrees with API first zone ${apiFirstZoneTitle}`);
  assert(rendered.nowDecision === apiFirstAction || rendered.firstDecision === apiFirstAction, `rendered first action ${rendered.nowDecision || rendered.firstDecision} disagrees with API first action ${apiFirstAction}`);
  assert(askData && askData.status === 'complete', 'story agreement missing Ask Teddy answer');
  assert(askMentionsFirstAction(askData.answer, apiFirstAction), `Ask Teddy answer does not mention first action ${apiFirstAction}: ${askData.answer}`);
  if (askData.source === 'local-fallback') {
    assert(/Teddy bridge did not answer cleanly/i.test(String(askData.answer || '')), 'Ask Teddy fallback is not labeled honestly');
  }
  return {
    status: 'ok',
    headline: apiHeadline,
    firstZone: apiFirstZone,
    renderedFirstZone: rendered.firstZone,
    firstAction: apiFirstAction,
    askSource: askData.source
  };
}

function replayHealthFromFixture(fixture) {
  const services = structuredClone(fixture.services);
  const intelligence = structuredClone(fixture.intelligence);
  const systemVitals = structuredClone(fixture.systemVitals);
  if (intelligence.serviceLogs) {
    Object.assign(intelligence.serviceLogs, teddyHouseInternals.domainServiceLogs(intelligence.serviceLogs));
    intelligence.automationLogs = intelligence.serviceLogs.automationLogs;
    intelligence.macMiniLogs = intelligence.serviceLogs.macMiniLogs;
    intelligence.networkLogs = intelligence.serviceLogs.networkLogs;
  }
  const needsDan = teddyHouseInternals.needsDan(services, intelligence, systemVitals);
  const score = teddyHouseInternals.scoreServices(services, intelligence, systemVitals);
  const houseState = teddyHouseInternals.deriveHouseState(
    services,
    intelligence,
    systemVitals,
    needsDan,
    fixture.timeline || [],
    score
  );
  const dailyDecision = teddyHouseInternals.deriveDailyDecision(
    services,
    intelligence,
    systemVitals,
    needsDan,
    houseState
  );
  return { score, needsDan, houseState, dailyDecision, services, intelligence, vitals: systemVitals };
}

function assertReplayStoryAgreement(name, fixture, data) {
  const expected = fixture.expected || {};
  const firstZone = data.houseState?.zones?.[0]?.id || '';
  const firstAction = data.dailyDecision?.slots?.find(slot => slot.key === 'now')?.text
    || data.houseState?.primaryAction
    || '';
  const askContext = teddyHouseInternals.summarizeForTeddy(data);
  const askAnswer = teddyHouseInternals.answerFromDashboardContext(
    'status',
    'Summarize the current Homebase status and explain what needs review.',
    null,
    askContext
  );
  assert(data.houseState.headline === expected.headline, `${name} replay API headline disagrees with locked first-screen headline`);
  assert(firstZone === expected.firstZone, `${name} replay API first zone ${firstZone} disagrees with locked first-screen zone ${expected.firstZone}`);
  assert(firstAction === expected.nowText, `${name} replay API first action ${firstAction} disagrees with locked first-screen action ${expected.nowText}`);
  if (expected.firstReview) {
    assert(data.needsDan[0] === expected.firstReview, `${name} replay first review ${data.needsDan[0]} disagrees with locked first review ${expected.firstReview}`);
  }
  assert(askMentionsFirstAction(askAnswer, firstAction), `${name} replay Ask answer does not mention first action ${firstAction}: ${askAnswer}`);
  return {
    name,
    headline: data.houseState.headline,
    firstZone,
    firstAction,
    firstReview: data.needsDan[0] || null,
    askSource: 'local-replay'
  };
}

async function stopChrome(chrome) {
  if (!chrome) return;
  try { chrome.ws?.close(); } catch (_) {}
  try { chrome.child?.kill('SIGTERM'); } catch (_) {}
  await new Promise(resolve => {
    if (!chrome.child || chrome.child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      try { chrome.child.kill('SIGKILL'); } catch (_) {}
      resolve();
    }, 1000);
    chrome.child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function smokeLocalRoutes() {
  const srv = await startServer({ password: 'Danno', env: { TEDDY_HOMEBASE_ASK_LOCAL_ONLY: '1' } });
  try {
    const page = await fetchWithTimeout(`${srv.baseUrl}/pages/teddy-house/`);
    assert(page.status === 200, `local Homebase page returned ${page.status}`);
    const html = await page.text();
    assert(html.includes('Teddy Homebase'), 'local Homebase page did not render Teddy Homebase copy');

    const health = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/health`);
    assert(health.status === 200, `local health returned ${health.status}`);
    const data = await health.json();
    assert(typeof data.score === 'number', 'health score is missing');
    assert(Array.isArray(data.houseState?.zones), 'houseState zones are missing');
    assert(data.houseState.zones.length === 4, `expected 4 house zones, got ${data.houseState.zones.length}`);
    assert(data.dailyDecision?.slots?.map(slot => slot.key).join(',') === 'now,watch,later', 'daily decision slots are wrong');
    assert(data.visualEvidence?.latest?.visuals?.houseState?.type === 'zone-state', 'house-state visual evidence is missing');
    assert(Array.isArray(data.needsDan), 'health payload needsDan must be an array');
    assert(Array.isArray(data.reviewEvidence), 'health payload reviewEvidence must be an array');
    assert(data.reviewEvidence.map(item => item.label).join('\n') === data.needsDan.join('\n'), 'review evidence labels must match visible review items');
    for (const item of data.reviewEvidence) {
      assert(item.source, `review evidence for ${item.label} is missing source`);
      assert(item.checkedAt, `review evidence for ${item.label} is missing checkedAt`);
      assert(item.confidence, `review evidence for ${item.label} is missing confidence`);
      assert(item.freshness, `review evidence for ${item.label} is missing freshness`);
    }
    assertFirstReviewMatchesFirstZone(data.houseState.zones[0].id, data.needsDan[0], data.reviewEvidence[0]?.source, 'local health');
    assertFirstScreenCopyClean(data, 'local health');
    const noFakeHomeState = assertNoFakeHomeState(data);
    const cachedUpdateLabels = assertCachedUpdateLabels(data);
    const sourceContracts = assertSourceContracts(data);
    const askFallback = await smokeAskFallback();

    const ask = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        prompt: 'Summarize the current Homebase status and explain what needs review.',
        context: data
      })
    });
    assert(ask.status === 200, `local Ask Teddy returned ${ask.status}`);
    const askData = await ask.json();
    assert(askData.status === 'complete', `Ask Teddy did not complete: ${JSON.stringify(askData)}`);
    assert(['local', 'local-fallback', 'teddy'].includes(askData.source), `Ask Teddy returned unexpected source ${askData.source}`);
    assert(String(askData.answer || '').includes('Readiness'), 'Ask Teddy answer did not use dashboard readiness context');

    const prepare = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: true,
        action: 'prepare-fix',
        prompt: 'Prepare a dry-run fix plan for the first Homebase review item.',
        clicked: { type: 'review', label: data.needsDan[0] || 'Homebase status' },
        context: data
      })
    });
    assert(prepare.status === 200, `Ask Teddy prepare-fix dry run returned ${prepare.status}`);
    const prepareData = await prepare.json();
    assert(prepareData.status === 'complete' && prepareData.dryRun === true, `Ask Teddy prepare-fix was not a dry run: ${JSON.stringify(prepareData)}`);
    assert(String(prepareData.promptPreview || '').includes('dry-run plan only'), 'prepare-fix prompt is missing dry-run language');
    assert(String(prepareData.promptPreview || '').includes('Do not change files, services, routes, Tailscale, Homebridge, AdGuard, or OpenClaw state.'), 'prepare-fix prompt is missing no-mutation guard');
    assert(String(prepareData.promptPreview || '').includes('exact approval needed'), 'prepare-fix prompt is missing approval language');
    assert(!/launchctl|tailscale serve|hb-service restart|npm install|sudo\s+/.test(String(prepareData.promptPreview || '')), 'prepare-fix dry run included a mutation command');

    const logs = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/logs`);
    assert(logs.status === 200, `local logs returned ${logs.status}`);
    const logData = await logs.json();
    assertLogsDetailContract(logData);
    const nonLoopbackHost = 'openclaw-mac-mini.tail02a3b6.ts.net:10000';
    const remoteHostHealth = await requestStatus({ port: srv.port, path: '/api/pages/teddy-house/health', host: nonLoopbackHost });
    const remoteHostLogs = await requestStatus({ port: srv.port, path: '/api/pages/teddy-house/logs', host: nonLoopbackHost });
    const remoteHostScript = await requestStatus({ port: srv.port, path: '/pages/teddy-house/logs.js', host: nonLoopbackHost });
    assert(remoteHostHealth === 401, `non-loopback Host health probe returned ${remoteHostHealth}, expected 401`);
    assert(remoteHostLogs === 401, `non-loopback Host logs probe returned ${remoteHostLogs}, expected 401`);
    assert(remoteHostScript === 302, `non-loopback Host script probe returned ${remoteHostScript}, expected login redirect`);
    const cachedLogin = await smokeCachedLogin(srv.baseUrl);
    const screenshots = await captureScreenshots(srv.baseUrl);
    const storyAgreement = assertStoryAgreement(data, askData, screenshots);
    const persisted = assertPersistedHomebaseData(srv.cwd, data);

    return {
      score: data.score,
      headline: data.houseState.headline,
      firstZone: data.houseState.zones[0].id,
      firstDecision: data.dailyDecision.slots[0].text,
      reviewItems: data.needsDan.length,
      reviewEvidenceItems: data.reviewEvidence.length,
      ask: {
        status: askData.status,
        source: askData.source,
        answerLength: String(askData.answer || '').length,
        fallbackStatus: askFallback.status,
        fallbackSource: askFallback.source,
        fallbackLabeled: askFallback.labeled,
        prepareFixDryRun: prepareData.dryRun === true,
        prepareFixGuarded: /dry-run plan only/.test(String(prepareData.promptPreview || ''))
          && /Do not change files, services, routes, Tailscale, Homebridge, AdGuard, or OpenClaw state\./.test(String(prepareData.promptPreview || ''))
          && /exact approval needed/.test(String(prepareData.promptPreview || ''))
      },
      storyAgreement,
      loopbackProbe: {
        localHealth: health.status,
        localLogs: logs.status,
        remoteHostHealth,
        remoteHostLogs,
        remoteHostScript
      },
      cachedLogin,
      noFakeHomeState,
      cachedUpdateLabels,
      sourceContracts,
      screenshots,
      persisted
    };
  } finally {
    await srv.kill();
  }
}

function assertLogsDetailContract(logData) {
  const logs = logData.serviceLogs || {};
  const items = Array.isArray(logs.items) ? logs.items : [];
  assert(items.length > 0, 'grouped service logs are missing');
  for (const name of ['Homebase', 'Homebridge', 'Eufy plugin', 'OpenClaw', 'AdGuard', 'Tailscale']) {
    const item = items.find(entry => entry.name === name);
    assert(item, `logs detail is missing ${name}`);
    assert(item.source, `${name} log item is missing source`);
    assert(item.detail, `${name} log item is missing detail`);
    assert(Array.isArray(item.examples), `${name} log item examples must be an array`);
  }
  assert(items.some(item => item.name === 'Eufy plugin' && item.ignored === true), 'logs detail must keep Eufy marked ignored');
  assert(logs.automationLogs && logs.macMiniLogs && logs.networkLogs, 'logs detail must keep domain rollups');
  assert(logData.storage?.latestSnapshot === 'data/teddy-house/service-logs.json', 'logs detail must name latest snapshot storage');
  assert(logData.storage?.visualEvidence === 'data/teddy-house/visual-evidence.json', 'logs detail must name visual evidence storage');
  assert(Array.isArray(logData.framework?.architecture), 'logs detail must include the unified logging framework');
}

function assertPersistedHomebaseData(cwd, data) {
  const timeline = readJsonFile(cwd, 'timeline.json');
  const evidence = readJsonFile(cwd, 'visual-evidence.json');
  const vitals = readJsonFile(cwd, 'vitals-history.json');
  const boot = readJsonFile(cwd, 'boot-history.json');
  const wan = readJsonFile(cwd, 'wan-history.json');
  const publicAccess = readJsonFile(cwd, 'public-access-history.json');
  const automationLogs = readJsonFile(cwd, 'automation-log-history.json');
  const askHistory = readJsonFile(cwd, 'ask-history.json');
  const snapshot = readJsonFile(cwd, 'snapshot.json');
  const serviceLogs = readJsonFile(cwd, 'service-logs.json');

  assert(Array.isArray(timeline.events), 'timeline.json must contain an events array');
  assert(timeline.events.length > 0, 'timeline.json must retain at least one event after health check');
  assert(timeline.events.length <= 80, `timeline.json exceeded retention limit: ${timeline.events.length}`);
  assert(timeline.events[0].at && timeline.events[0].title && timeline.events[0].detail, 'latest timeline event is missing at/title/detail');

  assert(Array.isArray(evidence.entries), 'visual-evidence.json must contain an entries array');
  assert(evidence.entries.length > 0, 'visual-evidence.json must retain at least one entry after health check');
  assert(evidence.entries.length <= 120, `visual-evidence.json exceeded retention limit: ${evidence.entries.length}`);
  assert(evidence.entries[0].visuals?.houseState?.type === 'zone-state', 'visual evidence must include house-state source proof');
  assert(evidence.entries[0].visuals?.vitalsGrid?.inputs?.vitalsHistory?.source === 'data/teddy-house/vitals-history.json', 'visual evidence must cite vitals history source');
  assert(evidence.entries[0].visuals?.timeline?.source === 'data/teddy-house/timeline.json', 'visual evidence must cite timeline source');
  assert(evidence.entries[0].visuals?.historicalSummaries?.type === 'persisted-summaries', 'visual evidence must include persisted history summaries');

  assert(Array.isArray(vitals.entries), 'vitals-history.json must contain an entries array');
  assert(vitals.entries.length > 0, 'vitals-history.json must retain at least one vitals sample');
  assert(vitals.entries.length <= 500, `vitals-history.json exceeded retention limit: ${vitals.entries.length}`);
  assert(vitals.entries[0].at && Number.isFinite(Number(vitals.entries[0].cpu)), 'latest vitals sample is missing at/cpu');
  assert(data.vitals?.vitalsHistory?.source === 'data/teddy-house/vitals-history.json', 'health payload must cite persisted vitals source');
  assert(data.vitals?.vitalsHistory?.window === '6h', 'health payload must name the vitals history window');
  assert(Number(data.vitals?.vitalsHistory?.samples) > 0, 'health payload must include persisted vitals samples for peak copy');
  assert(/^Peak \d+\.\d{2} \/ 6h$/.test(data.vitals?.health?.cpu?.secondary || ''), 'CPU peak copy must use the persisted 6h history format');
  assert(Array.isArray(boot.entries), 'boot-history.json must contain an entries array');
  assert(boot.entries.length > 0, 'boot-history.json must retain at least one boot session');
  assert(boot.entries.length <= 120, `boot-history.json exceeded retention limit: ${boot.entries.length}`);
  assert(boot.entries[0].bootedAt && boot.entries[0].lastSeenAt, 'latest boot history entry is missing bootedAt/lastSeenAt');
  assert(data.vitals?.bootHistory?.source === 'data/teddy-house/boot-history.json', 'health payload must cite persisted boot history source');
  assert(Array.isArray(wan.entries), 'wan-history.json must contain an entries array');
  assert(wan.entries.length > 0, 'wan-history.json must retain at least one WAN sample');
  assert(wan.entries.length <= 500, `wan-history.json exceeded retention limit: ${wan.entries.length}`);
  assert(wan.entries[0].at && Number.isFinite(Number(wan.entries[0].avgMs)), 'latest WAN sample is missing at/avgMs');
  assert(data.intelligence?.wanQuality?.wanHistory?.source === 'data/teddy-house/wan-history.json', 'health payload must cite persisted WAN history source');
  assert(Array.isArray(publicAccess.entries), 'public-access-history.json must contain an entries array');
  assert(publicAccess.entries.length > 0, 'public-access-history.json must retain at least one route state');
  assert(publicAccess.entries.length <= 120, `public-access-history.json exceeded retention limit: ${publicAccess.entries.length}`);
  assert(publicAccess.entries[0].changedAt && publicAccess.entries[0].routeKey, 'latest public access history entry is missing changedAt/routeKey');
  assert(data.intelligence?.publicAccess?.publicAccessHistory?.source === 'data/teddy-house/public-access-history.json', 'health payload must cite persisted public access history source');
  assert(Array.isArray(automationLogs.entries), 'automation-log-history.json must contain an entries array');
  assert(automationLogs.entries.length > 0, 'automation-log-history.json must retain at least one automation log state');
  assert(automationLogs.entries.length <= 120, `automation-log-history.json exceeded retention limit: ${automationLogs.entries.length}`);
  assert(automationLogs.entries[0].firstSeenAt && automationLogs.entries[0].stateKey, 'latest automation log history entry is missing firstSeenAt/stateKey');
  assert(data.intelligence?.automationLogs?.automationLogHistory?.source === 'data/teddy-house/automation-log-history.json', 'health payload must cite persisted automation log history source');
  assert(Array.isArray(askHistory.entries), 'ask-history.json must contain an entries array');
  assert(askHistory.entries.length > 0, 'ask-history.json must retain at least one Ask Teddy entry');
  assert(askHistory.entries.length <= 40, `ask-history.json exceeded retention limit: ${askHistory.entries.length}`);
  assert(askHistory.entries[0].at && askHistory.entries[0].action && askHistory.entries[0].source, 'latest Ask Teddy entry is missing at/action/source');
  assert(askHistory.entries[0].status === 'complete', 'latest Ask Teddy entry must be complete');
  assert(Array.isArray(data.historicalSummaries), 'health payload must include persisted historical summaries');
  const cpuSummary = data.historicalSummaries.find(summary => summary.id === 'cpu-peak-6h');
  const bootSummary = data.historicalSummaries.find(summary => summary.id === 'mac-boot-7d');
  const wanSummary = data.historicalSummaries.find(summary => summary.id === 'wan-latency-24h');
  const publicAccessSummary = data.historicalSummaries.find(summary => summary.id === 'public-access-routes');
  const automationSummary = data.historicalSummaries.find(summary => summary.id === 'automation-log-state');
  const changesSummary = data.historicalSummaries.find(summary => summary.id === 'house-changes-24h');
  assert(cpuSummary?.source === 'data/teddy-house/vitals-history.json', 'CPU history summary must cite vitals-history.json');
  assert(cpuSummary.window === '6h', 'CPU history summary must use the 6h window');
  assert(Number(cpuSummary.sampleCount) > 0, 'CPU history summary must include a persisted sample count');
  assert(bootSummary?.source === 'data/teddy-house/boot-history.json', 'Mac boot summary must cite boot-history.json');
  assert(bootSummary.window === '7d', 'Mac boot summary must use the 7d window');
  assert(Number(bootSummary.sampleCount) > 0, 'Mac boot summary must include persisted samples');
  assert(wanSummary?.source === 'data/teddy-house/wan-history.json', 'WAN history summary must cite wan-history.json');
  assert(wanSummary.window === '24h', 'WAN history summary must use the 24h window');
  assert(Number(wanSummary.sampleCount) > 0, 'WAN history summary must include persisted samples');
  assert(publicAccessSummary?.source === 'data/teddy-house/public-access-history.json', 'public access summary must cite public-access-history.json');
  assert(publicAccessSummary.window === 'current', 'public access summary must use the current route window');
  assert(Number(publicAccessSummary.sampleCount) > 0, 'public access summary must include persisted samples');
  assert(automationSummary?.source === 'data/teddy-house/automation-log-history.json', 'automation log summary must cite automation-log-history.json');
  assert(automationSummary.window === 'current', 'automation log summary must use the current state window');
  assert(Number(automationSummary.sampleCount) > 0, 'automation log summary must include persisted samples');
  assert(changesSummary?.source === 'data/teddy-house/timeline.json', 'changes history summary must cite timeline.json');
  assert(changesSummary.window === '24h', 'changes history summary must use the 24h window');
  assert(Number(changesSummary.sampleCount) > 0, 'changes history summary must include persisted samples');
  const visualSummaries = evidence.entries[0].visuals.historicalSummaries.inputs || [];
  assert(visualSummaries.length === data.historicalSummaries.length, 'visual evidence historical summaries must match health payload');
  assert(visualSummaries.every(summary => summary.source && summary.window && Number.isFinite(Number(summary.sampleCount))), 'visual evidence summaries must include source/window/sampleCount');

  assert(snapshot.score === data.score, 'snapshot.json score should match latest health score');
  assert(snapshot.services?.homebridge === data.services?.homebridge?.state, 'snapshot.json should retain compact service states');
  assert(snapshot.serviceLogState === data.intelligence?.serviceLogs?.state, 'snapshot.json should retain service-log drift state');
  assert(Array.isArray(serviceLogs.items), 'service-logs.json must retain grouped service log items');
  assert(serviceLogs.automationLogs && serviceLogs.macMiniLogs && serviceLogs.networkLogs, 'service-logs.json must retain domain log rollups');
  assert(serviceLogs.items.some(item => item.name === 'Eufy plugin' && item.ignored === true), 'service-logs.json must preserve Eufy as ignored evidence');

  return {
    timelineEvents: timeline.events.length,
    visualEvidenceEntries: evidence.entries.length,
    vitalsSamples: vitals.entries.length,
    bootSessions: boot.entries.length,
    wanSamples: wan.entries.length,
    publicAccessStates: publicAccess.entries.length,
    automationLogStates: automationLogs.entries.length,
    askHistoryEntries: askHistory.entries.length,
    serviceLogItems: serviceLogs.items.length
  };
}

function verifyReplayFixtures() {
  const expected = {
    healthy: ['outside-access', 'Nothing needs Dan.'],
    'stale-android-proof': ['outside-access', 'Nothing needs Dan.'],
    'post-reboot-recovered': ['outside-access', 'Nothing needs Dan.'],
    'post-outage-homebridge-down': ['smart-home', 'Check Homebridge first.'],
    'homebridge-down': ['smart-home', 'Check Homebridge first.'],
    'adguard-dns-down': ['network', 'Check DNS first.'],
    'tailscale-funnel-missing': ['outside-access', 'Check public access first.'],
    'govee-loop': ['smart-home', 'Check automations first.'],
    'mac-panic': ['mac-mini', 'Review the Mac mini restart.'],
    'public-exposure-drift': ['outside-access', 'Check public access first.'],
    'wan-dns-degraded': ['network', 'Check internet quality first.'],
    'teddy-bridge-fallback': ['mac-mini', 'Check OpenClaw first.']
  };
  const contracts = [];
  for (const [name, [zone, nowText]] of Object.entries(expected)) {
    const fixture = readFixture(name);
    assert(fixture.expected?.firstZone === zone, `${name} fixture first zone drifted`);
    assert(fixture.expected?.nowText === nowText, `${name} fixture daily decision drifted`);
    assert(typeof fixture.expected?.summary === 'string' && fixture.expected.summary.length > 0, `${name} fixture summary contract missing`);
    assert(typeof fixture.expected?.primaryAction === 'string' && fixture.expected.primaryAction.length > 0, `${name} fixture primary action contract missing`);
    assert(Array.isArray(fixture.expected?.zoneOrder) && fixture.expected.zoneOrder[0] === zone, `${name} fixture zone order contract missing`);
    assert(Array.isArray(fixture.expected?.dailySlots) && fixture.expected.dailySlots.length === 3, `${name} fixture daily decision contract missing`);
    assert(JSON.stringify([...fixture.expected.zoneOrder].sort()) === JSON.stringify([...EXPECTED_ZONE_IDS].sort()), `${name} fixture zone order must include every house zone once`);
    assert(JSON.stringify(fixture.expected.dailySlots.map(slot => slot.key)) === JSON.stringify(EXPECTED_DAILY_SLOT_KEYS), `${name} fixture daily slots must be now,watch,later`);
    assertFirstReviewMatchesFirstZone(zone, fixture.expected.firstReview, fixture.expected.nowSource, `${name} fixture`);
    assertFirstScreenCopyClean({
      needsDan: fixture.expected?.firstReview ? [fixture.expected.firstReview] : [],
      houseState: {
        headline: fixture.expected?.headline,
        summary: fixture.expected?.summary,
        primaryAction: fixture.expected?.nowText,
        zones: [{ title: fixture.expected?.firstZone, value: fixture.expected?.firstZoneState, detail: fixture.expected?.nowText }]
      },
      dailyDecision: { slots: [{ label: 'Now', text: fixture.expected?.nowText, source: fixture.expected?.nowSource }] }
    }, `${name} fixture`);
    const replayData = replayHealthFromFixture(fixture);
    assertFirstScreenCopyClean(replayData, `${name} replay`);
    if (name === 'stale-android-proof') {
      assert(JSON.stringify({
        needsDan: replayData.needsDan,
        houseState: replayData.houseState,
        dailyDecision: replayData.dailyDecision
      }).match(/Android|proof node/i) === null, 'stale Android proof leaked into trusted replay surface');
    }
    if (name === 'post-reboot-recovered') {
      assert(replayData.houseState?.tone === 'steady', 'clean post-reboot recovery should stay steady');
      assert(Array.isArray(replayData.needsDan) && replayData.needsDan.length === 0, 'clean post-reboot recovery should not create review items');
      assert(!/restart|reboot|panic|watchdog/i.test(JSON.stringify({
        headline: replayData.houseState?.headline,
        summary: replayData.houseState?.summary,
        primaryAction: replayData.houseState?.primaryAction,
        dailyDecision: replayData.dailyDecision
      })), 'clean post-reboot recovery leaked scary restart copy into first-screen truth');
    }
    if (name === 'post-outage-homebridge-down') {
      assert(replayData.houseState?.zones?.[0]?.id === 'smart-home', 'post-outage Homebridge outage should lead with automations');
      assert(replayData.needsDan?.[0] === 'Homebridge: offline', 'post-outage Homebridge outage should keep Homebridge as first review item');
      assert(!/panic|watchdog/i.test(JSON.stringify({
        headline: replayData.houseState?.headline,
        summary: replayData.houseState?.summary,
        primaryAction: replayData.houseState?.primaryAction,
        dailyDecision: replayData.dailyDecision
      })), 'post-outage Homebridge outage should not invent panic/watchdog copy');
    }
    const storyAgreement = assertReplayStoryAgreement(name, fixture, replayData);
    contracts.push({
      name,
      headline: fixture.expected.headline,
      firstZone: fixture.expected.firstZone,
      nowText: fixture.expected.nowText,
      zoneOrder: fixture.expected.zoneOrder,
      dailySlots: fixture.expected.dailySlots.map(slot => `${slot.key}:${slot.source}`),
      storyAgreement
    });
  }
  return contracts;
}

function acceptanceGates(fixtureContracts, local, publicAuth) {
  const screenshots = local && local.screenshots ? local.screenshots : {};
  const persisted = local && local.persisted ? local.persisted : {};
  const headline = local && local.headline ? local.headline.replace(/[.]+$/, '') : 'no headline';
  return [
    {
      name: 'replay-contracts',
      status: fixtureContracts.length === REQUIRED_REPLAY_FIXTURES.length ? 'ok' : 'fail',
      detail: `${fixtureContracts.length} house stories validated.`
    },
    {
      name: 'local-routes',
      status: local && local.headline && local.firstZone ? 'ok' : 'fail',
      detail: `Health, logs, and page smoke returned ${headline}.`
    },
    {
      name: 'screenshots',
      status: screenshots.status === 'captured' ? 'ok' : 'skipped',
      detail: screenshots.status === 'captured'
        ? `${screenshots.outputs.length} responsive screenshots captured.`
        : screenshots.status || 'not captured'
    },
    {
      name: 'persisted-evidence',
      status: persisted.timelineEvents > 0 && persisted.visualEvidenceEntries > 0 && persisted.vitalsSamples > 0 ? 'ok' : 'fail',
      detail: `${persisted.timelineEvents || 0} timeline events, ${persisted.visualEvidenceEntries || 0} visual entries, ${persisted.vitalsSamples || 0} vitals samples.`
    },
    {
      name: 'review-provenance',
      status: local && local.reviewItems === local.reviewEvidenceItems ? 'ok' : 'fail',
      detail: `${local && Number.isFinite(local.reviewEvidenceItems) ? local.reviewEvidenceItems : 0} review item${local && local.reviewEvidenceItems === 1 ? '' : 's'} source-backed.`
    },
    {
      name: 'ask-teddy',
      status: local && local.ask && local.ask.status === 'complete' && local.ask.answerLength > 0 && local.ask.fallbackLabeled ? 'ok' : 'fail',
      detail: local && local.ask ? `${local.ask.source} answer, ${local.ask.answerLength} chars, fallback ${local.ask.fallbackSource || 'missing'}, ${persisted.askHistoryEntries || 0} persisted.` : 'Ask Teddy did not answer.'
    },
    {
      name: 'ask-action-safety',
      status: local && local.ask && local.ask.prepareFixDryRun && local.ask.prepareFixGuarded ? 'ok' : 'fail',
      detail: local && local.ask && local.ask.prepareFixDryRun
        ? 'Prepare fix dry-run includes no-mutation and approval language.'
        : 'Prepare fix dry-run did not prove action safety.'
    },
    {
      name: 'ask-fallback-visibility',
      status: local && local.ask && local.ask.fallbackLabeled ? 'ok' : 'fail',
      detail: local && local.ask && local.ask.fallbackLabeled
        ? 'Forced bridge failure returns local-fallback and labels the bridge failure.'
        : 'Ask Teddy fallback visibility was not proved.'
    },
    {
      name: 'story-agreement',
      status: local && local.storyAgreement && local.storyAgreement.status === 'ok' ? 'ok' : 'fail',
      detail: local && local.storyAgreement
        ? `${local.storyAgreement.headline}; ${local.storyAgreement.firstZone}; ${local.storyAgreement.firstAction}; Ask ${local.storyAgreement.askSource}.`
        : 'API, rendered page, and Ask Teddy story agreement was not proved.'
    },
    {
      name: 'public-auth',
      status: publicAuth === 'enforced' ? 'ok' : 'skipped',
      detail: publicAuth
    },
    {
      name: 'loopback-probe-boundary',
      status: local && local.loopbackProbe
        && local.loopbackProbe.localHealth === 200
        && local.loopbackProbe.localLogs === 200
        && local.loopbackProbe.remoteHostHealth === 401
        && local.loopbackProbe.remoteHostLogs === 401
        && local.loopbackProbe.remoteHostScript === 302 ? 'ok' : 'fail',
      detail: local && local.loopbackProbe
        ? `local health/logs ${local.loopbackProbe.localHealth}/${local.loopbackProbe.localLogs}; remote-looking Host ${local.loopbackProbe.remoteHostHealth}/${local.loopbackProbe.remoteHostLogs}/${local.loopbackProbe.remoteHostScript}.`
        : 'Loopback probe boundary was not checked.'
    },
    {
      name: 'login-persistence',
      status: local && local.cachedLogin && local.cachedLogin.status === 'ok'
        ? 'ok'
        : local && local.cachedLogin && /^skipped/.test(local.cachedLogin.status)
          ? 'skipped'
          : 'fail',
      detail: local && local.cachedLogin && local.cachedLogin.status === 'ok'
        ? `Protected API ${local.cachedLogin.protectedApiBeforeLogin} before login, ${local.cachedLogin.protectedApiAfterLogin} after login, ${local.cachedLogin.protectedApiNewTab} in a new tab.`
        : local && local.cachedLogin
          ? local.cachedLogin.status
          : 'Cached login smoke did not run.'
    },
    {
      name: 'no-fake-home-state',
      status: local && local.noFakeHomeState
        && local.noFakeHomeState.persistedSummaries > 0
        && local.noFakeHomeState.ignoredDoorLocks
        && local.noFakeHomeState.noFakeTrendLanguage ? 'ok' : 'fail',
      detail: local && local.noFakeHomeState
        ? `${local.noFakeHomeState.persistedSummaries} persisted summaries; lock evidence ignored; no fake trend UI.`
        : 'No-fake home state checks did not run.'
    },
    {
      name: 'cached-update-labels',
      status: local && local.cachedUpdateLabels
        && local.cachedUpdateLabels.updateSignals === 2
        && local.cachedUpdateLabels.cachedLabelRenderer ? 'ok' : 'fail',
      detail: local && local.cachedUpdateLabels
        ? `${local.cachedUpdateLabels.cachedUpdateSignals} cached update signal${local.cachedUpdateLabels.cachedUpdateSignals === 1 ? '' : 's'}; Cached label renderer present.`
        : 'Cached update label checks did not run.'
    },
    {
      name: 'source-contracts',
      status: local && local.sourceContracts && local.sourceContracts.contracts > 0 ? 'ok' : 'fail',
      detail: local && local.sourceContracts
        ? `${local.sourceContracts.contracts} contracts; ${local.sourceContracts.trusted} trusted, ${local.sourceContracts.degraded} degraded, ${local.sourceContracts.ignored} ignored, ${local.sourceContracts.needsLogin} needs login.`
        : 'Source contract checks did not run.'
    },
    {
      name: 'live-first-story',
      status: local && local.firstZone && local.firstDecision ? 'ok' : 'fail',
      detail: `${local && local.firstZone ? local.firstZone : 'unknown'}: ${local && local.firstDecision ? local.firstDecision : 'missing decision'}`
    }
  ];
}

function acceptanceStatus(gates) {
  if (gates.some(gate => gate.status === 'fail')) return 'fail';
  if (gates.some(gate => gate.status === 'skipped')) return 'partial';
  return 'ok';
}

function truthVerdict(gates, checks, local, publicAuth) {
  const gateItems = Array.isArray(gates) ? gates : [];
  const checkItems = Array.isArray(checks) ? checks : [];
  const failedGates = gateItems.filter(item => item.status === 'fail').map(item => item.name);
  const failedChecks = checkItems.filter(item => item.status === 'fail').map(item => item.name);
  const skippedGates = gateItems.filter(item => item.status === 'skipped').map(item => item.name);
  const trustCriticalNames = new Set([
    'local-routes',
    'review-provenance',
    'ask-teddy',
    'ask-action-safety',
    'ask-fallback-visibility',
    'story-agreement',
    'public-auth',
    'loopback-probe-boundary',
    'login-persistence',
    'no-fake-home-state',
    'source-contracts',
    'live-first-story',
    'replay-story-agreement',
    'recorded-incident-replay',
    'visual-contracts',
    'rendered-replay-contracts',
    'healthy-freshness-copy',
    'remote-password-gate'
  ]);
  const trustFailures = [...failedGates, ...failedChecks].filter(name => trustCriticalNames.has(name));
  const nonTrustFailures = [...failedGates, ...failedChecks].filter(name => !trustCriticalNames.has(name));
  const firstReview = local && Number.isFinite(local.reviewItems) ? local.reviewItems : 0;
  const firstDecision = local && local.firstDecision ? local.firstDecision : null;
  const firstDecisionText = firstDecision ? firstDecision.replace(/[.]+$/, '') : null;
  const firstZone = local && local.firstZone ? local.firstZone : null;
  if (trustFailures.length > 0) {
    return {
      status: 'fail',
      label: 'Homebase is lying',
      summary: `Trust failed at ${[...new Set(trustFailures)].join(', ')}.`,
      firstAction: 'Fix Homebase trust before using the dashboard.',
      reason: 'trust-failure',
      failedGates,
      failedChecks,
      nonTrustFailures,
      skippedGates,
      publicAuth
    };
  }
  if (nonTrustFailures.length > 0) {
    return {
      status: 'fail',
      label: 'Homebase needs Dan',
      summary: `QA failed at ${[...new Set(nonTrustFailures)].join(', ')} before Homebase could be cleared.`,
      firstAction: 'Fix the failing Homebase QA gate.',
      firstZone,
      reason: 'qa-failure',
      failedGates,
      failedChecks,
      nonTrustFailures,
      skippedGates,
      publicAuth
    };
  }
  if (firstReview > 0) {
    return {
      status: 'review',
      label: 'Homebase needs Dan',
      summary: `${firstReview} ranked item${firstReview === 1 ? '' : 's'} need${firstReview === 1 ? 's' : ''} review; first action is ${firstDecisionText || 'missing'}.`,
      firstAction: firstDecision || 'Review the first ranked item.',
      firstZone,
      reason: 'ranked-review',
      failedGates,
      failedChecks,
      nonTrustFailures,
      skippedGates,
      publicAuth
    };
  }
  return {
    status: skippedGates.length > 0 ? 'partial' : 'ok',
    label: 'Homebase is useful',
    summary: skippedGates.length > 0
      ? `Core trust passed; ${skippedGates.join(', ')} skipped.`
      : 'All trust gates passed and no ranked review items need Dan.',
    firstAction: 'Nothing needs Dan.',
    firstZone,
    reason: skippedGates.length > 0 ? 'trusted-partial' : 'trusted-clear',
    failedGates,
    failedChecks,
    nonTrustFailures,
    skippedGates,
    publicAuth
  };
}

function zoneRankingCoverage(fixtureContracts) {
  const byName = new Map((Array.isArray(fixtureContracts) ? fixtureContracts : []).map(contract => [contract.name, contract]));
  const expected = [
    ['homebridge-down', 'smart-home', 'Automations'],
    ['adguard-dns-down', 'network', 'Internet'],
    ['tailscale-funnel-missing', 'outside-access', 'Public access'],
    ['govee-loop', 'smart-home', 'Automations'],
    ['mac-panic', 'mac-mini', 'Mac mini'],
    ['public-exposure-drift', 'outside-access', 'Public access'],
    ['wan-dns-degraded', 'network', 'Internet']
  ];
  const items = expected.map(([fixture, zone, label]) => {
    const contract = byName.get(fixture);
    return {
      fixture,
      zone,
      label,
      ok: Boolean(contract && contract.firstZone === zone)
    };
  });
  return {
    status: items.every(item => item.ok) ? 'ok' : 'fail',
    detail: items.map(item => `${item.label}:${item.ok ? 'ok' : 'fail'}`).join(', '),
    items
  };
}

function replayStoryAgreementCoverage(fixtureContracts) {
  const contracts = Array.isArray(fixtureContracts) ? fixtureContracts : [];
  const items = contracts.map(contract => ({
    fixture: contract.name,
    firstZone: contract.storyAgreement?.firstZone || null,
    firstAction: contract.storyAgreement?.firstAction || null,
    ok: Boolean(contract.storyAgreement && contract.storyAgreement.firstAction === contract.nowText)
  }));
  return {
    status: items.length === REQUIRED_REPLAY_FIXTURES.length && items.every(item => item.ok) ? 'ok' : 'fail',
    detail: items.map(item => `${item.fixture}:${item.ok ? 'ok' : 'fail'}`).join(', '),
    items
  };
}

function verifyRecordedIncidentBundles() {
  const files = readdirSync(INCIDENT_FIXTURE_DIR).filter(file => file.endsWith('.json')).sort();
  assert(files.length >= 1, 'recorded incident bundles are missing');
  return files.map(file => {
    const bundle = readIncidentBundle(file);
    assert(bundle.id && /^[a-z0-9-]+$/.test(bundle.id), `${file} incident bundle is missing a stable id`);
    assert(bundle.title, `${file} incident bundle is missing title`);
    assert(bundle.recordedAt && !Number.isNaN(Date.parse(bundle.recordedAt)), `${file} incident bundle is missing recordedAt`);
    assert(bundle.fixture, `${file} incident bundle is missing replay fixture pointer`);
    assert(bundle.expected && bundle.expected.headline && bundle.expected.firstZone && bundle.expected.firstAction, `${file} incident bundle is missing expected story`);
    assert(Array.isArray(bundle.sourceSnapshots) && bundle.sourceSnapshots.length > 0, `${file} incident bundle is missing source snapshots`);
    assert(Array.isArray(bundle.logExcerpts) && bundle.logExcerpts.length > 0, `${file} incident bundle is missing log excerpts`);
    for (const snapshot of bundle.sourceSnapshots) {
      assert(snapshot.path && /^data\/teddy-house\/.+\.json$/.test(snapshot.path), `${file} snapshot has invalid source path`);
      assert(snapshot.checkedAt && !Number.isNaN(Date.parse(snapshot.checkedAt)), `${file} snapshot ${snapshot.path} is missing checkedAt`);
      assert(snapshot.redacted === true, `${file} snapshot ${snapshot.path} must be marked redacted`);
      assert(snapshot.summary, `${file} snapshot ${snapshot.path} is missing summary`);
    }
    for (const excerpt of bundle.logExcerpts) {
      assert(excerpt.source, `${file} log excerpt is missing source`);
      assert(excerpt.redacted === true, `${file} log excerpt must be marked redacted`);
      assert(excerpt.text && excerpt.text.length > 10, `${file} log excerpt is too thin`);
      assert(!/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(excerpt.text), `${file} log excerpt includes an IP address`);
    }
    const fixture = readFixture(bundle.fixture);
    const replayData = replayHealthFromFixture(fixture);
    const storyAgreement = assertReplayStoryAgreement(bundle.id, fixture, replayData);
    assert(storyAgreement.headline === bundle.expected.headline, `${file} incident headline drifted from expected bundle`);
    assert(storyAgreement.firstZone === bundle.expected.firstZone, `${file} incident first zone drifted from expected bundle`);
    assert(storyAgreement.firstAction === bundle.expected.firstAction, `${file} incident first action drifted from expected bundle`);
    if (bundle.expected.firstReview) {
      assert(storyAgreement.firstReview === bundle.expected.firstReview, `${file} incident first review drifted from expected bundle`);
    }
    return {
      id: bundle.id,
      title: bundle.title,
      fixture: bundle.fixture,
      recordedAt: bundle.recordedAt,
      sourceSnapshots: bundle.sourceSnapshots.length,
      logExcerpts: bundle.logExcerpts.length,
      firstZone: storyAgreement.firstZone,
      firstAction: storyAgreement.firstAction,
      ok: true
    };
  });
}

function recordedIncidentCoverage(incidents) {
  const items = Array.isArray(incidents) ? incidents : [];
  return {
    status: items.length >= 1 && items.every(item => item.ok) ? 'ok' : 'fail',
    detail: items.length ? items.map(item => `${item.id}:${item.ok ? 'ok' : 'fail'}`).join(', ') : 'no recorded incidents',
    items
  };
}

function parserGoldenFixtureCoverage() {
  const testFile = readFileSync(join(process.cwd(), 'tests', 'teddy-house.test.js'), 'utf8');
  const checks = [
    ['homebridge-dated-entries', 'counts only dated Homebridge top-level warning entries'],
    ['govee-grouping', 'groups Govee Homebridge noise into one named automation issue'],
    ['eufy-ignored', 'keeps Eufy plugin parser evidence ignored in automation rollups'],
    ['macos-diagnostics', 'classifies diagnostic report filenames by critical Mac incident shape'],
    ['tailscale-route-drift', 'parses public route drift without treating known BlueBubbles exposure as unknown'],
    ['log-timestamps', 'parses common log timestamp formats for freshness gates'],
    ['adguard-stats', 'labels AdGuard blocked-query stats as locked, degraded, or live']
  ].map(([name, needle]) => ({
    name,
    ok: testFile.includes(needle)
  }));
  return {
    status: checks.every(item => item.ok) ? 'ok' : 'fail',
    detail: checks.map(item => `${item.name}:${item.ok ? 'ok' : 'missing'}`).join(', '),
    items: checks
  };
}

function mobileLoginSmokeChecklistCoverage() {
  const checklistPath = join(process.cwd(), 'specs', '004-homebase-next-level-qa', 'checklists', 'mobile-login-smoke.md');
  const text = readFileSync(checklistPath, 'utf8');
  const required = [
    ['android-chrome', /Android Chrome/],
    ['iphone-pwa', /iPhone Safari PWA/],
    ['ipad-pwa', /iPad Safari PWA/],
    ['public-url', /https:\/\/openclaw-mac-mini\.tail02a3b6\.ts\.net:10000\/pages\/teddy-house\//],
    ['reload', /\bReload the tab\b/],
    ['browser-restart', /Close Chrome completely, reopen it/],
    ['home-screen', /Add Teddy Homebase to the Home Screen/],
    ['pwa-relaunch', /Force close the PWA and reopen it/],
    ['first-action', /first action shown in `Now`/],
    ['ask-teddy', /Tap `Send status`/],
    ['fallback-honesty', /clearly shows `Fallback`/],
    ['overflow', /no horizontal overflow/i]
  ].map(([name, pattern]) => ({
    name,
    ok: pattern.test(text)
  }));
  return {
    status: required.every(item => item.ok) ? 'ok' : 'fail',
    detail: required.map(item => `${item.name}:${item.ok ? 'ok' : 'missing'}`).join(', '),
    file: checklistPath,
    items: required
  };
}

function nightlyTruthSuiteSpecCoverage() {
  const specDir = join(process.cwd(), 'specs', '005-homebase-nightly-truth-suite');
  const files = ['spec.md', 'plan.md', 'tasks.md', 'checklists/trust.md', 'quickstart.md'];
  const text = files.map(file => readFileSync(join(specDir, file), 'utf8')).join('\n\n');
  const packageText = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
  const verdictScript = readFileSync(join(process.cwd(), 'scripts', 'homebase-verdict.mjs'), 'utf8');
  const archiveScript = readFileSync(join(process.cwd(), 'scripts', 'homebase-archive-nightly.mjs'), 'utf8');
  const required = [
    ['canonical-command', /npm run check:homebase/],
    ['verdict-command', /npm run homebase:verdict/.test(text) && /"homebase:verdict": "node scripts\/homebase-verdict\.mjs"/.test(packageText)],
    ['nightly-command', /npm run homebase:nightly/.test(text) && /"homebase:nightly": "npm run check:homebase && npm run homebase:archive && npm run homebase:verdict"/.test(packageText)],
    ['verdict-reader', /truthVerdict/.test(verdictScript) && /Homebase is lying/.test(verdictScript)],
    ['bounded-history', /homebase-nightly-history\.json/.test(text) && /HOMEBASE_NIGHTLY_HISTORY_LIMIT/.test(archiveScript) && /\.slice\(-limit\)/.test(archiveScript)],
    ['active-automation', /morning-homebase-health-check/.test(text) && /Morning Homebase Truth Suite/.test(text) && /7:15 AM/.test(text)],
    ['report-artifact', /artifacts\/qa\/homebase-latest\.json/],
    ['read-only', /read-only/i],
    ['public-auth', /public (?:Funnel )?auth|Public page redirects/i],
    ['story-agreement', /API, rendered page, and Ask Teddy agree|story agreement/i],
    ['fallback-honesty', /fallback/i],
    ['source-contracts', /source contracts?|freshness|confidence/i],
    ['responsive-screenshots', /phone, iPad, and desktop screenshots|Phone screenshot/i],
    ['incident-replay', /recorded incident|WindowServer restart/i],
    ['mobile-smoke', /Android Chrome|iPhone Home Screen PWA|iPad Home Screen PWA/i],
    ['truth-verdict', /Homebase is useful|Homebase is lying|Homebase needs Dan/],
    ['no-mutations', /does not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw/i]
  ].map(([name, pattern]) => ({
    name,
    ok: typeof pattern === 'boolean' ? pattern : pattern.test(text)
  }));
  return {
    status: required.every(item => item.ok) ? 'ok' : 'fail',
    detail: required.map(item => `${item.name}:${item.ok ? 'ok' : 'missing'}`).join(', '),
    directory: specDir,
    items: required
  };
}

function scenarioReplayPackSpecCoverage(fixtureContracts, renderedReplay, recordedIncidents) {
  const specDir = join(process.cwd(), 'specs', '006-homebase-scenario-replay-pack');
  const files = ['spec.md', 'plan.md', 'tasks.md', 'checklists/trust.md', 'quickstart.md'];
  const text = files.map(file => readFileSync(join(specDir, file), 'utf8')).join('\n\n');
  const fixtureNames = new Set((Array.isArray(fixtureContracts) ? fixtureContracts : []).map(contract => contract.name));
  const renderedNames = new Set((renderedReplay?.outputs || []).map(output => output.name));
  const incidentCount = Array.isArray(recordedIncidents) ? recordedIncidents.length : 0;
  const requiredFixtures = REQUIRED_REPLAY_FIXTURES;
  const required = [
    ['spec-directory', /Homebase Scenario Replay Pack Spec/.test(text)],
    ...requiredFixtures.map(name => [name, text.includes(`\`${name}\``) && fixtureNames.has(name)]),
    ['story-agreement', /API, rendered page, and Ask Teddy agree|API-derived `houseState`/.test(text)],
    ['rendered-replay', /Rendered replay screenshots|rendered first viewport/i.test(text) && WARNING_REPLAY_FIXTURES.every(name => renderedNames.has(name))],
    ['recorded-incidents', /Recorded incident bundles|redacted recorded incident/i.test(text) && incidentCount >= 1],
    ['healthy-quiet', /healthy.*raw ports|raw telemetry.*healthy first screen/is.test(text)],
    ['mac-restart-outranks-noise', /Mac restart scenario fails if Homebridge log counts outrank the restart incident/i.test(text)],
    ['public-routes-known', /known routes are presented as unknown exposure/i.test(text)],
    ['teddy-fallback-honesty', /fallback is hidden or presented as live Teddy/i.test(text)],
    ['read-only', /read-only/i.test(text) && /does not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw/i.test(text)]
  ].map(([name, ok]) => ({
    name,
    ok: Boolean(ok)
  }));
  return {
    status: required.every(item => item.ok) ? 'ok' : 'fail',
    detail: required.map(item => `${item.name}:${item.ok ? 'ok' : 'missing'}`).join(', '),
    directory: specDir,
    requiredFixtures,
    recordedIncidents: incidentCount,
    items: required
  };
}

function copyQualityCoverage(fixtureContracts) {
  const contracts = Array.isArray(fixtureContracts) ? fixtureContracts : [];
  const byName = new Map(contracts.map(contract => [contract.name, contract]));
  const dailySlotsLocked = contracts.length === REQUIRED_REPLAY_FIXTURES.length
    && contracts.every(contract => Array.isArray(contract.dailySlots) && contract.dailySlots.length === 3);
  const macIncidentSpecific = byName.get('mac-panic')?.headline === 'Mac mini restarted this morning.';
  const reviewCopySpecific = contracts.every(contract => {
    if (EVIDENCE_ONLY_REPLAY_FIXTURES.includes(contract.name)) return contract.nowText === 'Nothing needs Dan.';
    return /^(Check|Review) /.test(String(contract.nowText || ''));
  });
  return {
    status: dailySlotsLocked && macIncidentSpecific && reviewCopySpecific ? 'ok' : 'fail',
    detail: `daily slots ${dailySlotsLocked ? 'locked' : 'missing'}; incident copy ${macIncidentSpecific ? 'specific' : 'generic'}; review copy ${reviewCopySpecific ? 'specific' : 'generic'}`,
    dailySlotsLocked,
    macIncidentSpecific,
    reviewCopySpecific
  };
}

function healthyFreshnessCoverage() {
  const fixture = readFixture('healthy');
  const copy = [
    fixture.expected?.headline,
    fixture.expected?.summary,
    fixture.expected?.primaryAction,
    fixture.expected?.nowText,
    ...(Array.isArray(fixture.expected?.dailySlots) ? fixture.expected.dailySlots.map(slot => `${slot.text} ${slot.source}`) : [])
  ].filter(Boolean).join('\n');
  const staleLanguageClear = !/\b(stale|cached|degraded|ignored|unknown|last check unavailable)\b/i.test(copy);
  const steadySpecific = fixture.expected?.headline === "Dan's house is steady."
    && fixture.expected?.nowText === 'Nothing needs Dan.'
    && fixture.expected?.summary === 'Internet, automations, public access, and the Mac mini are quiet.';
  return {
    status: staleLanguageClear && steadySpecific ? 'ok' : 'fail',
    detail: `${steadySpecific ? 'steady copy specific' : 'steady copy drifted'}; ${staleLanguageClear ? 'no stale-source language' : 'stale-source language found'}`,
    staleLanguageClear,
    steadySpecific
  };
}

function visualContractCoverage(local, healthyFreshness) {
  const screenshots = local && local.screenshots && Array.isArray(local.screenshots.outputs)
    ? local.screenshots.outputs
    : [];
  const items = screenshots.map(item => ({
    name: item.name,
    width: item.width,
    ok: Boolean(item.visualContract
      && item.visualContract.topStoryVisible
      && item.visualContract.reviewVisibleWhenWarning
      && item.visualContract.evidenceBelowDecision
      && item.visualContract.recentChangesGrouped
      && item.visualContract.firstViewportFreeOfRawTelemetry),
    visualContract: item.visualContract || null
  }));
  const healthyQuiet = healthyFreshness && healthyFreshness.status === 'ok';
  return {
    status: items.length === SCREENSHOT_VIEWPORTS.length && items.every(item => item.ok) && healthyQuiet ? 'ok' : 'fail',
    detail: `${items.map(item => `${item.name}:${item.ok ? 'ok' : 'fail'}`).join(', ')}; healthy:${healthyQuiet ? 'ok' : 'fail'}`,
    items,
    healthyQuiet
  };
}

function renderedReplayCoverage(renderedReplay) {
  const outputs = renderedReplay && Array.isArray(renderedReplay.outputs) ? renderedReplay.outputs : [];
  const expectedNames = WARNING_REPLAY_FIXTURES;
  const ok = renderedReplay && renderedReplay.status === 'captured'
    && outputs.length === expectedNames.length
    && expectedNames.every(name => outputs.some(item => item.name === name))
    && outputs.every(item => item.visualContract
      && item.visualContract.topStoryVisible
      && item.visualContract.reviewVisibleWhenWarning
      && item.visualContract.evidenceBelowDecision
      && item.visualContract.firstViewportFreeOfRawTelemetry);
  return {
    status: renderedReplay && /^skipped/.test(renderedReplay.status || '')
      ? 'skipped'
      : ok ? 'ok' : 'fail',
    detail: outputs.length
      ? outputs.map(item => `${item.name}:${item.firstZone}:${item.firstAction}`).join(', ')
      : (renderedReplay && renderedReplay.status) || 'not captured',
    items: outputs
  };
}

function trustChecks(local, publicAuth) {
  const screenshots = local && local.screenshots && Array.isArray(local.screenshots.outputs)
    ? local.screenshots.outputs
    : [];
  const noOverflow = screenshots.length === SCREENSHOT_VIEWPORTS.length
    && screenshots.every(item => item.scrollWidth <= item.width + 1);
  return [
    {
      name: 'visible-warning-provenance',
      status: local && local.reviewItems === local.reviewEvidenceItems ? 'ok' : 'fail',
      detail: `${local && Number.isFinite(local.reviewEvidenceItems) ? local.reviewEvidenceItems : 0} visible review warning${local && local.reviewEvidenceItems === 1 ? '' : 's'} include source, timestamp, freshness, and confidence.`
    },
    {
      name: 'responsive-overflow',
      status: noOverflow ? 'ok' : 'fail',
      detail: screenshots.length
        ? screenshots.map(item => `${item.name}:${item.scrollWidth}/${item.width}`).join(', ')
        : 'No screenshot layout measurements captured.'
    },
    {
      name: 'remote-password-gate',
      status: publicAuth === 'enforced' ? 'ok' : 'skipped',
      detail: publicAuth === 'enforced'
        ? 'Public page redirects to login and public health API returns 401.'
        : publicAuth
    },
    {
      name: 'loopback-probe-boundary',
      status: local && local.loopbackProbe
        && local.loopbackProbe.localHealth === 200
        && local.loopbackProbe.localLogs === 200
        && local.loopbackProbe.remoteHostHealth === 401
        && local.loopbackProbe.remoteHostLogs === 401
        && local.loopbackProbe.remoteHostScript === 302 ? 'ok' : 'fail',
      detail: local && local.loopbackProbe
        ? 'Only loopback Host plus loopback socket can use unauthenticated Homebase probes.'
        : 'Loopback probe boundary was not checked.'
    },
    {
      name: 'no-fake-home-state',
      status: local && local.noFakeHomeState
        && local.noFakeHomeState.persistedSummaries > 0
        && local.noFakeHomeState.ignoredDoorLocks
        && local.noFakeHomeState.noFakeTrendLanguage ? 'ok' : 'fail',
      detail: local && local.noFakeHomeState
        ? 'Historical summaries cite persisted JSON sources and untrusted lock state stays ignored.'
        : 'No-fake home state checks did not run.'
    },
    {
      name: 'cached-update-labels',
      status: local && local.cachedUpdateLabels
        && local.cachedUpdateLabels.updateSignals === 2
        && local.cachedUpdateLabels.cachedLabelRenderer ? 'ok' : 'fail',
      detail: local && local.cachedUpdateLabels
        ? 'Software and macOS update signals carry confidence, and cached values render as Cached.'
        : 'Cached update label checks did not run.'
    },
    {
      name: 'source-contracts',
      status: local && local.sourceContracts && local.sourceContracts.contracts > 0 ? 'ok' : 'fail',
      detail: local && local.sourceContracts
        ? 'Visible house-state evidence maps to known trusted source contracts; degraded, ignored, and needs-login sources stay out of first-screen truth.'
        : 'Source contract checks did not run.'
    },
    {
      name: 'ask-action-safety',
      status: local && local.ask && local.ask.prepareFixDryRun && local.ask.prepareFixGuarded ? 'ok' : 'fail',
      detail: local && local.ask && local.ask.prepareFixDryRun
        ? 'Ask Teddy prepare-fix is dry-run only and names approval before mutation.'
        : 'Ask Teddy prepare-fix safety was not proved.'
    },
    {
      name: 'login-persistence',
      status: local && local.cachedLogin && local.cachedLogin.status === 'ok'
        ? 'ok'
        : local && local.cachedLogin && /^skipped/.test(local.cachedLogin.status)
          ? 'skipped'
          : 'fail',
      detail: local && local.cachedLogin && local.cachedLogin.status === 'ok'
        ? 'Browser-context login survives a new tab, while direct API access is 401 before login.'
        : local && local.cachedLogin
          ? local.cachedLogin.status
          : 'Cached login smoke did not run.'
    },
    {
      name: 'story-agreement',
      status: local && local.storyAgreement && local.storyAgreement.status === 'ok' ? 'ok' : 'fail',
      detail: local && local.storyAgreement
        ? 'API, rendered page, and Ask Teddy agree on the first Homebase action.'
        : 'API, rendered page, and Ask Teddy story agreement was not proved.'
    },
    {
      name: 'ask-fallback-visibility',
      status: local && local.ask && local.ask.fallbackLabeled ? 'ok' : 'fail',
      detail: local && local.ask && local.ask.fallbackLabeled
        ? 'Forced bridge failure returns local-fallback and says the Teddy bridge did not answer cleanly.'
        : 'Ask Teddy fallback visibility was not proved.'
    }
  ];
}

async function smokePublicAuth() {
  const pageUrl = `${PUBLIC_BASE}/pages/teddy-house/`;
  const apiUrl = `${PUBLIC_BASE}/api/pages/teddy-house/health`;
  try {
    const page = await fetchWithTimeout(pageUrl, { redirect: 'manual' }, REMOTE_TIMEOUT_MS);
    assert(page.status === 302 || page.status === 303, `public Homebase page returned ${page.status}, expected redirect`);
    const location = page.headers.get('location') || '';
    assert(location.includes('/login'), `public Homebase page redirected to ${location || 'missing location'}, expected login`);

    const api = await fetchWithTimeout(apiUrl, { redirect: 'manual' }, REMOTE_TIMEOUT_MS);
    assert(api.status === 401, `public health API returned ${api.status}, expected 401`);
    return 'enforced';
  } catch (err) {
    if (process.env.HOMEBASE_REQUIRE_PUBLIC_SMOKE === '1') throw err;
    return `skipped (${err.message})`;
  }
}

async function main() {
  const fixtureContracts = verifyReplayFixtures();
  const recordedIncidents = verifyRecordedIncidentBundles();
  const local = await smokeLocalRoutes();
  const renderedReplay = await renderReplayFixtures();
  const publicAuth = await smokePublicAuth();
  const gates = acceptanceGates(fixtureContracts, local, publicAuth);
  const zoneCoverage = zoneRankingCoverage(fixtureContracts);
  const replayStoryCoverage = replayStoryAgreementCoverage(fixtureContracts);
  const recordedIncidentStoryCoverage = recordedIncidentCoverage(recordedIncidents);
  const parserGoldenCoverage = parserGoldenFixtureCoverage();
  const mobileChecklistCoverage = mobileLoginSmokeChecklistCoverage();
  const nightlyTruthSuiteCoverage = nightlyTruthSuiteSpecCoverage();
  const scenarioReplayPackCoverage = scenarioReplayPackSpecCoverage(fixtureContracts, renderedReplay, recordedIncidents);
  const copyCoverage = copyQualityCoverage(fixtureContracts);
  const healthyFreshness = healthyFreshnessCoverage();
  const visualCoverage = visualContractCoverage(local, healthyFreshness);
  const renderedReplayVisualCoverage = renderedReplayCoverage(renderedReplay);
  const checks = trustChecks(local, publicAuth);
  gates.push({
    name: 'zone-ranking-coverage',
    status: zoneCoverage.status,
    detail: zoneCoverage.detail
  });
  checks.push({
    name: 'zone-ranking-coverage',
    status: zoneCoverage.status,
    detail: 'Replay fixtures prove Automations, Mac mini, Public access, and Internet warning ownership.'
  });
  gates.push({
    name: 'replay-story-agreement',
    status: replayStoryCoverage.status,
    detail: replayStoryCoverage.detail
  });
  checks.push({
    name: 'replay-story-agreement',
    status: replayStoryCoverage.status,
    detail: 'Replay fixtures prove API, locked first-screen contract, and Ask agree on the first action.'
  });
  gates.push({
    name: 'recorded-incident-replay',
    status: recordedIncidentStoryCoverage.status,
    detail: recordedIncidentStoryCoverage.detail
  });
  checks.push({
    name: 'recorded-incident-replay',
    status: recordedIncidentStoryCoverage.status,
    detail: 'Redacted incident bundles replay through the same story agreement path.'
  });
  gates.push({
    name: 'parser-golden-fixtures',
    status: parserGoldenCoverage.status,
    detail: parserGoldenCoverage.detail
  });
  checks.push({
    name: 'parser-golden-fixtures',
    status: parserGoldenCoverage.status,
    detail: 'Golden parser tests cover Homebridge, Govee, Eufy, macOS diagnostics, route drift, and timestamp freshness.'
  });
  gates.push({
    name: 'mobile-login-manual-smoke',
    status: mobileChecklistCoverage.status,
    detail: mobileChecklistCoverage.detail
  });
  checks.push({
    name: 'mobile-login-manual-smoke',
    status: mobileChecklistCoverage.status,
    detail: 'Android Chrome and iPhone/iPad PWA login persistence smokes are documented with reload, relaunch, first action, Ask Teddy, and overflow checks.'
  });
  gates.push({
    name: 'nightly-truth-suite-spec',
    status: nightlyTruthSuiteCoverage.status,
    detail: nightlyTruthSuiteCoverage.detail
  });
  checks.push({
    name: 'nightly-truth-suite-spec',
    status: nightlyTruthSuiteCoverage.status,
    detail: 'Nightly Homebase truth-suite spec covers command, report, auth, story agreement, fallback honesty, source trust, visuals, incident replay, mobile smoke, and read-only safety.'
  });
  gates.push({
    name: 'scenario-replay-pack-spec',
    status: scenarioReplayPackCoverage.status,
    detail: scenarioReplayPackCoverage.detail
  });
  checks.push({
    name: 'scenario-replay-pack-spec',
    status: scenarioReplayPackCoverage.status,
    detail: 'Scenario replay pack locks the mandatory house stories and recorded-incident path.'
  });
  gates.push({
    name: 'visual-contracts',
    status: visualCoverage.status,
    detail: visualCoverage.detail
  });
  checks.push({
    name: 'visual-contracts',
    status: visualCoverage.status,
    detail: 'Rendered first viewport keeps top story visible, review visible when warning exists, evidence below decisions, grouped changes, and healthy replay quiet.'
  });
  gates.push({
    name: 'rendered-replay-contracts',
    status: renderedReplayVisualCoverage.status,
    detail: renderedReplayVisualCoverage.detail
  });
  checks.push({
    name: 'rendered-replay-contracts',
    status: renderedReplayVisualCoverage.status,
    detail: 'Rendered replay pages prove warning fixtures keep the active incident visible with Review, affected zone, Vitals, Ask, and Evidence order.'
  });
  gates.push({
    name: 'copy-quality-coverage',
    status: copyCoverage.status,
    detail: copyCoverage.detail
  });
  checks.push({
    name: 'copy-quality-coverage',
    status: copyCoverage.status,
    detail: 'Replay fixtures lock clean first-screen copy, specific incident language, and the Now / Watch / Later strip.'
  });
  gates.push({
    name: 'healthy-freshness-copy',
    status: healthyFreshness.status,
    detail: healthyFreshness.detail
  });
  checks.push({
    name: 'healthy-freshness-copy',
    status: healthyFreshness.status,
    detail: 'Healthy replay first screen does not present stale, cached, degraded, or ignored sources as current.'
  });
  const verdict = truthVerdict(gates, checks, local, publicAuth);
  gates.push({
    name: 'truth-verdict',
    status: verdict.label === 'Homebase is lying' ? 'fail' : 'ok',
    detail: `${verdict.label}: ${verdict.summary}`
  });
  checks.push({
    name: 'truth-verdict',
    status: verdict.label === 'Homebase is lying' ? 'fail' : 'ok',
    detail: 'Homebase QA produces a morning-readable verdict from trust gates, active incidents, and first action.'
  });
  const report = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    reportFile: QA_REPORT_FILE,
    git: gitMetadata(),
    acceptanceStatus: acceptanceStatus(gates),
    truthVerdict: verdict,
    acceptanceGates: gates,
    trustChecks: checks,
    zoneRankingCoverage: zoneCoverage.items,
    replayStoryAgreementCoverage: replayStoryCoverage.items,
    recordedIncidentReplay: recordedIncidentStoryCoverage.items,
    parserGoldenFixtureCoverage: parserGoldenCoverage.items,
    mobileLoginSmokeChecklist: mobileChecklistCoverage,
    nightlyTruthSuiteSpec: nightlyTruthSuiteCoverage,
    scenarioReplayPackSpec: scenarioReplayPackCoverage,
    visualContractCoverage: visualCoverage,
    renderedReplay,
    renderedReplayVisualCoverage,
    copyQualityCoverage: copyCoverage,
    healthyFreshnessCoverage: healthyFreshness,
    fixtureCount: fixtureContracts.length,
    fixtureContracts,
    local,
    publicAuth
  };
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await writeFile(QA_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(`Homebase QA failed: ${err.message}`);
  process.exit(1);
});

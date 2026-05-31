#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { startServer } from '../helpers/server.js';

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
const EXPECTED_ZONE_IDS = ['outside-access', 'network', 'smart-home', 'mac-mini'];
const EXPECTED_DAILY_SLOT_KEYS = ['now', 'watch', 'later'];
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

async function fetchWithTimeout(url, options = {}, timeoutMs = LOCAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
        firstZone: layout.firstZone,
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
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await chromeCommand(chrome, 'Runtime.evaluate', {
      expression: `(() => {
        const title = document.getElementById("summary-title")?.textContent || "";
        const status = document.getElementById("last-check")?.textContent || "";
        const zones = document.getElementById("house-zone-grid")?.children.length || 0;
        const ready = zones === 4 && !/Checking|Could not refresh/i.test(title) && !/Waiting|Refreshing/i.test(status);
        return { ready, title, status, zones };
      })()`,
      returnByValue: true
    }, sessionId);
    if (result.result && result.result.value && result.result.value.ready) return result.result.value;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Homebase did not render loaded health state before screenshot');
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

async function assertRenderedFirstScreen(chrome, sessionId, width) {
  const result = await chromeCommand(chrome, 'Runtime.evaluate', {
    expression: `(() => {
      const textOf = selector => document.querySelector(selector)?.innerText?.trim() || "";
      const topOf = selector => {
        const el = document.querySelector(selector);
        if (!el || el.hidden) return null;
        return Math.round(el.getBoundingClientRect().top);
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
      const zoneCount = document.querySelectorAll("#house-zone-grid .house-zone-card").length;
      const historyCount = document.querySelectorAll("#history-grid .history-card").length;
      return {
        width: window.innerWidth,
        summaryTitle: textOf("#summary-title"),
        summaryCopy: textOf("#summary-copy"),
        firstZone,
        zoneCount,
        historyCount,
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
          timeline: topOf("#timeline")
        }
      };
    })()`,
    returnByValue: true
  }, sessionId);
  const value = result.result && result.result.value ? result.result.value : {};
  assert(value.summaryTitle && !/Checking|Could not refresh/i.test(value.summaryTitle), `rendered summary is not loaded at ${width}px: ${JSON.stringify(value)}`);
  assert(value.zoneCount === 4, `rendered house-state zones missing at ${width}px: ${JSON.stringify(value)}`);
  assert(value.firstZone, `rendered first house zone missing at ${width}px`);
  assert(value.historyCount >= 1, `rendered history summaries missing at ${width}px: ${JSON.stringify(value)}`);
  assert(value.positions.houseState !== null, `house-state section missing at ${width}px`);
  assert(value.positions.evidence === null || value.positions.houseState < value.positions.evidence, `evidence appears before house state at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.signals === null || value.positions.houseState < value.positions.signals, `signals appear before house state at ${width}px: ${JSON.stringify(value.positions)}`);
  assert(value.positions.history === null || value.positions.signals === null || value.positions.signals < value.positions.history, `history appears before evidence signals at ${width}px: ${JSON.stringify(value.positions)}`);
  for (const pattern of RENDERED_FIRST_SCREEN_COPY_BLACKLIST) {
    assert(!pattern.test(value.firstScreenText || ''), `rendered first-screen copy matched blacklist ${pattern} at ${width}px: ${value.firstScreenText}`);
  }
  return {
    firstZone: value.firstZone,
    firstScreenTextLength: (value.firstScreenText || '').length
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
    assertFirstScreenCopyClean(data, 'local health');

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

    const logs = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/logs`);
    assert(logs.status === 200, `local logs returned ${logs.status}`);
    const logData = await logs.json();
    assertLogsDetailContract(logData);
    const screenshots = await captureScreenshots(srv.baseUrl);
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
        answerLength: String(askData.answer || '').length
      },
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
    contracts.push({
      name,
      headline: fixture.expected.headline,
      firstZone: fixture.expected.firstZone,
      nowText: fixture.expected.nowText,
      zoneOrder: fixture.expected.zoneOrder,
      dailySlots: fixture.expected.dailySlots.map(slot => `${slot.key}:${slot.source}`)
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
      status: fixtureContracts.length === 6 ? 'ok' : 'fail',
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
      status: local && local.ask && local.ask.status === 'complete' && local.ask.answerLength > 0 ? 'ok' : 'fail',
      detail: local && local.ask ? `${local.ask.source} answer, ${local.ask.answerLength} chars, ${persisted.askHistoryEntries || 0} persisted.` : 'Ask Teddy did not answer.'
    },
    {
      name: 'public-auth',
      status: publicAuth === 'enforced' ? 'ok' : 'skipped',
      detail: publicAuth
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
  const local = await smokeLocalRoutes();
  const publicAuth = await smokePublicAuth();
  const gates = acceptanceGates(fixtureContracts, local, publicAuth);
  const report = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    reportFile: QA_REPORT_FILE,
    git: gitMetadata(),
    acceptanceStatus: acceptanceStatus(gates),
    acceptanceGates: gates,
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

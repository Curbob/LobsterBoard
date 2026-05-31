#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from '../helpers/server.js';

const LOCAL_TIMEOUT_MS = 12000;
const REMOTE_TIMEOUT_MS = 5000;
const PUBLIC_BASE = process.env.HOMEBASE_PUBLIC_URL || 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000';
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readFixture(name) {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'teddy-house', `${name}.json`), 'utf8'));
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

async function smokeLocalRoutes() {
  const srv = await startServer({ password: 'Danno' });
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
    assertFirstScreenCopyClean(data, 'local health');

    const logs = await fetchWithTimeout(`${srv.baseUrl}/api/pages/teddy-house/logs`);
    assert(logs.status === 200, `local logs returned ${logs.status}`);
    const logData = await logs.json();
    assert(Array.isArray(logData.serviceLogs?.items), 'grouped service logs are missing');

    return {
      score: data.score,
      headline: data.houseState.headline,
      firstZone: data.houseState.zones[0].id,
      firstDecision: data.dailyDecision.slots[0].text
    };
  } finally {
    await srv.kill();
  }
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
  for (const [name, [zone, nowText]] of Object.entries(expected)) {
    const fixture = readFixture(name);
    assert(fixture.expected?.firstZone === zone, `${name} fixture first zone drifted`);
    assert(fixture.expected?.nowText === nowText, `${name} fixture daily decision drifted`);
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
  }
  return Object.keys(expected).length;
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
  const fixtureCount = verifyReplayFixtures();
  const local = await smokeLocalRoutes();
  const publicAuth = await smokePublicAuth();
  console.log(JSON.stringify({
    status: 'ok',
    fixtureCount,
    local,
    publicAuth
  }, null, 2));
}

main().catch(err => {
  console.error(`Homebase QA failed: ${err.message}`);
  process.exit(1);
});

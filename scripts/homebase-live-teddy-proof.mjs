import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const publicUrl = 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/';
const proofPath = process.env.HOMEBASE_LIVE_TEDDY_PROOF_FILE
  || join(process.cwd(), 'artifacts', 'qa', 'homebase-live-teddy-proof-latest.json');
const maxAgeDays = Number.parseInt(process.env.HOMEBASE_LIVE_TEDDY_PROOF_MAX_AGE_DAYS || '14', 10);
const runLive = process.env.HOMEBASE_RUN_LIVE_TEDDY_PROOF === '1';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ageDays(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return Infinity;
  return (Date.now() - time) / 86400000;
}

function answerMentionsFirstAction(answer, firstAction) {
  const text = String(answer || '').toLowerCase();
  const action = String(firstAction || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (!text || !action) return false;
  const keyWords = action.split(/\s+/).filter(word => word.length > 3);
  return keyWords.length === 0 || keyWords.some(word => text.includes(word));
}

function validateLiveTeddyProof(proof, path = proofPath) {
  const failures = [];
  if (!proof || typeof proof !== 'object') failures.push('proof object missing');
  if (proof?.version !== 1) failures.push('version must be 1');
  if (proof?.publicUrl !== publicUrl) failures.push('publicUrl must be the approved Homebase Funnel route');
  if (!proof?.capturedAt || !Number.isFinite(Date.parse(proof.capturedAt))) failures.push('capturedAt must be an ISO timestamp');
  if (ageDays(proof?.capturedAt) > maxAgeDays) failures.push(`proof is older than ${maxAgeDays} days`);
  if (proof?.agentMode !== 'enabled') failures.push('agentMode must be enabled');
  if (proof?.source !== 'teddy') failures.push(`source must be teddy, got ${proof?.source || 'missing'}`);
  if (proof?.status !== 'complete') failures.push(`status must be complete, got ${proof?.status || 'missing'}`);
  if (typeof proof?.firstAction !== 'string' || proof.firstAction.length === 0) failures.push('firstAction missing');
  if (typeof proof?.answer !== 'string' || proof.answer.length < 20) failures.push('answer missing or too short');
  if (!answerMentionsFirstAction(proof?.answer, proof?.firstAction)) failures.push('answer does not mention the first action');
  if (proof?.fallbackVisible === true) failures.push('fallbackVisible must be false for live Teddy proof');
  if (/\b(Axon|pipeline|quota|booking|Maria|birthday|calendar|email|inbox)\b/i.test(String(proof?.answer || ''))) {
    failures.push('answer escaped Homebase scope');
  }
  return {
    status: failures.length === 0 ? 'ok' : 'partial',
    detail: failures.length === 0
      ? `Live Teddy answered "${proof.firstAction}" from ${path}`
      : failures.join('; '),
    proofPath: path,
    source: proof?.source || null,
    firstAction: proof?.firstAction || null
  };
}

function liveTeddyProofStatus(path = proofPath) {
  if (!existsSync(path)) {
    return {
      status: 'partial',
      detail: `No live Teddy proof artifact found at ${path}`,
      proofPath: path,
      source: null,
      firstAction: null
    };
  }
  return validateLiveTeddyProof(readJson(path), path);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.HOMEBASE_LIVE_TEDDY_HTTP_TIMEOUT_MS || 90000));
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl, serverState) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (serverState.exited) {
      throw new Error(serverState.stderr || `local Homebase proof server exited ${serverState.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/pages/teddy-house/health`);
      if (res.status === 200) return;
    } catch (_) {
      // Keep waiting for the local proof server.
    }
    await wait(250);
  }
  throw new Error('local Homebase proof server did not become ready');
}

async function runLiveTeddyProof() {
  const port = process.env.HOMEBASE_LIVE_TEDDY_PORT || '18085';
  const baseUrl = `http://127.0.0.1:${port}`;
  const repoRoot = process.cwd();
  const proofCwd = mkdtempSync(join(tmpdir(), 'homebase-live-teddy-proof-'));
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    LOBSTERBOARD_PKG_DIR: repoRoot,
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || 'Danno',
    TEDDY_HOMEBASE_ASK_AGENT: '1',
    TEDDY_HOMEBASE_ASK_LOCAL_ONLY: '0',
    TEDDY_HOMEBASE_ASK_TIMEOUT_MS: process.env.TEDDY_HOMEBASE_ASK_TIMEOUT_MS || '60000'
  };
  const server = spawn(process.execPath, [join(repoRoot, 'server.cjs')], {
    cwd: proofCwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const serverState = { exited: false, exitCode: null, stderr: '' };
  server.stderr.on('data', chunk => { serverState.stderr += chunk; });
  server.on('exit', code => {
    serverState.exited = true;
    serverState.exitCode = code;
  });
  try {
    await waitForServer(baseUrl, serverState);
    const health = await fetchJson(`${baseUrl}/api/pages/teddy-house/health`);
    if (health.status !== 200 || !health.json) throw new Error(`health returned ${health.status}`);
    const firstAction = health.json.dailyDecision?.slots?.find(slot => slot?.key === 'now')?.text
      || health.json.dailyDecision?.now?.text
      || health.json.houseState?.primaryAction
      || 'Summarize current Homebase status.';
    const ask = await fetchJson(`${baseUrl}/api/pages/teddy-house/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        prompt: 'What matters right now? Use the current Homebase context.',
        context: health.json
      })
    });
    if (ask.status !== 200 || !ask.json) throw new Error(`ask returned ${ask.status}`);
    const proof = {
      version: 1,
      capturedAt: new Date().toISOString(),
      publicUrl,
      localProbeUrl: `${baseUrl}/pages/teddy-house/`,
      agentMode: 'enabled',
      status: ask.json.status,
      source: ask.json.source,
      firstAction,
      answer: String(ask.json.answer || ''),
      fallbackVisible: ask.json.source === 'local-fallback',
      run: ask.json.run || null
    };
    mkdirSync(dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
    return validateLiveTeddyProof(proof);
  } finally {
    server.kill();
    rmSync(proofCwd, { recursive: true, force: true });
    if (serverState.stderr && process.env.HOMEBASE_LIVE_TEDDY_DEBUG === '1') process.stderr.write(serverState.stderr);
  }
}

async function main() {
  const result = runLive ? await runLiveTeddyProof() : liveTeddyProofStatus();
  console.log(`Homebase live Teddy proof: ${result.status}`);
  console.log(result.detail);
  if (!runLive) {
    console.log('Set HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 to run the opt-in live Hermes bridge proof.');
  }
  if (result.status !== 'ok' && process.env.HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF === '1') process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error(`Homebase live Teddy proof: error`);
    console.error(err.message);
    if (runLive || process.env.HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF === '1') process.exit(1);
  });
}

export { liveTeddyProofStatus, validateLiveTeddyProof };

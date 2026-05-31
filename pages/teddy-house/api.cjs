const dns = require('dns').promises;
const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');

const TIMEOUT_MS = 2200;
const TAILSCALE_BIN = process.env.TAILSCALE_BIN || '/usr/local/bin/tailscale';
const TAILSCALE_TIMEOUT_MS = Number(process.env.TEDDY_HOMEBASE_TAILSCALE_TIMEOUT_MS || 8000);
const TEDDY_ASK_TIMEOUT_MS = Number(process.env.TEDDY_HOMEBASE_ASK_TIMEOUT_MS || 60000);
const TEDDY_ASK_MAX_PROMPT = 600;
const TIMELINE_LIMIT = 80;
const HOUR_MS = 60 * 60 * 1000;
const MANUAL_VERIFICATION_TTL_MS = 4 * HOUR_MS;
const UPDATE_CACHE_MS = 12 * HOUR_MS;
const MAC_UPDATE_CACHE_MS = 6 * HOUR_MS;
const SYSTEM_LOG_CACHE_MS = 10 * 60 * 1000;
const MAC_UPDATE_CACHE_SCHEMA = 'mac-updates-v2';
const SYSTEM_LOG_CACHE_SCHEMA = 'system-logs-v4';
const EVIDENCE_LIMIT = 120;
const VITALS_HISTORY_LIMIT = 500;
const VITALS_PEAK_WINDOW_MS = 6 * HOUR_MS;
const BOOT_HISTORY_LIMIT = 120;
const BOOT_HISTORY_WINDOW_MS = 7 * 24 * HOUR_MS;
const WAN_HISTORY_LIMIT = 500;
const WAN_HISTORY_WINDOW_MS = 24 * HOUR_MS;
const PUBLIC_ACCESS_HISTORY_LIMIT = 120;
const AUTOMATION_LOG_HISTORY_LIMIT = 120;
const DEFAULT_SERVICE_KEYS = ['adguard', 'homebridge', 'tailscale', 'internet', 'openclaw'];
const DEFAULT_ZONE_KEYS = ['outside-access', 'network', 'smart-home', 'mac-mini'];
const DEFAULT_SIGNAL_KEYS = [
  'adguardBlocks',
  'homebridgeAccessories',
  'homebridgeLogs',
  'publicFunnel',
  'wanQuality',
  'serviceLogs',
  'softwareUpdates',
  'macUpdates',
  'systemLogs'
];
const SERVICE_NAMES = {
  adguard: 'DNS',
  homebridge: 'Homebridge',
  tailscale: 'Tailscale',
  internet: 'Internet',
  openclaw: 'OpenClaw',
  backups: 'Backups'
};
const HIDDEN_BY_DEFAULT = {
  services: ['backups'],
  signals: ['doorLocks', 'weirdThings'],
  sections: ['readout', 'dependencyMap']
};

function nowIso() {
  return new Date().toISOString();
}

function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    })
  ]);
}

async function tcpCheck(host, port) {
  return withTimeout(new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.once('error', reject);
    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy(new Error('timeout'));
    });
  }));
}

async function fetchCheck(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { status: res.status, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { status: res.status, ms: Date.now() - started, json };
  } finally {
    clearTimeout(timer);
  }
}

function run(command, args, ms = TIMEOUT_MS) {
  return withTimeout(new Promise((resolve, reject) => {
    execFile(command, args, { timeout: ms, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve(stdout);
    });
  }), ms);
}

async function tryRun(command, args, ms = TIMEOUT_MS) {
  try {
    return { ok: true, stdout: await run(command, args, ms), stderr: '' };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || err.message };
  }
}

function runFull(command, args, ms = TIMEOUT_MS) {
  return withTimeout(new Promise((resolve, reject) => {
    execFile(command, args, { timeout: ms, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  }), ms);
}

async function tryRunFull(command, args, ms = TIMEOUT_MS) {
  try {
    return { ok: true, ...(await runFull(command, args, ms)) };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || err.message };
  }
}

function ok(detail, metric, check, confidence = 'live') {
  return { state: 'ok', detail, metric, check, confidence };
}

function warn(detail, metric, check, confidence = 'live') {
  return { state: 'warn', detail, metric, check, confidence };
}

function info(detail, metric, check, confidence = 'live') {
  return { state: 'info', detail, metric, check, confidence };
}

function bad(detail, metric, check, confidence = 'live') {
  return { state: 'bad', detail, metric, check, confidence };
}

function pickObjectEntries(obj, limit = 3) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function compareVersions(current, latest) {
  if (!current || !latest || current === latest) return 0;
  const currentParts = String(current).split(/[.-]/).map(part => Number.parseInt(part, 10));
  const latestParts = String(latest).split(/[.-]/).map(part => Number.parseInt(part, 10));
  const length = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < length; i++) {
    const a = Number.isFinite(currentParts[i]) ? currentParts[i] : 0;
    const b = Number.isFinite(latestParts[i]) ? latestParts[i] : 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

function readDataSafe(ctx, filename, fallback) {
  try {
    if (!ctx || typeof ctx.readData !== 'function') return fallback;
    return ctx.readData(filename);
  } catch (_) {
    return fallback;
  }
}

function writeDataSafe(ctx, filename, obj) {
  try {
    if (!ctx || typeof ctx.writeData !== 'function') return;
    ctx.writeData(filename, obj);
  } catch (_) {}
}

function summarizeForTeddy(context) {
  const data = context && typeof context === 'object' ? context : {};
  const services = data.services && typeof data.services === 'object' ? data.services : {};
  const intelligence = data.intelligence && typeof data.intelligence === 'object' ? data.intelligence : {};
  const serviceSummary = Object.entries(services)
    .filter(([key]) => DEFAULT_SERVICE_KEYS.includes(key))
    .map(([key, service]) => `${SERVICE_NAMES[key] || key}: ${service.state || 'unknown'} (${service.metric || '--'})`)
    .join('; ');
  const review = Array.isArray(data.needsDan) ? data.needsDan.slice(0, 8).join('; ') : '';
  const memory = Array.isArray(data.historicalSummaries)
    ? data.historicalSummaries
      .filter(summary => summary && summary.source)
      .slice(0, 6)
      .map(summary => ({
        id: summary.id || null,
        title: summary.title || null,
        window: summary.window || null,
        value: summary.value || null,
        detail: summary.detail || null,
        sampleCount: summary.sampleCount ?? null,
        source: summary.source || null
      }))
    : [];
  return {
    checkedAt: data.checkedAt || null,
    score: data.score ?? null,
    houseState: data.houseState && typeof data.houseState === 'object'
      ? {
          headline: data.houseState.headline || null,
          summary: data.houseState.summary || null,
          tone: data.houseState.tone || null,
          primaryAction: data.houseState.primaryAction || null,
          zones: Array.isArray(data.houseState.zones)
            ? data.houseState.zones.map(zone => ({
                id: zone.id,
                title: zone.title,
                state: zone.state,
                value: zone.value,
                detail: zone.detail
              }))
            : []
        }
      : null,
    dailyDecision: data.dailyDecision && Array.isArray(data.dailyDecision.slots)
      ? {
          now: data.dailyDecision.slots.find(slot => slot && slot.key === 'now') || null,
          slots: data.dailyDecision.slots.map(slot => ({
            key: slot.key || null,
            label: slot.label || null,
            text: slot.text || null,
            state: slot.state || null,
            source: slot.source || null
          }))
        }
      : null,
    summary: serviceSummary || 'No service summary supplied.',
    review: review || 'No review items supplied.',
    memory,
    signals: {
      externalAccess: intelligence.tailscaleFunnel ? stripSignal(intelligence.tailscaleFunnel) : null,
      wanQuality: intelligence.wanQuality ? stripSignal(intelligence.wanQuality) : null,
      serviceLogs: intelligence.serviceLogs ? stripSignal(intelligence.serviceLogs) : null,
      systemLogs: intelligence.systemLogs ? stripSignal(intelligence.systemLogs) : null,
      macUpdates: intelligence.macUpdates ? stripSignal(intelligence.macUpdates) : null
    }
  };
}

function extractAgentText(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const payloads = parsed && parsed.result && Array.isArray(parsed.result.payloads)
      ? parsed.result.payloads
      : [];
    const firstText = payloads.map(item => item && item.text).find(Boolean);
    if (firstText) return firstText;
    if (parsed.summary) return parsed.summary;
  } catch (_) {}
  return stdout.trim();
}

function askSessionId() {
  return `teddy-homebase-ask-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

async function askTeddy(ctx, body) {
  const prompt = String(body.prompt || '').trim().slice(0, TEDDY_ASK_MAX_PROMPT);
  const action = String(body.action || 'ask');
  const clicked = body.clicked && typeof body.clicked === 'object' ? body.clicked : null;
  const context = summarizeForTeddy(body.context);

  if (!prompt && action !== 'status') {
    return { status: 'error', message: 'Ask Teddy needs a question or status request.' };
  }

  const memoryLine = Array.isArray(context.memory) && context.memory.length > 0
    ? context.memory.map(item => `${item.title || item.id || 'Memory'}=${item.value || item.window || 'recorded'} (${item.source || 'source unknown'})`).join('; ')
    : 'none';
  const task = [
    'You are Teddy inside OpenClaw answering a Teddy Homebase action request.',
    'Do not change files, services, routes, Tailscale, Homebridge, AdGuard, or OpenClaw state.',
    'Use available OpenClaw MCP context if it helps, but keep this turn read-only.',
    'Treat the supplied Dashboard context as the source of truth.',
    'Stay inside Teddy Homebase: house status, services, logs, network, Mac mini, and the current dashboard.',
    'Never mention Axon, work pipeline, family, birthdays, email, calendar, or other personal context unless the user explicitly asks for that topic.',
    'If the Dashboard context has no review items and the house state is steady, say that clearly and do not invent commands, null fields, logs, or extra checks.',
    'Answer in 3-5 short bullets. If a fix would require action, say what you would check first and what approval would be needed.',
    action === 'prepare-fix'
      ? 'For prepare-fix, produce a dry-run plan only: likely cause, read-only checks, exact approval needed, and what must not be touched yet.'
      : 'For explain, diagnose the signal in plain language without proposing any write action as already approved.',
    '',
    `Action: ${action}`,
    `Prompt: ${prompt || 'Summarize current status and review items.'}`,
    clicked ? `Clicked signal: ${JSON.stringify(clicked)}` : 'Clicked signal: none',
    `Dashboard memory: ${memoryLine}`,
    `Dashboard context: ${JSON.stringify(context)}`
  ].join('\n');

  if (body.dryRun || process.env.TEDDY_HOMEBASE_ASK_DRY_RUN === '1') {
    return {
      status: 'complete',
      dryRun: true,
      answer: 'Dry run ready. Teddy would receive the current dashboard context and answer here.',
      promptPreview: task.slice(0, 1200),
      at: nowIso()
    };
  }

  if (process.env.TEDDY_HOMEBASE_ASK_LOCAL_ONLY === '1' || process.env.TEDDY_HOMEBASE_ASK_AGENT === '0') {
    return recordAsk(ctx, {
      action,
      prompt: prompt || 'Summarize current status and review items.',
      clicked,
      status: 'complete',
      source: 'local',
      answer: answerFromDashboardContext(action, prompt, clicked, context),
      run: null
    });
  }

  const result = await tryRunFull(
    process.env.TEDDY_HOMEBASE_OPENCLAW_BIN || 'openclaw',
    [
      'agent',
      '--agent',
      process.env.TEDDY_HOMEBASE_ASK_AGENT_ID || 'main',
      '--session-id',
      askSessionId(),
      '--json',
      '--timeout',
      String(Math.ceil(TEDDY_ASK_TIMEOUT_MS / 1000)),
      '--message',
      task
    ],
    TEDDY_ASK_TIMEOUT_MS
  );

  const agentAnswer = result.ok ? extractAgentText(result.stdout) : '';
  const fallbackAnswer = answerFromDashboardContext(action, prompt, clicked, context, result.stderr || 'Teddy did not answer before the local timeout.');
  const useAgentAnswer = result.ok && agentAnswer && !answerEscapesHomebase(agentAnswer, context);

  return recordAsk(ctx, {
    action,
    prompt: prompt || 'Summarize current status and review items.',
    clicked,
    status: 'complete',
    source: useAgentAnswer ? 'teddy' : 'local-fallback',
    answer: useAgentAnswer ? agentAnswer : fallbackAnswer,
    run: result.ok ? (() => {
      try {
        const parsed = JSON.parse(result.stdout);
        return parsed.runId || null;
      } catch (_) {
        return null;
      }
    })() : null
  });
}

function answerEscapesHomebase(answer, context) {
  const text = String(answer || '');
  const forbidden = /\b(Axon|pipeline|quota|booking|Maria|birthday|calendar|email|inbox)\b/i;
  if (forbidden.test(text)) return true;
  const houseState = context && context.houseState;
  const steady = houseState && houseState.tone === 'steady' && context.review === 'No review items supplied.';
  if (steady && /(^|\s)(run|bash|sudo|open)\s+[`~/$]/i.test(text)) return true;
  if (steady && /\bnull\b/i.test(text)) return true;
  return false;
}

function recordAsk(ctx, record) {
  const fullRecord = { at: nowIso(), ...record };
  const history = readDataSafe(ctx, 'ask-history.json', { entries: [] });
  const entries = Array.isArray(history.entries) ? history.entries : [];
  writeDataSafe(ctx, 'ask-history.json', { entries: [fullRecord, ...entries].slice(0, 40) });

  return fullRecord;
}

function answerFromDashboardContext(action, prompt, clicked, context, fallbackReason) {
  const review = context.review && context.review !== 'No review items supplied.'
    ? context.review
    : 'No review items are currently called out.';
  const score = context.score !== null && context.score !== undefined ? `${context.score}/100` : 'unknown';
  const firstAction = context.dailyDecision?.now?.text
    || context.houseState?.primaryAction
    || null;
  const external = context.signals && context.signals.externalAccess;
  const wan = context.signals && context.signals.wanQuality;
  const systemLogs = context.signals && context.signals.systemLogs;
  const memory = Array.isArray(context.memory) ? context.memory : [];
  const memoryLine = memory.length > 0
    ? `Memory: ${memory.slice(0, 3).map(item => `${item.title || item.id}: ${item.value || item.window || 'recorded'}`).join('; ')}.`
    : '';
  const lines = [];
  if (fallbackReason) lines.push('Teddy bridge did not answer cleanly, so I used the live dashboard context instead.');
  const hasReview = review !== 'No review items are currently called out.';
  if (external && external.metric && (external.state === 'warn' || external.state === 'bad')) {
    lines.push(`Only review item: external access on ${external.metric}. ${external.detail || 'Confirm those ports are expected.'}`);
  } else {
    lines.push(!hasReview
      ? `Readiness ${score}. No review item is currently called out.`
      : `Readiness ${score}. First action: ${firstAction || 'verify the first ranked warning'}. ${review}`);
  }
  if (clicked) lines.push(`You clicked: ${clicked.label || clicked.type || 'dashboard signal'}.`);
  if (action === 'prepare-fix') {
    lines.push('Dry-run fix plan only: confirm the source, inspect read-only evidence, then ask Dan before changing Homebridge, Tailscale, AdGuard, OpenClaw, macOS, or files.');
  }
  if (memoryLine && (hasReview || action === 'status' || /chang|history|memory|trend|recent/i.test(prompt || ''))) lines.push(memoryLine);
  if (wan && wan.state !== 'ok' && wan.detail) lines.push(`Internet: ${wan.detail}`);
  if (systemLogs && systemLogs.state !== 'ok' && systemLogs.detail) lines.push(`System logs: ${systemLogs.detail}`);
  lines.push(hasReview
    ? (action === 'status'
        ? `Next: ${firstAction || 'verify the first ranked warning'}, then leave the rest alone.`
        : action === 'prepare-fix'
          ? 'Next: prepare the read-only checks and required approval.'
          : 'Next: start with the first ranked warning.')
    : 'Next: nothing needs action right now.');
  return lines.slice(0, 4).map(line => `- ${line}`).join('\n');
}

function stripSignal(signal) {
  if (!signal || typeof signal !== 'object') return null;
  return {
    state: signal.state || 'info',
    metric: signal.metric ?? signal.value ?? signal.count ?? null,
    label: signal.label || signal.check || null,
    detail: signal.detail || null,
    confidence: signal.confidence || null,
    source: signal.source || null,
    hidden: signal.hidden === true
  };
}

function stripLogItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    name: item.name,
    state: item.state,
    issues: item.issues,
    source: item.source,
    detail: item.detail,
    ignored: item.ignored === true
  };
}

function buildHistoricalSummaries(vitalsData, timeline, intelligence) {
  const summaries = [];
  const vitalsHistory = vitalsData && vitalsData.vitalsHistory;
  if (vitalsHistory && Number(vitalsHistory.samples) > 0 && vitalsHistory.source) {
    const sampleCount = Number(vitalsHistory.samples);
    const checkedAt = vitalsHistory.lastSampleAt || null;
    summaries.push({
      id: 'cpu-peak-6h',
      title: 'CPU peak',
      window: vitalsHistory.window || '6h',
      value: `Peak ${vitalsHistory.cpuPeak}`,
      detail: vitalsHistory.scopedToBoot
        ? 'Scoped to the current Mac mini boot session.'
        : 'Based on retained local vitals samples.',
      sampleCount,
      bootedAt: vitalsHistory.bootedAt || null,
      checkedAt,
      freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
      source: vitalsHistory.source,
      confidence: 'persisted'
    });
  }

  const bootHistory = vitalsData && vitalsData.bootHistory;
  if (bootHistory && Number(bootHistory.sampleCount) > 0 && bootHistory.source) {
    const checkedAt = bootHistory.lastSeenAt || null;
    summaries.push({
      id: 'mac-boot-7d',
      title: 'Mac boot',
      window: bootHistory.window || '7d',
      value: bootHistory.restartCount7d > 0
        ? `${bootHistory.restartCount7d} restart${bootHistory.restartCount7d === 1 ? '' : 's'}`
        : 'Current boot stable',
      detail: bootHistory.currentBootedAt
        ? `Current boot started ${formatAgeFromDate(new Date(bootHistory.currentBootedAt))}.`
        : 'Current boot session is persisted.',
      sampleCount: bootHistory.sampleCount,
      restartCount7d: bootHistory.restartCount7d,
      checkedAt,
      freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
      source: bootHistory.source,
      confidence: 'persisted'
    });
  }

  const wanHistory = intelligence && intelligence.wanQuality && intelligence.wanQuality.wanHistory;
  if (wanHistory && Number(wanHistory.sampleCount) > 0 && wanHistory.source) {
    const worst = wanHistory.max24hMs === null ? 'unknown' : `${wanHistory.max24hMs} ms`;
    const checkedAt = wanHistory.lastSampleAt || null;
    summaries.push({
      id: 'wan-latency-24h',
      title: 'WAN latency',
      window: wanHistory.window || '24h',
      value: wanHistory.currentMs === null ? 'No live average' : `${wanHistory.currentMs} ms now`,
      detail: `Worst check ${worst} across ${wanHistory.sampleCount} persisted sample${wanHistory.sampleCount === 1 ? '' : 's'}.`,
      sampleCount: wanHistory.sampleCount,
      checkedAt,
      freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
      source: wanHistory.source,
      confidence: 'persisted'
    });
  }

  const publicAccessHistory = intelligence && intelligence.publicAccess && intelligence.publicAccess.publicAccessHistory;
  if (publicAccessHistory && Number(publicAccessHistory.sampleCount) > 0 && publicAccessHistory.source) {
    const checkedAt = publicAccessHistory.lastSeenAt || null;
    summaries.push({
      id: 'public-access-routes',
      title: 'Public access',
      window: 'current',
      value: publicAccessHistory.currentLabel || 'Unknown',
      detail: publicAccessHistory.lastChangedAt
        ? `Route set last changed ${formatAgeFromDate(new Date(publicAccessHistory.lastChangedAt))}.`
        : 'Current public route state is persisted.',
      sampleCount: publicAccessHistory.sampleCount,
      checkedAt,
      freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
      source: publicAccessHistory.source,
      confidence: 'persisted'
    });
  }

  const automationLogHistory = intelligence && intelligence.automationLogs && intelligence.automationLogs.automationLogHistory;
  if (automationLogHistory && Number(automationLogHistory.sampleCount) > 0 && automationLogHistory.source) {
    const checkedAt = automationLogHistory.lastSeenAt || null;
    summaries.push({
      id: 'automation-log-state',
      title: 'Automation logs',
      window: 'current',
      value: automationLogHistory.currentLabel || 'Quiet',
      detail: automationLogHistory.firstSeenAt && automationLogHistory.lastSeenAt
        ? `${automationLogHistory.currentLabel || 'Automation log state'} first seen ${formatAgeFromDate(new Date(automationLogHistory.firstSeenAt))}; last checked ${formatAgeFromDate(new Date(automationLogHistory.lastSeenAt))}.`
        : 'Current automation log state is persisted.',
      sampleCount: automationLogHistory.sampleCount,
      issueCount: automationLogHistory.issueCount,
      checkedAt,
      freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
      source: automationLogHistory.source,
      confidence: 'persisted'
    });
  }

  const events = Array.isArray(timeline) ? timeline : [];
  if (events.length > 0) {
    const cutoff = Date.now() - 24 * HOUR_MS;
    const recent = events.filter(event => {
      const at = new Date(event && event.at || 0).getTime();
      return Number.isFinite(at) && at >= cutoff;
    });
    const meaningful = recent.filter(event => {
      const title = String(event && event.title || '');
      const detail = String(event && event.detail || '');
      return title !== 'Status check' && !/no changes/i.test(detail);
    });
    if (recent.length > 0) {
      const checkedAt = recent[0] && recent[0].at || null;
      summaries.push({
        id: 'house-changes-24h',
        title: 'House changes',
        window: '24h',
        value: meaningful.length > 0 ? `${meaningful.length} meaningful` : 'Quiet',
        detail: meaningful.length > 0
          ? `${meaningful[0].title}: ${meaningful[0].detail}`
          : 'No meaningful persisted timeline events in the last 24 hours.',
        sampleCount: recent.length,
        meaningfulCount: meaningful.length,
        checkedAt,
        freshness: checkedAt ? formatAgeFromDate(new Date(checkedAt)) : 'persisted',
        source: 'data/teddy-house/timeline.json',
        confidence: 'persisted'
      });
    }
  }

  return summaries;
}

function buildVisualEvidence(services, insights, intelligence, vitalsData, timeline, score, houseState, dailyDecision, historicalSummaries) {
  const serviceStates = Object.fromEntries(
    Object.entries(services).map(([key, service]) => [key, {
      state: service.state,
      metric: service.metric,
      check: service.check
    }])
  );
  return {
    at: nowIso(),
    visuals: {
      readinessScore: {
        type: 'computed-ring',
        value: score,
        source: 'scoreServices(service states)',
        inputs: serviceStates
      },
      houseState: {
        type: 'zone-state',
        defaultKeys: DEFAULT_ZONE_KEYS,
        source: 'derived from existing probes and intelligence',
        inputs: houseState && Array.isArray(houseState.zones) ? houseState.zones : []
      },
      dailyDecision: {
        type: 'decision-strip',
        defaultKeys: ['now', 'watch', 'later'],
        source: 'derived from current review, house-state, signals, and maintenance evidence',
        inputs: dailyDecision && Array.isArray(dailyDecision.slots) ? dailyDecision.slots : []
      },
      serviceGrid: {
        type: 'probe-cards',
        count: DEFAULT_SERVICE_KEYS.length,
        defaultKeys: DEFAULT_SERVICE_KEYS,
        hiddenKeys: HIDDEN_BY_DEFAULT.services,
        source: 'live service checks',
        inputs: Object.fromEntries(DEFAULT_SERVICE_KEYS.map(key => [key, serviceStates[key]]))
      },
      insightGrid: {
        type: 'metric-cards',
        count: Array.isArray(insights.cards) ? insights.cards.length : 0,
        defaultVisible: false,
        source: 'live checks and local logs',
        inputs: (insights.cards || []).map(stripSignal)
      },
      signalGrid: {
        type: 'metric-cards',
        count: DEFAULT_SIGNAL_KEYS.length,
        defaultKeys: DEFAULT_SIGNAL_KEYS,
        hiddenKeys: HIDDEN_BY_DEFAULT.signals,
        source: 'AdGuard, Homebridge, Tailscale, WAN, npm, git, and drift checks',
        inputs: {
          adguardBlocks: stripSignal(intelligence.adguard),
          doorLocks: stripSignal(intelligence.homebridge.doorLocks),
          homebridgeAccessories: stripSignal(intelligence.homebridge.accessories),
          homebridgeLogs: stripSignal(intelligence.homebridge.logHealth),
          publicFunnel: stripSignal(intelligence.tailscaleFunnel),
          publicAccess: stripSignal(intelligence.publicAccess),
          wanQuality: stripSignal(intelligence.wanQuality),
          serviceLogs: stripSignal(intelligence.serviceLogs),
          softwareUpdates: stripSignal(intelligence.softwareUpdates),
          macUpdates: stripSignal(intelligence.macUpdates),
          systemLogs: stripSignal(intelligence.systemLogs),
          weirdThings: Array.isArray(intelligence.weirdThings)
            ? intelligence.weirdThings.filter(item => item.title !== 'No drift' && item.title !== 'No new weird thing').length
            : 0
        }
      },
      serviceLogSources: {
        type: 'log-summary',
        count: Array.isArray(intelligence.serviceLogs && intelligence.serviceLogs.items) ? intelligence.serviceLogs.items.length : 0,
        source: 'local log files and service status probes',
        inputs: Array.isArray(intelligence.serviceLogs && intelligence.serviceLogs.items)
          ? intelligence.serviceLogs.items.map(stripLogItem)
          : []
      },
      vitalsGrid: {
        type: 'host-metrics',
        source: 'os and df probes',
        inputs: vitalsData
      },
      dependencyMap: {
        type: 'static-topology',
        defaultVisible: false,
        source: 'declared Teddy Homebase architecture',
        inputs: ['Internet', 'Tailscale', 'Mac mini', 'AdGuard DNS', 'Homebridge', 'OpenClaw / Teddy']
      },
      timeline: {
        type: 'persistent-events',
        count: timeline.length,
        source: 'data/teddy-house/timeline.json',
        latest: timeline[0] || null
      },
      historicalSummaries: {
        type: 'persisted-summaries',
        count: Array.isArray(historicalSummaries) ? historicalSummaries.length : 0,
        source: 'persisted Homebase evidence files',
        inputs: Array.isArray(historicalSummaries) ? historicalSummaries : []
      }
    }
  };
}

function buildPresentationContract() {
  return {
    defaultServiceKeys: DEFAULT_SERVICE_KEYS,
    defaultZoneKeys: DEFAULT_ZONE_KEYS,
    defaultSignalKeys: DEFAULT_SIGNAL_KEYS,
    hiddenByDefault: HIDDEN_BY_DEFAULT
  };
}

function updateVisualEvidenceLog(ctx, evidence) {
  const existing = readDataSafe(ctx, 'visual-evidence.json', { entries: [] });
  const entries = Array.isArray(existing.entries) ? existing.entries : [];
  const next = [evidence, ...entries].slice(0, EVIDENCE_LIMIT);
  writeDataSafe(ctx, 'visual-evidence.json', { entries: next });
  return { latest: evidence, count: next.length };
}

async function checkAdGuard() {
  const started = Date.now();
  try {
    const resolver = new dns.Resolver();
    resolver.setServers(['127.0.0.1']);
    await withTimeout(resolver.resolve4('example.com'));
    const dnsMs = Date.now() - started;
    let admin = 'admin reachable';
    try {
      const res = await fetchCheck('http://127.0.0.1:3001/control/status');
      admin = res.status === 200 ? 'admin reachable' : 'admin locked';
    } catch (_) {
      admin = 'DNS works; admin UI not checked';
    }
    return ok(`Local DNS responded. ${admin === 'admin locked' ? 'AdGuard stats are locked.' : 'AdGuard is reachable.'}`, `${dnsMs} ms`, 'DNS');
  } catch (err) {
    return bad(`Local DNS did not respond: ${err.message}.`, 'failed', 'DNS');
  }
}

async function checkHomebridge() {
  try {
    await tcpCheck('127.0.0.1', 8581);
    return ok('Homebridge responded from the Mac mini.', '8581', 'Port');
  } catch (err) {
    return bad(`Homebridge did not respond: ${err.message}.`, 'offline', 'Port');
  }
}

async function checkTailscale() {
  try {
    const stdout = await run(TAILSCALE_BIN, ['status', '--json'], TAILSCALE_TIMEOUT_MS);
    const data = JSON.parse(stdout);
    const ip = (data.Self && data.Self.TailscaleIPs && data.Self.TailscaleIPs[0]) || 'connected';
    const online = data.Self && data.Self.Online !== false;
    if (!online) return warn('The Mac mini is not reporting online in Tailscale.', ip, 'Tailscale');
    return ok('The Mac mini is online in Tailscale.', ip, 'Tailscale');
  } catch (err) {
    return warn(`Tailscale status is unavailable: ${err.message}.`, 'unknown', 'Tailscale', 'degraded');
  }
}

async function checkTailscaleFunnel() {
  const status = await tryRun(TAILSCALE_BIN, ['funnel', 'status'], TAILSCALE_TIMEOUT_MS);
  if (!status.ok) {
    return info('External access status is unavailable.', 'unknown', 'External access', 'degraded');
  }

  const ports = [...status.stdout.matchAll(/https:\/\/[^\s:]+(?::(\d+))?\s+\(Funnel on\)/g)]
    .map(match => match[1] || '443');
  const uniquePorts = [...new Set(ports)].sort((a, b) => Number(a) - Number(b));
  if (uniquePorts.length === 0) {
    return ok('External access is off.', 'off', 'External access');
  }

  const hasHouse = uniquePorts.includes('10000');
  const extras = uniquePorts.filter(port => port !== '10000');
  if (hasHouse && extras.length === 0) {
    return ok('Only Teddy Homebase is externally available.', '10000', 'External access');
  }
  if (hasHouse && extras.length === 1 && extras[0] === '8443' && isBlueBubblesFunnel('8443', status.stdout)) {
    return info(
      'Known public routes: Teddy Homebase on 10000 and BlueBubbles on 8443.',
      uniquePorts.join(', '),
      'Accepted access'
    );
  }
  if (hasHouse) {
    const extraDetails = extras.map(port => describeFunnelPort(port, status.stdout)).join(' ');
    return warn(`Teddy Homebase is public on 10000. ${extraDetails}`, uniquePorts.join(', '), 'External access');
  }
  return warn(`External access is on outside the Homebase port: ${uniquePorts.join(', ')}.`, uniquePorts.join(', '), 'External access');
}

function funnelPortBlock(port, statusText) {
  const blockPattern = new RegExp(`https://[^\\s:]+:${port} \\(Funnel on\\)[\\s\\S]*?(?=\\n\\nhttps://|$)`);
  const block = statusText.match(blockPattern);
  return block ? block[0] : statusText;
}

function isBlueBubblesFunnel(port, statusText) {
  const text = funnelPortBlock(port, statusText);
  const target = text.match(/proxy\s+http:\/\/127\.0\.0\.1:(\d+)/);
  return port === '8443' && target && target[1] === '1234';
}

function describeFunnelPort(port, statusText) {
  const text = funnelPortBlock(port, statusText);
  const target = text.match(/proxy\s+http:\/\/127\.0\.0\.1:(\d+)/);
  if (isBlueBubblesFunnel(port, statusText)) {
    return '8443 is BlueBubbles exposed through Funnel; close it if messages do not need public web access.';
  }
  if (target) {
    return `${port} proxies to local ${target[1]}; confirm it should be public.`;
  }
  return `${port} is also public; confirm it should stay open.`;
}

function publicAccessRollup(funnelSignal) {
  const signal = funnelSignal || info('External access status is unavailable.', 'unknown', 'External access', 'degraded');
  const metric = String(signal.metric || signal.value || 'unknown');
  const semanticMetric = /^(accepted|known|off|unknown)$/i.test(metric);
  const ports = semanticMetric
    ? []
    : metric.split(',').map(port => port.trim()).filter(Boolean);
  const acceptedRoutes = [];
  const unexpectedRoutes = [];
  for (const port of ports) {
    if (port === '10000') acceptedRoutes.push({ port, name: 'Teddy Homebase' });
    else if (port === '8443' && /BlueBubbles/i.test(signal.detail || '')) acceptedRoutes.push({ port, name: 'BlueBubbles' });
    else unexpectedRoutes.push({ port, name: 'Unknown public route' });
  }
  const state = unexpectedRoutes.length > 0 || signal.state === 'warn' || signal.state === 'bad'
    ? signal.state === 'bad' ? 'bad' : 'warn'
    : signal.state === 'info'
      ? 'info'
      : 'ok';
  const value = /^off$/i.test(metric)
    ? 'Off'
    : state === 'warn' || state === 'bad'
      ? 'Needs review'
      : 'Known';
  const detail = unexpectedRoutes.length > 0
    ? `Unexpected public route${unexpectedRoutes.length === 1 ? '' : 's'}: ${unexpectedRoutes.map(route => route.port).join(', ')}.`
    : /^off$/i.test(metric)
      ? 'No public routes are currently exposed.'
      : /^unknown$/i.test(metric)
        ? signal.detail || 'Public access status is unavailable.'
        : 'Expected public routes are accounted for.';
  return {
    state,
    value,
    metric,
    check: 'Public access',
    label: state === 'warn' || state === 'bad' ? 'needs review' : /^off$/i.test(metric) ? 'off' : 'accepted',
    detail,
    confidence: signal.confidence || 'live',
    source: 'Tailscale Funnel',
    acceptedRoutes,
    unexpectedRoutes,
    rawSignal: stripSignal(signal)
  };
}

function publicAccessRouteKey(publicAccess) {
  const accepted = Array.isArray(publicAccess && publicAccess.acceptedRoutes)
    ? publicAccess.acceptedRoutes.map(route => `${route.port}:${route.name}`).sort()
    : [];
  const unexpected = Array.isArray(publicAccess && publicAccess.unexpectedRoutes)
    ? publicAccess.unexpectedRoutes.map(route => `${route.port}:${route.name}`).sort()
    : [];
  return JSON.stringify({
    state: publicAccess && publicAccess.state || 'info',
    metric: publicAccess && publicAccess.metric || 'unknown',
    accepted,
    unexpected
  });
}

function updatePublicAccessHistory(ctx, publicAccess) {
  if (!publicAccess || typeof publicAccess !== 'object') return null;
  const at = nowIso();
  const history = readDataSafe(ctx, 'public-access-history.json', { entries: [] });
  const existing = (Array.isArray(history.entries) ? history.entries : [])
    .filter(entry => entry && entry.routeKey && entry.changedAt)
    .slice(0, PUBLIC_ACCESS_HISTORY_LIMIT);
  const routeKey = publicAccessRouteKey(publicAccess);
  const routeNames = [
    ...(Array.isArray(publicAccess.acceptedRoutes) ? publicAccess.acceptedRoutes : []),
    ...(Array.isArray(publicAccess.unexpectedRoutes) ? publicAccess.unexpectedRoutes : [])
  ].map(route => `${route.name} ${route.port}`);
  const current = {
    routeKey,
    changedAt: at,
    lastSeenAt: at,
    state: publicAccess.state || 'info',
    metric: publicAccess.metric || 'unknown',
    value: publicAccess.value || 'Unknown',
    detail: publicAccess.detail || null,
    routeNames,
    observations: 1
  };
  const [latest, ...rest] = existing;
  const entries = latest && latest.routeKey === routeKey
    ? [{ ...latest, lastSeenAt: at, observations: Number(latest.observations || 1) + 1 }, ...rest]
    : [current, ...existing];
  const retained = entries.slice(0, PUBLIC_ACCESS_HISTORY_LIMIT);
  writeDataSafe(ctx, 'public-access-history.json', { entries: retained });
  const active = retained[0] || current;
  return {
    window: 'current',
    currentLabel: active.value || publicAccess.value || 'Unknown',
    currentMetric: active.metric || publicAccess.metric || 'unknown',
    lastChangedAt: active.changedAt || null,
    lastSeenAt: active.lastSeenAt || at,
    sampleCount: retained.length,
    routeNames: active.routeNames || [],
    source: 'data/teddy-house/public-access-history.json'
  };
}

async function checkInternet() {
  const started = Date.now();
  try {
    await withTimeout(dns.resolve4('apple.com'));
    const dnsMs = Date.now() - started;
    try {
      const res = await fetchCheck('https://www.gstatic.com/generate_204');
      return ok('WAN checks completed.', `${Math.max(dnsMs, res.ms)} ms`, 'WAN');
    } catch (_) {
      return warn('DNS responded, but the web check did not finish.', `${dnsMs} ms`, 'WAN');
    }
  } catch (err) {
    return bad(`WAN DNS failed: ${err.message}.`, 'failed', 'WAN');
  }
}

async function checkWanQuality() {
  const ping = await tryRun('ping', ['-c', '4', '-W', '1000', '1.1.1.1'], 5500);
  if (!ping.ok) {
    return info('Packet-loss check is unavailable.', 'unknown', 'WAN');
  }

  const lossMatch = ping.stdout.match(/([\d.]+)% packet loss/);
  const rttMatch = ping.stdout.match(/round-trip min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
  const loss = lossMatch ? Number(lossMatch[1]) : null;
  const avg = rttMatch ? Number(rttMatch[2]) : null;
  const max = rttMatch ? Number(rttMatch[3]) : null;
  const metric = loss === null ? 'unknown' : `${loss}% loss`;
  const detail = avg === null
    ? 'Ping finished, but latency was not readable.'
    : `Ping average ${avg.toFixed(1)} ms; max ${max.toFixed(1)} ms.`;

  const result = loss !== null && loss > 0
    ? warn(`${detail} Packet loss is above zero.`, metric, 'WAN')
    : avg !== null && avg > 80
      ? warn(`${detail} Latency is high.`, `${avg.toFixed(0)} ms`, 'WAN')
      : ok(detail, avg === null ? metric : `${avg.toFixed(0)} ms`, 'WAN');
  return {
    ...result,
    avgMs: Number.isFinite(avg) ? Number(avg.toFixed(1)) : null,
    maxMs: Number.isFinite(max) ? Number(max.toFixed(1)) : null,
    lossPct: Number.isFinite(loss) ? loss : null
  };
}

async function checkOpenClaw() {
  const gateway = await tryRun('launchctl', ['list', 'ai.openclaw.gateway']);
  const pidMatch = gateway.stdout.match(/"PID"\s*=\s*(\d+)/);
  const pid = pidMatch ? pidMatch[1] : null;

  async function tailnetIp() {
    const status = await tryRun(TAILSCALE_BIN, ['status', '--json'], TAILSCALE_TIMEOUT_MS);
    if (!status.ok) return null;
    try {
      const data = JSON.parse(status.stdout);
      return data.Self && data.Self.TailscaleIPs && data.Self.TailscaleIPs[0];
    } catch (_) {
      return null;
    }
  }

  const targets = ['127.0.0.1'];
  const tailIp = await tailnetIp();
  if (tailIp) targets.push(tailIp);

  for (const host of targets) {
    try {
      await tcpCheck(host, 18789);
      return ok(
        pid ? `OpenClaw gateway is running and reachable.` : `OpenClaw gateway is reachable.`,
        host,
        'Gateway'
      );
    } catch (_) {}
  }

  try {
    await tcpCheck('127.0.0.1', 18789);
    return ok(
      pid ? `OpenClaw gateway is running and reachable.` : 'OpenClaw gateway is reachable.',
      pid || '18789',
      'Gateway'
    );
  } catch (err) {
    if (pid) {
      return bad(
        `OpenClaw is running, but the gateway port is closed: ${err.message}.`,
        'closed',
        'Gateway'
      );
    }
    if (gateway.ok) {
      return bad('OpenClaw is loaded but not running.', 'not running', 'Gateway');
    }
    return warn('Could not read OpenClaw service status.', 'unknown', 'Gateway');
  }
}

async function checkBackups() {
  return info('Backups are parked for now.', 'paused', 'Dan setting');
}

async function npmLatestVersion(packageName) {
  const stdout = await run('npm', ['view', packageName, 'version', '--json'], 6500);
  try {
    return JSON.parse(stdout);
  } catch (_) {
    return stdout.trim().replace(/^"|"$/g, '');
  }
}

async function openClawVersion() {
  const result = await tryRun('openclaw', ['--version']);
  if (!result.ok) {
    return { name: 'OpenClaw', installed: 'unknown', latest: null, state: 'info', detail: 'OpenClaw version command was not readable.' };
  }
  const match = result.stdout.match(/OpenClaw\s+([^\s]+)/);
  return { name: 'OpenClaw', installed: match ? match[1] : result.stdout.trim(), latest: null };
}

async function lobsterBoardVersion() {
  try {
    const pkg = JSON.parse(await fs.readFile(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
    return { name: 'Teddy Homebase', installed: pkg.version || 'unknown', latest: null };
  } catch (_) {
    return { name: 'Teddy Homebase', installed: 'unknown', latest: null, state: 'info', detail: 'Teddy Homebase package version was not readable.' };
  }
}

async function homebridgeVersionStatus() {
  const [homebridgeResult, uiResult, homebridgeLatest, uiLatest] = await Promise.all([
    tryRun('homebridge', ['--version']),
    tryRun('hb-service', ['--version']),
    npmLatestVersion('homebridge').catch(() => null),
    npmLatestVersion('homebridge-config-ui-x').catch(() => null)
  ]);
  const homebridgeInstalled = homebridgeResult.ok ? homebridgeResult.stdout.trim().replace(/^v/, '') : 'unknown';
  const uiInstalled = uiResult.ok ? uiResult.stdout.trim().replace(/^v/, '') : 'unknown';
  const items = [
    {
      name: 'Homebridge',
      installed: homebridgeInstalled,
      latest: homebridgeLatest
    },
    {
      name: 'Homebridge UI',
      installed: uiInstalled,
      latest: uiLatest
    }
  ].map(item => {
    if (item.installed === 'unknown' || !item.latest) {
      return {
        ...item,
        state: 'info',
        detail: `${item.name} version check was incomplete.`
      };
    }
    const cmp = compareVersions(item.installed, item.latest);
    return {
      ...item,
      state: cmp < 0 ? 'warn' : 'ok',
      detail: cmp < 0
        ? `${item.name} can update from ${item.installed} to ${item.latest}.`
        : `${item.name} is current at ${item.installed}.`
    };
  });
  const updates = items.filter(item => item.state === 'warn');
  const unknown = items.some(item => item.state === 'info');
  const coreCurrent = items[0] && items[0].state === 'ok';
  const uiOnlyUpdate = updates.length === 1 && updates[0].name === 'Homebridge UI' && coreCurrent;
  return {
    state: uiOnlyUpdate ? 'info' : updates.length > 0 ? 'warn' : unknown ? 'info' : 'ok',
    value: updates.length > 0 ? `${updates.length}` : homebridgeInstalled,
    label: uiOnlyUpdate ? 'optional UI update' : updates.length > 0 ? 'update available' : 'version',
    items,
    detail: uiOnlyUpdate
      ? `${items[0].detail} Homebridge UI has a patch update available when convenient: ${updates[0].installed} to ${updates[0].latest}.`
      : updates.length > 0
      ? `${items[0].detail} ${updates.map(item => item.detail).join(' ')}`
      : items.map(item => item.detail).join(' ')
  };
}

async function gitFreshness(repoPath) {
  const status = await tryRun('git', ['-C', repoPath, 'status', '-sb']);
  if (!status.ok) return { state: 'info', detail: 'Could not read repo status.' };
  const first = status.stdout.split('\n')[0] || '';
  const ahead = first.match(/ahead\s+(\d+)/);
  const behind = first.match(/behind\s+(\d+)/);
  const dirty = status.stdout.split('\n').slice(1).filter(Boolean).length;
  if (behind) return { state: 'warn', detail: `Code is ${behind[1]} commit${behind[1] === '1' ? '' : 's'} behind origin.` };
  if (ahead) return { state: 'info', detail: `${ahead[1]} local commit${ahead[1] === '1' ? '' : 's'} not pushed.` };
  if (dirty) return { state: 'info', detail: `${dirty} local change${dirty === 1 ? '' : 's'}.` };
  return { state: 'ok', detail: 'Repo is clean.' };
}

function normalizeSoftwareUpdateCopy(result) {
  if (!result || typeof result !== 'object') return result;
  const next = { ...result, label: 'version check' };
  if (Array.isArray(next.items)) {
    next.items = next.items.map(item => {
      const itemCopy = { ...item };
      if (itemCopy.name === 'Teddy House') itemCopy.name = 'Teddy Homebase';
      if (typeof itemCopy.detail === 'string') {
        itemCopy.detail = itemCopy.detail
          .replace('Teddy House package version was not readable.', 'Teddy Homebase package version was not readable.')
          .replace('Teddy House is current', 'Teddy Homebase is current')
          .replace('Teddy House can update', 'Teddy Homebase can update');
      }
      return itemCopy;
    });
  }
  if (next.git && typeof next.git === 'object' && typeof next.git.detail === 'string') {
    next.git = {
      ...next.git,
      detail: normalizeGitCopy(next.git.detail)
    };
  }
  if (typeof next.detail === 'string') {
    next.detail = next.detail
      .replace('software update', 'update')
      .replace('software updates', 'updates')
      .replace('OpenClaw and Teddy House package checks are current.', 'OpenClaw and Teddy Homebase are current.')
      .replace('OpenClaw and Teddy House are current.', 'OpenClaw and Teddy Homebase are current.')
      .replace(/Git branch is behind origin by (\d+ commit[s]?)\./, 'Code is $1 behind origin.')
      .replace(/Git branch has (\d+ local commit[s]?) not pushed\./, '$1 not pushed.')
      .replace(/Git branch has (\d+ local change[s]?)\./, '$1.')
      .trim();
  }
  return next;
}

function normalizeGitCopy(detail) {
  return detail
    .replace(/Git branch is behind origin by (\d+ commit[s]?)\./, 'Code is $1 behind origin.')
    .replace(/Git branch has (\d+ local commit[s]?) not pushed\./, '$1 not pushed.')
    .replace(/Git branch has (\d+ local change[s]?)\./, '$1.')
    .replace('Git branch is clean locally.', 'Repo is clean.');
}

function updateItemFromInstalled(cachedItem, installedItem) {
  const item = {
    ...cachedItem,
    installed: installedItem && installedItem.installed && installedItem.installed !== 'unknown'
      ? installedItem.installed
      : cachedItem.installed
  };
  if (installedItem && installedItem.state === 'info') {
    return {
      ...item,
      state: 'info',
      detail: installedItem.detail
    };
  }
  if (!item.latest) {
    return {
      ...item,
      state: 'info',
      detail: `${item.name} is installed at ${item.installed}; latest version check was unavailable.`
    };
  }
  const cmp = compareVersions(item.installed, item.latest);
  return {
    ...item,
    state: cmp < 0 ? 'warn' : 'ok',
    detail: cmp < 0
      ? `${item.name} can update from ${item.installed} to ${item.latest}.`
      : `${item.name} is current at ${item.installed}.`
  };
}

async function reconcileCachedSoftwareItems(cached) {
  const items = Array.isArray(cached && cached.items) ? cached.items : [];
  if (!items.length) return items;
  const [openclaw, lobsterboard] = await Promise.all([
    openClawVersion(),
    lobsterBoardVersion()
  ]);
  const installedByName = new Map([
    [openclaw.name, openclaw],
    [lobsterboard.name, lobsterboard],
    ['Teddy House', lobsterboard]
  ]);
  return items.map(item => updateItemFromInstalled(item, installedByName.get(item.name)));
}

async function checkSoftwareUpdates(ctx) {
  const cached = readDataSafe(ctx, 'software-updates.json', null);
  if (cached && cached.checkedAt && Date.now() - new Date(cached.checkedAt).getTime() < UPDATE_CACHE_MS) {
    const [gitState, items] = await Promise.all([
      gitFreshness(path.resolve(__dirname, '..', '..')),
      reconcileCachedSoftwareItems(cached)
    ]);
    const cachedUpdates = items.length
      ? items.filter(item => item.state === 'warn').length
      : Number(cached.value || 0);
    const normalized = normalizeSoftwareUpdateCopy({
      ...cached,
      items,
      state: gitState.state === 'warn' ? 'warn' : cachedUpdates > 0 ? 'info' : 'ok',
      value: cachedUpdates > 0 ? `${cachedUpdates}` : 'current',
      confidence: 'cached',
      detail: cachedUpdates > 0
        ? `${cachedUpdates} update${cachedUpdates === 1 ? '' : 's'} available. ${gitState.detail}`
        : `OpenClaw and Teddy Homebase are current. ${gitState.detail}`,
      git: gitState
    });
    writeDataSafe(ctx, 'software-updates.json', normalized);
    return normalized;
  }

  const [openclaw, lobsterboard] = await Promise.all([
    openClawVersion(),
    lobsterBoardVersion()
  ]);

  const [openclawLatest, lobsterLatest, gitState] = await Promise.all([
    npmLatestVersion('openclaw').catch(() => null),
    npmLatestVersion('lobsterboard').catch(() => null),
    gitFreshness(path.resolve(__dirname, '..', '..'))
  ]);

  const items = [
    { ...openclaw, latest: openclawLatest },
    { ...lobsterboard, latest: lobsterLatest }
  ].map(item => {
    if (item.state) return item;
    if (!item.latest) {
      return {
        ...item,
        state: 'info',
        detail: `${item.name} is installed at ${item.installed}; latest version check was unavailable.`
      };
    }
    const cmp = compareVersions(item.installed, item.latest);
    return {
      ...item,
      state: cmp < 0 ? 'warn' : 'ok',
      detail: cmp < 0
        ? `${item.name} can update from ${item.installed} to ${item.latest}.`
        : `${item.name} is current at ${item.installed}.`
    };
  });

  const updatesAvailable = items.filter(item => item.state === 'warn').length;
  const result = {
    checkedAt: nowIso(),
    state: gitState.state === 'warn' ? 'warn' : updatesAvailable > 0 ? 'info' : 'ok',
    value: updatesAvailable > 0 ? `${updatesAvailable}` : 'current',
    label: 'version check',
    confidence: 'live',
    detail: updatesAvailable > 0
      ? `${updatesAvailable} update${updatesAvailable === 1 ? '' : 's'} available. ${gitState.detail}`
      : `OpenClaw and Teddy Homebase are current. ${gitState.detail}`,
    items,
    git: gitState
  };
  const normalized = normalizeSoftwareUpdateCopy(result);
  writeDataSafe(ctx, 'software-updates.json', normalized);
  return normalized;
}

function cachedFresh(record, ms) {
  if (!record || !record.checkedAt) return false;
  const checked = new Date(record.checkedAt).getTime();
  return Number.isFinite(checked) && Date.now() - checked < ms;
}

function cachedKnownFresh(record, ms, schema) {
  return cachedFresh(record, ms)
    && (!schema || record.schema === schema)
    && record.metric !== 'unknown'
    && record.value !== 'unknown';
}

function countMacUpdateItems(text) {
  const starCount = (text.match(/\n\s*\*/g) || []).length;
  const labelCount = (text.match(/\n\s*Label:/g) || []).length;
  return Math.max(starCount, labelCount);
}

async function checkMacUpdates(ctx) {
  const cached = readDataSafe(ctx, 'mac-updates.json', null);
  if (cachedKnownFresh(cached, MAC_UPDATE_CACHE_MS, MAC_UPDATE_CACHE_SCHEMA)) return { ...cached, confidence: 'cached' };

  const result = await tryRunFull('/usr/sbin/softwareupdate', ['-l'], 6500);
  let signal;
  if (!result.ok) {
    signal = info('Could not read macOS update status.', 'unknown', 'macOS');
  } else {
    const output = `${result.stdout}\n${result.stderr || ''}`;
    if (/No new software available/i.test(output)) {
      signal = ok('macOS reports no available updates.', 'current', 'macOS');
    } else {
      const count = countMacUpdateItems(output);
      if (count === 0) {
        signal = info('macOS update check finished without a readable update list.', 'unknown', 'macOS');
      } else {
        const needsAttention = /security|critical|urgent|restart|recommended/i.test(output);
        signal = (needsAttention ? warn : info)(
          `${count} macOS update${count === 1 ? '' : 's'} available. Review before installing.`,
          `${count}`,
          'macOS'
        );
      }
    }
  }

  const record = { checkedAt: nowIso(), schema: MAC_UPDATE_CACHE_SCHEMA, ...signal };
  writeDataSafe(ctx, 'mac-updates.json', record);
  return record;
}

function systemLogLines(text) {
  return String(text || '')
    .split('\n')
    .map(stripAnsi)
    .map(line => line.trim())
    .filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
}

function isCriticalDiagnosticReport(file) {
  const name = String(file || '').toLowerCase();
  if (!/\.(panic|ips|diag|crash)$/i.test(name)) return false;
  return /(panic|kernel|thermal|watchdog|shutdown|disk|i\/o|\bi[-_ ]?o\b|corrupt)/i.test(name);
}

function diagnosticReportKind(file) {
  const name = String(file || '').toLowerCase();
  if (/panic|watchdog|kernel/.test(name)) return 'WindowServer watchdog panic';
  if (/cpu_resource/.test(name)) return 'Codex CPU report';
  if (/disk|i\/o|\bi[-_ ]?o\b/.test(name)) return 'Disk or I/O diagnostic';
  if (/thermal/.test(name)) return 'Thermal diagnostic';
  if (/shutdown/.test(name)) return 'Shutdown diagnostic';
  return 'System diagnostic';
}

async function recentCriticalReports() {
  const dirs = [
    '/Library/Logs/DiagnosticReports',
    path.join(os.homedir(), 'Library/Logs/DiagnosticReports')
  ];
  const since = Date.now() - 24 * HOUR_MS;
  let checked = 0;
  const items = [];
  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir);
      checked += 1;
      for (const file of files) {
        if (!isCriticalDiagnosticReport(file)) continue;
        try {
          const stat = await fs.stat(path.join(dir, file));
          if (stat.mtimeMs >= since) {
            items.push({
              file,
              kind: diagnosticReportKind(file),
              at: stat.mtime.toISOString(),
              age: formatAgeFromDate(stat.mtime)
            });
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { checked, matches: items.length, items };
}

async function checkSystemLogs(ctx) {
  const cached = readDataSafe(ctx, 'system-logs.json', null);
  if (cachedKnownFresh(cached, SYSTEM_LOG_CACHE_MS, SYSTEM_LOG_CACHE_SCHEMA)) return { ...cached, confidence: 'cached' };

  const reports = await recentCriticalReports();
  if (reports.matches > 0) {
    const kinds = [...new Set(reports.items.map(item => item.kind))].slice(0, 2);
    const signal = warn(
      kinds.length > 0
        ? `${kinds.join(' and ')} in the last 24 hours.`
        : `${reports.matches} critical diagnostic report${reports.matches === 1 ? '' : 's'} in the last 24 hours.`,
      `${reports.matches}`,
      'System logs'
    );
    const record = { checkedAt: nowIso(), schema: SYSTEM_LOG_CACHE_SCHEMA, ...signal, incident: {
      title: kinds[0] || 'Mac restart incident',
      reports: reports.items.slice(0, 4),
      count: reports.matches
    } };
    writeDataSafe(ctx, 'system-logs.json', record);
    return record;
  }

  const predicate = 'eventMessage CONTAINS[c] "panic" OR eventMessage CONTAINS[c] "shutdown cause" OR eventMessage CONTAINS[c] "thermal pressure" OR eventMessage CONTAINS[c] "I/O error" OR eventMessage CONTAINS[c] "media error" OR eventMessage CONTAINS[c] "corrupt"';
  const result = await tryRun('/usr/bin/log', ['show', '--last', '1h', '--style', 'compact', '--predicate', predicate], 1800);
  let signal;
  if (!result.ok) {
    signal = ok(
      reports.checked > 0
        ? 'No recent panic, kernel, thermal, watchdog, disk, or corruption diagnostic reports. Unified log scan timed out.'
        : 'No critical diagnostic reports were readable. Unified log scan timed out.',
      '0',
      'System logs'
    );
  } else {
    const lines = systemLogLines(result.stdout);
    const critical = lines.filter(line => /panic|kernel panic|shutdown cause|thermal pressure|I\/O error|media error|corrupt/i.test(line)).length;
    if (critical > 0) {
      signal = warn(`${critical} critical system event${critical === 1 ? '' : 's'} in the last 24 hours.`, `${critical}`, 'System logs');
    } else {
      signal = ok('No recent panic, shutdown, thermal, I/O, media, or corruption events.', '0', 'System logs');
    }
  }

  const record = { checkedAt: nowIso(), schema: SYSTEM_LOG_CACHE_SCHEMA, ...signal };
  writeDataSafe(ctx, 'system-logs.json', record);
  return record;
}

async function adGuardStats() {
  try {
    const res = await fetchJson('http://127.0.0.1:3001/control/stats');
    if (res.status === 401 || res.status === 403) {
      return {
        state: 'info',
        value: 'locked',
        label: 'locked',
        detail: 'Blocked-query stats need the local AdGuard login.',
        confidence: 'degraded',
        topBlocked: []
      };
    }
    if (res.status !== 200 || !res.json) {
      return {
        state: 'warn',
        value: `HTTP ${res.status}`,
        label: 'stats',
        detail: 'AdGuard stats returned an unexpected response.',
        confidence: 'degraded',
        topBlocked: []
      };
    }

    const data = res.json;
    const queries = Number(data.num_dns_queries ?? data.dns_queries ?? 0);
    const blocked = Number(data.num_blocked_filtering ?? data.blocked_filtering ?? 0);
    const pct = queries > 0 ? Math.round((blocked / queries) * 100) : 0;
    const topBlocked = pickObjectEntries(data.top_blocked_domains || data.top_blocked || data.blocked_domains, 3);
    return {
      state: 'ok',
      value: `${blocked}`,
      label: 'blocked queries',
      detail: `${queries} queries; ${blocked} blocked (${pct}%).${topBlocked.length ? ` Top blocked: ${topBlocked.map(item => item.name).join(', ')}.` : ''}`,
      confidence: 'live',
      topBlocked
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'stats unavailable',
      detail: `Could not read AdGuard stats: ${err.message}.`,
      confidence: 'degraded',
      topBlocked: []
    };
  }
}

async function diskUsage() {
  try {
    const stdout = await run('df', ['-k', '/']);
    const lines = stdout.trim().split('\n');
    const parts = lines[1].trim().split(/\s+/);
    const used = Number(parts[2]);
    const available = Number(parts[3]);
    const pct = Math.round((used / (used + available)) * 100);
    return `${pct}%`;
  } catch (_) {
    return '--';
  }
}

async function memoryPressure(usedPct) {
  const pressure = await tryRun('memory_pressure', [], 1800);
  if (!pressure.ok) {
    return {
      state: 'ok',
      metric: `${usedPct}%`,
      displayMetric: '--',
      review: false,
      detail: 'macOS uses idle RAM for cache; no memory-pressure warning was readable.'
    };
  }

  const freeMatch = pressure.stdout.match(/System-wide memory free percentage:\s*(\d+)%/i);
  const freePct = freeMatch ? Number(freeMatch[1]) : null;
  if (freePct !== null && freePct < 5) {
    return {
      state: 'warn',
      metric: `${usedPct}%`,
      displayMetric: `${freePct}% free`,
      review: true,
      detail: `Memory pressure is worth watching: ${freePct}% free by macOS pressure check. ${usedPct}% used includes macOS cache.`
    };
  }
  return {
    state: 'ok',
    metric: `${usedPct}%`,
    displayMetric: freePct === null ? `${usedPct}% used` : `${freePct}% free`,
    review: false,
    detail: freePct === null
      ? 'Memory use is high, but macOS did not report a readable pressure warning.'
      : `Memory pressure looks normal: ${freePct}% free by macOS pressure check. ${usedPct}% used includes cache.`
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function formatAgeFromDate(date) {
  if (!date || Number.isNaN(date.getTime())) return 'unknown';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function logLineMessage(line) {
  const text = stripAnsi(line);
  if (!text.startsWith('{')) return text;
  try {
    const payload = JSON.parse(text);
    return payload.message || payload[1] || payload[0] || text;
  } catch (_) {
    return text;
  }
}

function redactLogLine(line) {
  return logLineMessage(line)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(password|token|access_token|refresh_token|id_token|cloud_token)([^A-Za-z0-9]+)[^,\s]+/gi, '$1$2[redacted]')
    .replace(/\b(setup code|passcode|manual pairing code)([^A-Za-z0-9]+)[0-9 -]{6,}/gi, '$1$2[redacted]')
    .replace(/\b(qrCode|qr code)([^A-Za-z0-9]+)['"]?[^,'"\s]+['"]?/gi, '$1$2[redacted]')
    .replace(/\b\d{3}-\d{2}-\d{3}\b/g, '[redacted-code]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function unifiedLoggingFramework() {
  return {
    checkedAt: nowIso(),
    title: 'Unified Homebase logging',
    codexTake: 'Normalize every source into one small contract: state, count, source, confidence, detail, and redacted examples. Keep the dashboard ranked; keep evidence one tap deeper.',
    teddyTake: 'Daily Homebase should feel calm. Logs are the basement light: easy to switch on when something is weird, invisible when the house is fine.',
    architecture: [
      {
        layer: 'Collect',
        detail: 'Read local service logs and status probes for Homebase, Homebridge, Eufy plugin, OpenClaw, AdGuard, and Tailscale.'
      },
      {
        layer: 'Redact',
        detail: 'Strip ANSI noise and hide emails, tokens, passwords, pairing codes, and QR payloads before anything reaches the browser.'
      },
      {
        layer: 'Classify',
        detail: 'Score each source as ok, info, warn, or bad using recent windows and service-specific thresholds.'
      },
      {
        layer: 'Store',
        detail: 'Persist the latest normalized snapshot in data/teddy-house/service-logs.json for repeatable debugging and future timeline work.'
      },
      {
        layer: 'Surface',
        detail: 'Show one calm Service logs signal on the main dashboard and keep grouped evidence in the hidden logs view.'
      },
      {
        layer: 'Escalate',
        detail: 'Only promote a log source into the Review lane when it is current, counted, and above its warn or bad threshold.'
      }
    ],
    next: [
      'Add persistent per-source log history so drift can be graphed without fake trend lines.',
      'Route repeated known-noisy devices into named suppression rules with expiration dates.',
      'Attach a one-click Ask Teddy action to each source once the local agent bridge is stable.'
    ]
  };
}

function logLineDate(line) {
  const text = stripAnsi(line);
  if (text.startsWith('{')) {
    try {
      const payload = JSON.parse(text);
      const stamp = payload && payload._meta && payload._meta.time ? payload._meta.time : payload.time;
      if (stamp) return new Date(stamp);
    } catch (_) {}
  }
  let match = text.match(/^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]/);
  if (match) {
    const [, month, day, year, hourRaw, minute, second, ampm] = match;
    let hour = Number(hourRaw);
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
  }
  match = text.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  match = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/);
  if (match) return new Date(match[1]);
  match = text.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (match) return new Date(match[1].replace(' ', 'T'));
  return null;
}

async function freshestFile(candidates) {
  const readable = [];
  for (const filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) readable.push({ filePath, stat });
    } catch (_) {}
  }
  readable.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return readable[0] || null;
}

function localDateStamp(offsetDays = 0) {
  const date = new Date(Date.now() - offsetDays * 24 * HOUR_MS);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function openClawLogCandidates() {
  return [
    `/tmp/openclaw/openclaw-${localDateStamp(0)}.log`,
    `/tmp/openclaw/openclaw-${localDateStamp(1)}.log`,
    '/Users/teddyclaw/.openclaw/logs/gateway.err.log',
    '/Users/teddyclaw/.openclaw/logs/gateway.log',
    '/Users/teddyclaw/.openclaw/logs/gateway-watchdog.err.log',
    '/Users/teddyclaw/.openclaw/logs/gateway-health.log'
  ];
}

async function logFileSummary(name, candidates, options = {}) {
  const latest = await freshestFile(candidates);
  if (!latest) {
    return {
      name,
      state: 'info',
      issues: null,
      source: candidates[0],
      detail: `${name} log was not found.`,
      examples: []
    };
  }

  const issuePattern = options.issuePattern || /\b(error|warn|warning|failed|failure|timeout|exception|not connected|could not|invalid|unavailable|closed: 1006)\b/i;
  const text = await fs.readFile(latest.filePath, 'utf8');
  const lines = text.split('\n').filter(Boolean).slice(-(options.window || 1200));
  const recentMs = options.recentMs || 6 * HOUR_MS;
  const ignorePattern = options.ignorePattern || null;
  const issueLines = lines
    .filter(line => {
      const date = logLineDate(line);
      if (options.requireDate && (!date || Number.isNaN(date.getTime()))) return false;
      return !date || Number.isNaN(date.getTime()) || Date.now() - date.getTime() <= recentMs;
    })
    .map(redactLogLine)
    .filter(line => issuePattern.test(line))
    .filter(line => !ignorePattern || !ignorePattern.test(line));
  const ageMs = Date.now() - latest.stat.mtimeMs;
  const stale = ageMs > (options.staleMs || 24 * HOUR_MS);
  const warnAt = options.warnAt ?? 20;
  const badAt = options.badAt ?? 80;
  const state = stale
    ? 'info'
    : issueLines.length >= badAt
      ? 'bad'
      : issueLines.length >= warnAt
        ? 'warn'
        : 'ok';
  const detail = stale
    ? `${name} log is stale; newest file update was ${formatAgeFromDate(latest.stat.mtime)}.`
    : issueLines.length > 0
      ? `${issueLines.length} notable line${issueLines.length === 1 ? '' : 's'} in the recent ${name} log window.`
      : `${name} log is quiet.`;
  return {
    name,
    state,
    issues: issueLines.length,
    issueLabel: options.issueLabel || null,
    source: latest.filePath,
    updatedAt: latest.stat.mtime.toISOString(),
    detail,
    examples: issueLines.slice(-3)
  };
}

function normalizeLogItem(item) {
  if (!item || item.name !== 'Homebridge') return item;
  const examples = Array.isArray(item.examples) ? item.examples : [];
  const combined = `${item.detail || ''} ${examples.join(' ')}`;
  if (/Govee|not using AWS connection|not connected to AWS|no connection method available/i.test(combined)) {
    return {
      ...item,
      issueLabel: 'Govee connection degraded',
      detail: 'Govee connection degraded in the recent Homebridge log window.'
    };
  }
  return item;
}

function serviceLogDomain(item) {
  const name = String(item && item.name || '');
  const issue = String(item && (item.issueLabel || item.detail || '') || '');
  const haystack = `${name} ${issue}`;
  if (/homebridge|govee|tp-link|tplink|eufy|accessor|plugin/i.test(haystack)) return 'automation';
  if (/tailscale|adguard|dns|wan|network/i.test(haystack)) return 'network';
  if (/homebase|openclaw|gateway|macos|launchagent|node|system/i.test(haystack)) return 'mac-mini';
  return 'mac-mini';
}

function serviceLogRollup(serviceLogs, domain, title, okDetail) {
  const sourceItems = Array.isArray(serviceLogs && serviceLogs.items) ? serviceLogs.items : [];
  const items = sourceItems.filter(item => serviceLogDomain(item) === domain);
  const countedItems = items.filter(item => item.ignored !== true);
  const noisy = countedItems.filter(item => signalBadOrWarn(item));
  const badCount = noisy.filter(item => item.state === 'bad').length;
  const warnCount = noisy.filter(item => item.state === 'warn').length;
  const state = badCount > 0 ? 'bad' : warnCount > 0 ? 'warn' : 'ok';
  const first = noisy[0] || null;
  const issues = countedItems.reduce((sum, item) => sum + (Number(item.issues) || 0), 0);
  return {
    checkedAt: serviceLogs && serviceLogs.checkedAt,
    state,
    value: first ? (first.issueLabel || first.name || title) : 'quiet',
    metric: first ? (first.issueLabel || first.name || title) : 'quiet',
    label: first ? 'needs review' : 'checked',
    detail: first
      ? `${first.issueLabel || first.name}: ${first.detail || 'Log issue needs review.'}`
      : okDetail,
    confidence: serviceLogs && serviceLogs.confidence ? serviceLogs.confidence : 'live',
    source: serviceLogs && serviceLogs.source ? serviceLogs.source : 'local service logs',
    issues,
    items
  };
}

function domainServiceLogs(serviceLogs) {
  return {
    automationLogs: serviceLogRollup(
      serviceLogs,
      'automation',
      'Automation logs',
      'Homebridge and accessory plugin logs are quiet.'
    ),
    macMiniLogs: serviceLogRollup(
      serviceLogs,
      'mac-mini',
      'Mac mini service logs',
      'Homebase and OpenClaw service logs are quiet.'
    ),
    networkLogs: serviceLogRollup(
      serviceLogs,
      'network',
      'Network service logs',
      'Tailscale, AdGuard, and network logs are quiet.'
    )
  };
}

function automationLogStateKey(automationLogs) {
  const state = automationLogs && automationLogs.state || 'info';
  const value = automationLogs && (automationLogs.value || automationLogs.metric || 'unknown');
  const issueLabels = Array.isArray(automationLogs && automationLogs.items)
    ? automationLogs.items
      .filter(item => item && item.ignored !== true)
      .map(item => item.issueLabel || item.name || item.detail)
      .filter(Boolean)
      .sort()
    : [];
  return JSON.stringify({ state, value, issueLabels });
}

function updateAutomationLogHistory(ctx, automationLogs) {
  if (!automationLogs || typeof automationLogs !== 'object') return null;
  const at = nowIso();
  const history = readDataSafe(ctx, 'automation-log-history.json', { entries: [] });
  const existing = (Array.isArray(history.entries) ? history.entries : [])
    .filter(entry => entry && entry.stateKey && entry.firstSeenAt)
    .slice(0, AUTOMATION_LOG_HISTORY_LIMIT);
  const stateKey = automationLogStateKey(automationLogs);
  const current = {
    stateKey,
    firstSeenAt: at,
    lastSeenAt: at,
    state: automationLogs.state || 'info',
    value: automationLogs.value || automationLogs.metric || 'unknown',
    detail: automationLogs.detail || null,
    issueCount: Number(automationLogs.issues || 0),
    source: automationLogs.source || 'local service logs',
    observations: 1
  };
  const [latest, ...rest] = existing;
  const entries = latest && latest.stateKey === stateKey
    ? [{
        ...latest,
        lastSeenAt: at,
        issueCount: Number(automationLogs.issues || latest.issueCount || 0),
        detail: automationLogs.detail || latest.detail || null,
        observations: Number(latest.observations || 1) + 1
      }, ...rest]
    : [current, ...existing];
  const retained = entries.slice(0, AUTOMATION_LOG_HISTORY_LIMIT);
  writeDataSafe(ctx, 'automation-log-history.json', { entries: retained });
  const active = retained[0] || current;
  return {
    window: 'current',
    currentLabel: active.value || 'unknown',
    state: active.state || 'info',
    firstSeenAt: active.firstSeenAt || null,
    lastSeenAt: active.lastSeenAt || at,
    issueCount: Number(active.issueCount || 0),
    observations: Number(active.observations || 1),
    sampleCount: retained.length,
    source: 'data/teddy-house/automation-log-history.json'
  };
}

async function tailscaleLogSummary() {
  const status = await tryRun(TAILSCALE_BIN, ['status', '--json'], TAILSCALE_TIMEOUT_MS);
  if (!status.ok) {
    return {
      name: 'Tailscale',
      state: 'warn',
      issues: 1,
      source: 'tailscale status --json',
      detail: `Tailscale status probe failed: ${status.stderr || 'unknown error'}.`,
      examples: []
    };
  }
  try {
    const data = JSON.parse(status.stdout);
    const health = Array.isArray(data.Health) ? data.Health : [];
    return {
      name: 'Tailscale',
      state: health.length > 0 ? 'warn' : 'ok',
      issues: health.length,
      source: 'tailscale status --json',
      detail: health.length > 0 ? `${health.length} Tailscale health warning${health.length === 1 ? '' : 's'}.` : 'Tailscale status has no health warnings.',
      examples: health.slice(0, 3).map(item => redactLogLine(typeof item === 'string' ? item : JSON.stringify(item)))
    };
  } catch (err) {
    return {
      name: 'Tailscale',
      state: 'info',
      issues: null,
      source: 'tailscale status --json',
      detail: `Tailscale status was not parseable: ${err.message}.`,
      examples: []
    };
  }
}

async function serviceLogOverview(ctx) {
  const items = await Promise.all([
    logFileSummary('Homebase', [
      '/Users/teddyclaw/Library/Logs/TeddyHouse/lobsterboard.err.log',
      '/Users/teddyclaw/Library/Logs/TeddyHouse/lobsterboard.out.log'
    ], { warnAt: 5, badAt: 20 }),
    logFileSummary('Homebridge', [
      '/Users/teddyclaw/.homebridge/homebridge.log',
      '/Users/teddyclaw/.homebridge/logs/homebridge.log'
    ], { warnAt: 60, badAt: 160, requireDate: true, ignorePattern: /\[EufySecurity\]/i }),
    logFileSummary('Eufy plugin', [
      '/Users/teddyclaw/.homebridge/eufysecurity/eufy-security.log'
    ], { warnAt: 3, badAt: 10 }),
    logFileSummary('OpenClaw', openClawLogCandidates(), { warnAt: 10, badAt: 40, issuePattern: /\b(ERROR|WARN|FATAL|uncaught|exception|EADDRINUSE|ETIMEDOUT|ECONNRESET|handshake timeout|invalid config)\b/ }),
    logFileSummary('AdGuard', [
      '/var/log/AdGuardHome.stderr.log',
      '/var/log/AdGuardHome.stdout.log'
    ], { warnAt: 5, badAt: 20, recentMs: 3 * HOUR_MS }),
    tailscaleLogSummary()
  ]);
  const normalizedItems = items.map(normalizeLogItem).map(item => {
    if (item.name !== 'Eufy plugin') return item;
    return {
      ...item,
      state: 'info',
      ignored: true,
      detail: `${item.detail} Eufy lock data is ignored on the daily dashboard because the plugin source is unreliable.`
    };
  });
  const countedItems = normalizedItems.filter(item => item.ignored !== true);
  const issueCount = countedItems.reduce((sum, item) => sum + (Number(item.issues) || 0), 0);
  const badCount = countedItems.filter(item => item.state === 'bad').length;
  const warnCount = countedItems.filter(item => item.state === 'warn').length;
  const noisy = countedItems.filter(item => item.state === 'bad' || item.state === 'warn');
  const state = badCount > 0 ? 'bad' : warnCount > 0 ? 'warn' : 'ok';
  const noisyLabels = noisy.map(item => item.issueLabel || item.name);
  const detail = noisy.length > 0
    ? noisy.map(item => `${item.issueLabel || item.name}: ${item.detail}`).join(' ')
    : `Logs checked for ${normalizedItems.map(item => item.name).join(', ')}. No noisy service logs need action.`;
  const result = {
    checkedAt: nowIso(),
    state,
    value: noisy.length > 0 ? noisyLabels[0] : 'quiet',
    metric: noisy.length > 0 ? noisyLabels[0] : 'quiet',
    label: noisy.length > 0 ? 'needs review' : 'checked',
    detail,
    confidence: 'live',
    source: 'local service logs',
    items: normalizedItems
  };
  Object.assign(result, domainServiceLogs(result));
  writeDataSafe(ctx, 'service-logs.json', result);
  return result;
}

function updateWanHistory(ctx, signal) {
  const avgMs = Number(signal && signal.avgMs);
  const maxMs = Number(signal && signal.maxMs);
  const lossPct = Number(signal && signal.lossPct);
  if (!Number.isFinite(avgMs) && !Number.isFinite(maxMs) && !Number.isFinite(lossPct)) return null;

  const at = nowIso();
  const history = readDataSafe(ctx, 'wan-history.json', { entries: [] });
  const cutoff = Date.now() - 48 * HOUR_MS;
  const sample = {
    at,
    avgMs: Number.isFinite(avgMs) ? avgMs : null,
    maxMs: Number.isFinite(maxMs) ? maxMs : null,
    lossPct: Number.isFinite(lossPct) ? lossPct : null,
    state: signal.state || 'info'
  };
  const entries = (Array.isArray(history.entries) ? history.entries : [])
    .filter(entry => {
      const time = new Date(entry.at).getTime();
      return Number.isFinite(time) && time >= cutoff;
    })
    .concat([sample])
    .slice(-WAN_HISTORY_LIMIT);
  writeDataSafe(ctx, 'wan-history.json', { entries });

  const windowCutoff = Date.now() - WAN_HISTORY_WINDOW_MS;
  const recent = entries.filter(entry => {
    const time = new Date(entry.at).getTime();
    return Number.isFinite(time) && time >= windowCutoff;
  });
  const latencyValues = recent
    .flatMap(entry => [Number(entry.avgMs), Number(entry.maxMs)])
    .filter(Number.isFinite);
  const lossValues = recent.map(entry => Number(entry.lossPct)).filter(Number.isFinite);
  const max24hMs = latencyValues.length > 0 ? Math.max(...latencyValues).toFixed(1) : null;
  const maxLossPct = lossValues.length > 0 ? Math.max(...lossValues) : null;
  return {
    window: '24h',
    currentMs: Number.isFinite(avgMs) ? Number(avgMs.toFixed(1)) : null,
    max24hMs,
    maxLossPct,
    sampleCount: recent.length,
    lastSampleAt: sample.at,
    source: 'data/teddy-house/wan-history.json'
  };
}

async function logDetailPayload(ctx) {
  const serviceLogs = await serviceLogOverview(ctx);
  return {
    checkedAt: nowIso(),
    serviceLogs,
    framework: unifiedLoggingFramework(),
    storage: {
      latestSnapshot: 'data/teddy-house/service-logs.json',
      visualEvidence: 'data/teddy-house/visual-evidence.json'
    }
  };
}

async function updateVitalsHistory(ctx, sample) {
  const at = nowIso();
  const cpu = Number.parseFloat(sample.cpu);
  const memoryUsedPct = Number.parseInt(sample.memory, 10);
  const diskUsedPct = Number.parseInt(sample.disk, 10);
  const uptimeSeconds = Number(sample.uptimeSeconds || 0);
  const bootedAt = uptimeSeconds > 0 ? new Date(Date.now() - uptimeSeconds * 1000).toISOString() : null;
  const bootWindowMs = 2 * 60 * 1000;
  const history = readDataSafe(ctx, 'vitals-history.json', { entries: [] });
  const cutoff = Date.now() - 48 * HOUR_MS;
  const entries = (Array.isArray(history.entries) ? history.entries : [])
    .filter(entry => {
      const time = new Date(entry.at).getTime();
      return Number.isFinite(time) && time >= cutoff && Number.isFinite(Number(entry.cpu));
    })
    .concat([{ at, cpu, memoryUsedPct, diskUsedPct, bootedAt, host: sample.host }])
    .slice(-VITALS_HISTORY_LIMIT);
  writeDataSafe(ctx, 'vitals-history.json', { entries });

  const peakCutoff = Date.now() - VITALS_PEAK_WINDOW_MS;
  const currentBoot = bootedAt ? new Date(bootedAt).getTime() : null;
  const recent = entries.filter(entry => {
    const sampleTime = new Date(entry.at).getTime();
    if (!Number.isFinite(sampleTime) || sampleTime < peakCutoff) return false;
    if (!currentBoot) return true;
    const entryBoot = new Date(entry.bootedAt || 0).getTime();
    return Number.isFinite(entryBoot) && Math.abs(entryBoot - currentBoot) <= bootWindowMs;
  });
  const cpuPeak = recent.reduce((max, entry) => Math.max(max, Number(entry.cpu) || 0), cpu);
  return {
    window: '6h',
    cpuPeak: cpuPeak.toFixed(2),
    samples: recent.length,
    bootedAt,
    scopedToBoot: Boolean(bootedAt),
    lastSampleAt: at,
    source: 'data/teddy-house/vitals-history.json'
  };
}

function updateBootHistory(ctx, sample, vitalsHistory) {
  const bootedAt = vitalsHistory && vitalsHistory.bootedAt;
  if (!bootedAt) return null;
  const bootTime = new Date(bootedAt).getTime();
  if (!Number.isFinite(bootTime)) return null;
  const at = nowIso();
  const history = readDataSafe(ctx, 'boot-history.json', { entries: [] });
  const cutoff = Date.now() - 30 * 24 * HOUR_MS;
  const bootWindowMs = 2 * 60 * 1000;
  const existing = (Array.isArray(history.entries) ? history.entries : [])
    .filter(entry => {
      const time = new Date(entry.bootedAt || 0).getTime();
      return Number.isFinite(time) && time >= cutoff;
    })
    .slice(0, BOOT_HISTORY_LIMIT);
  const [latest, ...rest] = existing;
  const latestBoot = new Date(latest && latest.bootedAt || 0).getTime();
  const sameBoot = Number.isFinite(latestBoot) && Math.abs(latestBoot - bootTime) <= bootWindowMs;
  const current = {
    bootedAt,
    firstSeenAt: at,
    lastSeenAt: at,
    uptimeSeconds: Number(sample && sample.uptimeSeconds || 0),
    host: sample && sample.host || os.hostname(),
    observations: 1
  };
  const entries = sameBoot
    ? [{
        ...latest,
        bootedAt: latest.bootedAt || bootedAt,
        lastSeenAt: at,
        uptimeSeconds: Number(sample && sample.uptimeSeconds || latest.uptimeSeconds || 0),
        observations: Number(latest.observations || 1) + 1
      }, ...rest]
    : [current, ...existing];
  const retained = entries.slice(0, BOOT_HISTORY_LIMIT);
  writeDataSafe(ctx, 'boot-history.json', { entries: retained });

  const windowCutoff = Date.now() - BOOT_HISTORY_WINDOW_MS;
  const recentBoots = retained.filter(entry => {
    const time = new Date(entry.bootedAt || 0).getTime();
    return Number.isFinite(time) && time >= windowCutoff;
  });
  const currentBootedAt = retained[0] && retained[0].bootedAt || bootedAt;
  const restartCount7d = Math.max(0, recentBoots.length - 1);
  return {
    window: '7d',
    currentBootedAt,
    restartCount7d,
    sampleCount: recentBoots.length,
    lastSeenAt: retained[0] && retained[0].lastSeenAt || at,
    source: 'data/teddy-house/boot-history.json'
  };
}

async function vitals(ctx) {
  const uptimeSeconds = os.uptime();
  const total = os.totalmem();
  const free = os.freemem();
  const usedPct = Math.round(((total - free) / total) * 100);
  const loadRaw = os.loadavg()[0];
  const load = loadRaw.toFixed(2);
  const [disk, memorySignal] = await Promise.all([
    diskUsage(),
    memoryPressure(usedPct)
  ]);
  const diskPct = Number.parseInt(disk, 10);
  const cpuCores = os.cpus().length || 1;
  const cpuState = loadRaw > cpuCores * 2 ? 'warn' : loadRaw > cpuCores ? 'info' : 'ok';
  const diskState = Number.isFinite(diskPct) && diskPct >= 90 ? 'warn' : 'ok';
  const result = {
    cpu: load,
    memory: `${usedPct}%`,
    memoryPressure: memorySignal.displayMetric || memorySignal.metric,
    disk,
    uptime: formatUptime(uptimeSeconds),
    uptimeSeconds,
    network: 'local',
    host: os.hostname(),
    health: {
      cpu: {
        state: cpuState,
        metric: load,
        review: false,
        detail: cpuState === 'warn'
          ? 'Load average is high, usually from recent work. Check active processes only if it persists.'
          : cpuState === 'info'
            ? 'CPU load is elevated, but not urgent unless it persists.'
            : 'Load is inside the normal range.'
      },
      memory: {
        state: memorySignal.state,
        metric: memorySignal.metric,
        displayMetric: memorySignal.displayMetric || memorySignal.metric,
        review: memorySignal.review === true,
        detail: memorySignal.detail
      },
      disk: {
        state: diskState,
        metric: disk,
        review: diskState === 'warn',
        detail: diskState === 'warn' ? 'Root disk is above the watch threshold.' : 'Root disk has room.'
      }
    }
  };
  const history = await updateVitalsHistory(ctx, result);
  result.health.cpu.peak6h = history.cpuPeak;
  result.health.cpu.secondary = `Peak ${history.cpuPeak} / 6h`;
  result.health.cpu.detail = `${result.health.cpu.detail} Recent 6h peak: ${history.cpuPeak}.`;
  result.vitalsHistory = history;
  const bootHistory = updateBootHistory(ctx, result, history);
  if (bootHistory) result.bootHistory = bootHistory;
  return result;
}

async function homebridgePlugins() {
  const ps = await tryRun('ps', ['ax', '-o', 'pid,ppid,command']);
  if (!ps.ok) {
    return { count: null, names: [], detail: 'Plugin process list unavailable.' };
  }

  const names = ps.stdout
    .split('\n')
    .map(line => line.match(/homebridge:\s+(.+)$/))
    .filter(Boolean)
    .map(match => match[1].trim())
    .filter(Boolean);

  return {
    count: names.length,
    names: names.slice(0, 3),
    detail: names.length > 0 ? `${names.length} Homebridge helper${names.length === 1 ? '' : 's'} running.` : 'Homebridge is up.'
  };
}

async function homebridgeAccessorySummary() {
  const dir = '/Users/teddyclaw/.homebridge/accessories';
  try {
    const files = await fs.readdir(dir);
    const cacheFiles = files
      .filter(file => file.startsWith('cachedAccessories'))
      .filter(file => !file.includes('.bak') && !file.includes('pre-') && !file.startsWith('.'));

    const seen = new Set();
    for (const file of cacheFiles) {
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const item of parsed) {
          const id = item.UUID || `${item.plugin || 'unknown'}:${item.displayName || item.context?.device?.displayName || ''}`;
          if (id) seen.add(id);
        }
      } catch (_) {}
    }

    return {
      state: 'ok',
      count: seen.size,
      detail: `${seen.size} Homebridge accessor${seen.size === 1 ? 'y' : 'ies'} loaded.`
    };
  } catch (err) {
    return { state: 'info', count: null, detail: `Could not read Homebridge accessories: ${err.message}.` };
  }
}

async function homebridgeCacheFiles() {
  const dir = '/Users/teddyclaw/.homebridge/accessories';
  const files = await fs.readdir(dir);
  return files
    .filter(file => file.startsWith('cachedAccessories'))
    .filter(file => !file.includes('.bak') && !file.includes('pre-') && !file.startsWith('.'))
    .map(file => path.join(dir, file));
}

function verificationKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function manualVerificationFor(ctx, name) {
  const data = readDataSafe(ctx, 'manual-verifications.json', { locks: {} });
  const locks = data && typeof data === 'object' && data.locks && typeof data.locks === 'object'
    ? data.locks
    : {};
  const entry = locks[verificationKey(name)];
  if (!entry || !entry.verifiedAt) return null;
  const verifiedAt = new Date(entry.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) return null;
  if (Date.now() - verifiedAt.getTime() > MANUAL_VERIFICATION_TTL_MS) return null;
  return { ...entry, verifiedAt: verifiedAt.toISOString(), age: formatAgeFromDate(verifiedAt) };
}

function hasDoorLockName(...values) {
  const text = values.filter(Boolean).join(' ');
  if (/\b(washer|dryer|wash tower|washtower|dishwasher|oven|appliance)\b/i.test(text)) return false;
  return /\b(lock|deadbolt|front door|side door|back door|garage entry|eufy|schlage|august|yale|level|kwikset)\b/i.test(text);
}

function charByUuidOrName(characteristics, uuid, namePattern) {
  return characteristics.find(char => char.UUID === uuid || namePattern.test(`${char.displayName || ''} ${char.constructorName || ''}`));
}

function lockCurrentLabel(value) {
  if (value === 0) return 'locked';
  if (value === 1) return 'unlocked';
  if (value === 2) return 'jammed';
  if (value === 3) return 'unknown';
  return 'unknown';
}

function lockStateRank(state) {
  if (state === 'jammed') return 0;
  if (state === 'unlocked') return 1;
  if (state === 'unknown') return 2;
  return 3;
}

async function eufyBridgeStatus() {
  const pluginPath = '/opt/homebrew/lib/node_modules/@homebridge-plugins/homebridge-eufy-security/package.json';
  let installed = false;
  let version = null;
  try {
    const pkg = JSON.parse(await fs.readFile(pluginPath, 'utf8'));
    installed = true;
    version = pkg.version || null;
  } catch (_) {}

  let platformPresent = false;
  let hasCredentials = false;
  try {
    const config = JSON.parse(await fs.readFile('/Users/teddyclaw/.homebridge/config.json', 'utf8'));
    const platform = (config.platforms || []).find(item => /EufySecurity/i.test(item.platform || ''));
    platformPresent = Boolean(platform);
    hasCredentials = Boolean(platform && platform.username && platform.password);
  } catch (_) {}

  let guestAdminWarning = false;
  let discovery = null;
  try {
    const log = await fs.readFile('/Users/teddyclaw/.homebridge/eufysecurity/eufy-security.log', 'utf8');
    guestAdminWarning = /not using a guest admin account/i.test(log);
    const matches = [...log.matchAll(/Discovery finished with (\d+) station\(s\) and (\d+) devices\(s\)/gi)];
    const latest = matches[matches.length - 1];
    if (latest) {
      discovery = {
        stations: Number(latest[1]),
        devices: Number(latest[2])
      };
    }
  } catch (_) {}

  return { installed, configured: platformPresent && hasCredentials, platformPresent, hasCredentials, version, guestAdminWarning, discovery };
}

async function homebridgeDoorLockStatus(ctx) {
  try {
    const [cacheFiles, eufy] = await Promise.all([
      homebridgeCacheFiles(),
      eufyBridgeStatus()
    ]);
    const lockServiceUuid = '00000045-0000-1000-8000-0026BB765291';
    const currentUuid = '0000001D-0000-1000-8000-0026BB765291';
    const targetUuid = '0000001E-0000-1000-8000-0026BB765291';
    const batteryUuid = '00000068-0000-1000-8000-0026BB765291';
    const seen = new Map();

    for (const filePath of cacheFiles) {
      try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (!Array.isArray(parsed)) continue;
        for (const accessory of parsed) {
          const services = accessory.services || [];
          const infoText = [
            accessory.displayName,
            accessory.pluginAlias,
            accessory.plugin,
            accessory.context && accessory.context.name,
            accessory.context && accessory.context.displayName
          ];
          for (const service of services) {
            if (service.UUID !== lockServiceUuid) continue;
            if (!hasDoorLockName(...infoText, service.displayName)) continue;
            const characteristics = service.characteristics || [];
            const current = charByUuidOrName(characteristics, currentUuid, /Lock Current State/i);
            const target = charByUuidOrName(characteristics, targetUuid, /Lock Target State/i);
            const battery = services
              .flatMap(item => item.characteristics || [])
              .find(char => char.UUID === batteryUuid || /Battery Level/i.test(`${char.displayName || ''} ${char.constructorName || ''}`));
            const name = service.displayName || accessory.displayName || 'Door lock';
            const state = lockCurrentLabel(current && current.value);
            const id = accessory.UUID || `${accessory.plugin || 'homebridge'}:${name}`;
            const plugin = accessory.pluginAlias || accessory.plugin || 'homebridge';
            seen.set(id, {
              name,
              state,
              plugin,
              target: target && target.value === 0 ? 'lock' : target && target.value === 1 ? 'unlock' : 'unknown',
              battery: typeof (battery && battery.value) === 'number' ? battery.value : null
            });
          }
        }
      } catch (_) {}
    }

    const items = Array.from(seen.values()).sort((a, b) => {
      const byState = lockStateRank(a.state) - lockStateRank(b.state);
      return byState || a.name.localeCompare(b.name);
    });

    if (items.length === 0) {
      const detail = eufy.installed
        ? eufy.hasCredentials
          ? 'Eufy is configured, but Homebridge has not exposed a door lock yet.'
          : 'No live door lock source yet. Eufy needs a dedicated guest admin account in Homebridge.'
        : 'No door locks are exposed by Homebridge yet. Eufy plugin is not installed.';
      return {
        state: 'info',
        value: eufy.installed ? 'not linked' : 'none',
        label: eufy.installed ? 'Eufy auth' : 'Homebridge',
        detail,
        source: 'Homebridge cachedAccessories',
        confidence: eufy.installed ? 'degraded' : 'live',
        eufy,
        items: []
      };
    }

    const unlocked = items.filter(item => item.state === 'unlocked').length;
    const jammed = items.filter(item => item.state === 'jammed').length;
    const unknown = items.filter(item => item.state === 'unknown').length;
    const allEufy = items.every(item => /eufy/i.test(item.plugin || ''));
    const manualLocks = items
      .map(item => ({ item, verification: manualVerificationFor(ctx, item.name) }))
      .filter(entry => entry.verification && entry.verification.state === 'locked');
    if (allEufy) {
      const manual = manualLocks[0] && manualLocks[0].verification;
      const manualDetail = manual
        ? ` Dan manually verified locked ${manual.age}; this expires after 4 hours.`
        : '';
      return {
        state: 'info',
        value: 'ignored',
        label: 'ignored',
        detail: `Eufy lock state is ignored on the daily dashboard because the Homebridge plugin source is not trusted for lock truth.${manualDetail}`,
        source: 'Homebridge cachedAccessories',
        confidence: 'degraded',
        confidenceDetail: manual
          ? `Manual check from ${manual.verifiedBy || 'Dan'} noted; plugin source is degraded and ignored.`
          : 'Eufy plugin source is degraded and ignored.',
        hidden: true,
        eufy,
        items: items.map(item => {
          const verification = manualVerificationFor(ctx, item.name);
          return {
            ...item,
            unverified: true,
            manualVerified: verification && verification.state === 'locked'
              ? { state: verification.state, verifiedAt: verification.verifiedAt, age: verification.age }
              : null
          };
        })
      };
    }
    const state = jammed > 0 ? 'bad' : unlocked > 0 || unknown > 0 ? 'warn' : 'ok';
    const value = jammed > 0
      ? `${jammed} jammed`
      : unlocked > 0
        ? `${unlocked} unlocked`
        : unknown > 0
          ? `${unknown} unknown`
          : 'locked';
    const detail = items
      .map(item => `${item.name}: ${item.state}${item.battery === null ? '' : `, ${item.battery}% battery`}`)
      .join('. ');

    return {
      state,
      value,
      label: `${items.length} lock${items.length === 1 ? '' : 's'}`,
      detail,
      source: 'Homebridge cachedAccessories',
      confidence: 'cached',
      eufy,
      items
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'unavailable',
      detail: `Could not read Homebridge lock state: ${err.message}.`,
      confidence: 'degraded',
      items: []
    };
  }
}

function newestLogTimestamp(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const cleanLine = stripAnsi(lines[i]);
    const match = cleanLine.match(/^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]/);
    if (!match) continue;
    const [, month, day, year, hourRaw, minute, second, ampm] = match;
    let hour = Number(hourRaw);
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
  }
  return null;
}

async function freshestHomebridgeLog() {
  const candidates = [
    '/Users/teddyclaw/.homebridge/homebridge.log',
    '/Users/teddyclaw/.homebridge/logs/homebridge.log'
  ];
  const readable = [];
  for (const filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) readable.push({ filePath, mtimeMs: stat.mtimeMs });
    } catch (_) {}
  }
  readable.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return readable[0] ? readable[0].filePath : candidates[0];
}

function homebridgeTplinkUnreachable(cleanLines) {
  const devices = new Set();
  const ips = new Set();
  for (const line of cleanLines) {
    if (!/TplinkSmarthome/i.test(line) || !/\b(EHOSTUNREACH|ETIMEDOUT|timeout)\b/i.test(line)) continue;
    const deviceMatch = line.match(/\[TplinkSmarthome(?:\.API)?\]\s+\[([^\]]+)\]/i);
    if (deviceMatch && deviceMatch[1]) devices.add(deviceMatch[1].trim());
    const ipMatch = line.match(/\b(192\.168\.\d+\.\d+):9999\b/);
    if (ipMatch && ipMatch[1]) ips.add(ipMatch[1]);
  }
  const names = [...devices];
  const count = names.length || ips.size;
  if (count === 0) return null;
  const shown = names.slice(0, 4);
  const overflow = count > shown.length ? ` and ${count - shown.length} more` : '';
  return {
    count,
    names,
    detail: shown.length > 0
      ? `TP-Link devices unreachable: ${shown.join(', ')}${overflow}.`
      : `${count} TP-Link device${count === 1 ? '' : 's'} unreachable.`
  };
}

async function homebridgeLogHealth() {
  try {
    const logPath = await freshestHomebridgeLog();
    const log = await fs.readFile(logPath, 'utf8');
    const lines = log.split('\n').slice(-500);
    const cleanLines = lines.map(stripAnsi);
    const issueLines = cleanLines.filter(line => /\b(error|warn|warning|failed|uncaught|exception)\b/i.test(line));
    const tplinkOffline = homebridgeTplinkUnreachable(cleanLines);
    const credenzaTimeouts = cleanLines.filter(line => /Family Room Credenza|192\.168\.7\.242/i.test(line) && /timeout|error|failed/i.test(line));
    const newest = newestLogTimestamp(lines);
    const stale = newest ? Date.now() - newest.getTime() > 24 * HOUR_MS : true;
    if (stale) {
      return {
        state: 'info',
        value: 'stale',
        label: 'last log',
        detail: newest ? `Newest visible entry is ${formatAgeFromDate(newest)}.` : 'No readable Homebridge log time.'
      };
    }
    if (tplinkOffline && tplinkOffline.count >= 1) {
      return {
        state: 'warn',
        value: 'TP-Link offline',
        label: `${tplinkOffline.count} device${tplinkOffline.count === 1 ? '' : 's'}`,
        detail: tplinkOffline.detail,
        items: tplinkOffline.names.map(name => ({ name, state: 'warn' }))
      };
    }
    if (credenzaTimeouts.length >= 3) {
      return {
        state: 'warn',
        value: `${credenzaTimeouts.length}`,
        label: 'TP-Link loop',
        detail: 'Family Room Credenza is timing out again; keep it excluded or fix the device network.'
      };
    }
    if (issueLines.length > 20) {
      return {
        state: 'warn',
        value: 'needs review',
        label: 'repeated warnings',
        detail: 'Homebridge log has repeated warnings; open Logs for examples.'
      };
    }
    return {
      state: 'ok',
      value: `${issueLines.length}`,
      label: 'recent issues',
      detail: `Recent log is quiet: ${issueLines.length} warnings or errors.`
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'log unavailable',
      detail: `Could not read Homebridge log: ${err.message}.`
    };
  }
}

async function openClawReadyAge() {
  try {
    const latest = await freshestFile(openClawLogCandidates());
    if (!latest) return { age: 'unknown', detail: 'Could not read OpenClaw log.' };
    const log = await fs.readFile(latest.filePath, 'utf8');
    const ready = log
      .split('\n')
      .filter(line => line.includes('[gateway] ready') || line.includes('Gateway Health') || line.includes('CODEx_BOOT_OK'))
      .pop();
    if (!ready) return { age: 'unknown', detail: 'No recent ready signal found.' };
    const stamp = logLineDate(ready);
    return { age: formatAgeFromDate(stamp), detail: `Last ready signal was ${formatAgeFromDate(stamp)}.` };
  } catch (_) {
    return { age: 'unknown', detail: 'Could not read OpenClaw log.' };
  }
}

async function buildInsights(services, systemVitals, intelligence) {
  const [plugins, openclawReady] = await Promise.all([
    homebridgePlugins(),
    openClawReadyAge()
  ]);

  const blockers = Object.values(services).filter(service => service.state === 'bad').length;
  const watches = Object.values(services).filter(service => service.state === 'warn').length;
  const vitalWatches = Object.values(systemVitals.health || {}).filter(vital => vital.state === 'warn').length;
  const signalWatches = usefulSignals(intelligence).filter(item => item.state === 'warn' || item.state === 'bad').length;
  const parked = Object.values(services).filter(service => service.state === 'info').length;
  const teddySays = blockers > 0
    ? `${blockers} failed check${blockers === 1 ? '' : 's'}.`
    : watches + vitalWatches + signalWatches > 0
      ? `${watches + vitalWatches + signalWatches} watch item${watches + vitalWatches + signalWatches === 1 ? '' : 's'}.`
      : parked > 0
        ? 'Active systems clear.'
        : 'All clear.';

  return {
    teddySays,
    cards: [
      {
        title: 'AdGuard',
        value: services.adguard.metric || '--',
        label: 'DNS',
        state: services.adguard.state,
        detail: services.adguard.detail
      },
      {
        title: 'Homebridge',
        value: intelligence.homebridge.accessories.count === null ? '--' : `${intelligence.homebridge.accessories.count}`,
        label: 'devices',
        state: services.homebridge.state,
        detail: `${intelligence.homebridge.accessories.detail} ${plugins.detail}`
      },
      {
        title: 'OpenClaw',
        value: openclawReady.age,
        label: 'ready',
        state: services.openclaw.state,
        detail: openclawReady.detail
      },
      {
        title: 'WAN',
        value: intelligence.wanQuality.metric || '--',
        label: intelligence.wanQuality.check || 'WAN',
        state: intelligence.wanQuality.state,
        detail: intelligence.wanQuality.detail
      }
    ]
  };
}

async function buildIntelligence(ctx) {
  const [adguard, accessories, doorLocks, logHealth, homebridgeVersion, funnel, rawWanQuality, serviceLogs, softwareUpdates, macUpdates, systemLogs] = await Promise.all([
    adGuardStats(),
    homebridgeAccessorySummary(),
    homebridgeDoorLockStatus(ctx),
    homebridgeLogHealth(),
    homebridgeVersionStatus(),
    checkTailscaleFunnel(),
    checkWanQuality(),
    serviceLogOverview(ctx),
    checkSoftwareUpdates(ctx),
    checkMacUpdates(ctx),
    checkSystemLogs(ctx)
  ]);
  const wanHistory = updateWanHistory(ctx, rawWanQuality);
  const wanQuality = wanHistory ? { ...rawWanQuality, wanHistory } : rawWanQuality;
  const publicAccessRaw = publicAccessRollup(funnel);
  const publicAccessHistory = updatePublicAccessHistory(ctx, publicAccessRaw);
  const publicAccess = publicAccessHistory ? { ...publicAccessRaw, publicAccessHistory } : publicAccessRaw;
  const automationLogHistory = updateAutomationLogHistory(ctx, serviceLogs.automationLogs);
  const automationLogs = automationLogHistory ? { ...serviceLogs.automationLogs, automationLogHistory } : serviceLogs.automationLogs;

  return {
    adguard,
    homebridge: { accessories, doorLocks, logHealth, version: homebridgeVersion },
    tailscaleFunnel: funnel,
    publicAccess,
    wanQuality,
    serviceLogs,
    automationLogs,
    macMiniLogs: serviceLogs.macMiniLogs,
    networkLogs: serviceLogs.networkLogs,
    softwareUpdates,
    macUpdates,
    systemLogs,
    weirdThings: []
  };
}

function snapshotFor(services, intelligence, score) {
  return {
    score,
    services: Object.fromEntries(Object.entries(services).map(([key, service]) => [key, service.state])),
    funnelMetric: intelligence.tailscaleFunnel.metric,
    accessoryCount: intelligence.homebridge.accessories.count,
    doorLockValue: intelligence.homebridge.doorLocks.value,
    doorLockState: intelligence.homebridge.doorLocks.state,
    homebridgeLogState: intelligence.homebridge.logHealth.state,
    wanState: intelligence.wanQuality.state,
    adguardStatsState: intelligence.adguard.state,
    softwareUpdateState: intelligence.softwareUpdates.state,
    softwareUpdateValue: intelligence.softwareUpdates.value,
    macUpdateState: intelligence.macUpdates.state,
    macUpdateMetric: intelligence.macUpdates.metric,
    systemLogState: intelligence.systemLogs.state,
    systemLogMetric: intelligence.systemLogs.metric,
    serviceLogState: intelligence.serviceLogs.state,
    serviceLogValue: intelligence.serviceLogs.value
  };
}

function buildWeirdThings(previous, current) {
  if (!previous) {
    return [{ state: 'info', title: 'Baseline saved', detail: 'Homebase has a starting point for drift checks.' }];
  }

  const items = [];
  for (const [key, state] of Object.entries(current.services)) {
    if (previous.services && previous.services[key] && previous.services[key] !== state) {
      items.push({ state: state === 'bad' ? 'bad' : 'warn', title: `${key} changed`, detail: `${previous.services[key]} -> ${state}` });
    }
  }

  if (previous.funnelMetric !== current.funnelMetric) {
    items.push({ state: 'warn', title: 'External access changed', detail: `${previous.funnelMetric || 'none'} -> ${current.funnelMetric || 'none'}` });
  }
  if (previous.accessoryCount !== current.accessoryCount && previous.accessoryCount !== null && current.accessoryCount !== null) {
    items.push({ state: 'warn', title: 'Accessories changed', detail: `${previous.accessoryCount} -> ${current.accessoryCount}` });
  }
  if (current.wanState === 'warn' || current.wanState === 'bad') {
    items.push({ state: current.wanState, title: 'WAN', detail: 'Packet loss or latency needs attention.' });
  }
  if (current.softwareUpdateState === 'warn' && previous.softwareUpdateValue !== current.softwareUpdateValue) {
    items.push({ state: 'warn', title: 'Updates changed', detail: `${current.softwareUpdateValue} update signal changed.` });
  }
  if (current.macUpdateState === 'warn' && previous.macUpdateMetric !== current.macUpdateMetric) {
    items.push({ state: 'warn', title: 'macOS', detail: `${current.macUpdateMetric} macOS update signal changed.` });
  }
  if (current.systemLogState === 'bad' || current.systemLogState === 'warn') {
    items.push({ state: current.systemLogState, title: 'Mac restart incident', detail: 'Mac system incident is still open.' });
  }
  if ((current.serviceLogState === 'bad' || current.serviceLogState === 'warn') && previous.serviceLogValue !== current.serviceLogValue) {
    items.push({ state: current.serviceLogState, title: current.serviceLogValue || 'Service logs', detail: 'Service log signal is still open.' });
  }

  if (items.length === 0) {
    return [{ state: 'ok', title: 'No drift', detail: 'No service, public access, accessory, WAN, update, or log changes since the last check.' }];
  }
  return items.slice(0, 5);
}

function normalizeTimelineEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const title = String(event.title || '');
  const detail = String(event.detail || '');
  if (/system logs/i.test(title) || /recent mac logs need attention/i.test(detail)) {
    return {
      ...event,
      title: 'Mac restart incident',
      detail: 'Mac system incident is still open.'
    };
  }
  if (/service logs/i.test(title) && /service logs? (need attention|signal changed)/i.test(detail)) {
    return {
      ...event,
      title: 'Service log signal',
      detail: 'Service log signal is still open.'
    };
  }
  return event;
}

function compactTimeline(events) {
  const compacted = [];
  for (const event of events) {
    const eventTime = new Date(event && event.at || 0).getTime();
    const sameOpenIncident = compacted.some(previous => {
      const previousTime = new Date(previous && previous.at || 0).getTime();
      return previous
        && previous.title === event.title
        && previous.detail === event.detail
        && previous.state === event.state
        && Number.isFinite(previousTime)
        && Number.isFinite(eventTime)
        && Math.abs(previousTime - eventTime) <= HOUR_MS;
    });
    if (sameOpenIncident) continue;
    compacted.push(event);
  }
  return compacted;
}

function eventFromWeird(item) {
  return {
    at: nowIso(),
    time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    title: item.title,
    detail: item.detail,
    state: item.state
  };
}

function updateTimeline(ctx, services, intelligence, score) {
  const previous = readDataSafe(ctx, 'snapshot.json', null);
  const current = snapshotFor(services, intelligence, score);
  const weirdThings = buildWeirdThings(previous, current);
  const timelineData = readDataSafe(ctx, 'timeline.json', { events: [] });
  const events = compactTimeline((Array.isArray(timelineData.events) ? timelineData.events : []).map(normalizeTimelineEvent));

  const last = events[0];
  const shouldHeartbeat = !last || Date.now() - new Date(last.at || 0).getTime() > HOUR_MS;
  const meaningful = weirdThings.filter(item => item.title !== 'No drift' && item.title !== 'No new weird thing');
  const additions = meaningful.length
    ? meaningful.map(eventFromWeird).filter(event => {
        const lastTime = new Date(last && last.at || 0).getTime();
        const repeated = last && last.title === event.title && last.detail === event.detail && last.state === event.state;
        return !repeated || !Number.isFinite(lastTime) || Date.now() - lastTime > HOUR_MS;
      })
    : shouldHeartbeat
      ? [eventFromWeird({ state: 'ok', title: 'Status check', detail: `Readiness ${score}; no changes.` })]
      : [];

  const nextEvents = [...additions, ...events].slice(0, TIMELINE_LIMIT);
  writeDataSafe(ctx, 'timeline.json', { events: nextEvents });
  writeDataSafe(ctx, 'snapshot.json', current);
  intelligence.weirdThings = weirdThings;
  return nextEvents.length ? nextEvents : additions;
}

function scoreServices(services, intelligence, systemVitals) {
  const values = Object.values(services);
  const points = values.reduce((sum, service) => {
    if (service.state === 'ok') return sum + 1;
    if (service.state === 'info') return sum + 1;
    if (service.state === 'warn') return sum + 0.55;
    return sum;
  }, 0);
  const serviceScore = Math.round((points / values.length) * 100);
  const signalPenalty = usefulSignals(intelligence).reduce((sum, signal) => {
    if (signal.state === 'bad') return sum + 14;
    if (signal.state === 'warn') return sum + 8;
    return sum;
  }, 0);
  const vitalPenalty = usefulVitals(systemVitals).reduce((sum, signal) => {
    if (signal.state === 'bad') return sum + 10;
    return sum + 5;
  }, 0);
  return Math.max(0, Math.min(100, serviceScore - signalPenalty - vitalPenalty));
}

function worstState(signals) {
  const rank = { bad: 0, warn: 1, info: 2, ok: 3 };
  return (signals || [])
    .filter(Boolean)
    .map(signal => signal.state || 'info')
    .sort((a, b) => (rank[a] ?? 2) - (rank[b] ?? 2))[0] || 'info';
}

function zoneValue(state, okValue, infoValue = okValue) {
  if (state === 'bad') return 'Issue';
  if (state === 'warn') return 'Review';
  if (state === 'info') return infoValue;
  return okValue;
}

function actionSignal(signal) {
  if (!signal || typeof signal !== 'object') return signal;
  if (signal.state === 'bad' || signal.state === 'warn') return signal;
  return { ...signal, state: 'ok' };
}

function reviewVital(signal) {
  if (!signal || typeof signal !== 'object') return signal;
  if (signal.state === 'bad' || signal.review === true) return signal;
  return { ...signal, state: 'ok' };
}

function firstReviewDetail(signals, fallback) {
  const match = (signals || []).filter(Boolean).find(signal => signal.state === 'bad' || signal.state === 'warn');
  return (match && match.detail) || fallback;
}

function hasMacRestartIncident(intelligence, systemVitals) {
  const systemLogs = intelligence && intelligence.systemLogs;
  if (!signalBadOrWarn(systemLogs)) return false;
  if (systemLogs.incident && Array.isArray(systemLogs.incident.reports) && systemLogs.incident.reports.length > 0) return true;
  const uptimeSeconds = Number(systemVitals && systemVitals.uptimeSeconds);
  return Number.isFinite(uptimeSeconds) && uptimeSeconds > 0 && uptimeSeconds < 24 * 60 * 60;
}

function systemIncidentTitle(systemLogs) {
  const incident = systemLogs && systemLogs.incident;
  if (incident && incident.title) return incident.title;
  const detail = String(systemLogs && systemLogs.detail || '');
  if (/watchdog|panic|kernel/i.test(detail)) return 'WindowServer watchdog panic';
  return 'Mac restart incident';
}

function macIncidentDetail(systemLogs, systemVitals) {
  const title = systemIncidentTitle(systemLogs);
  const uptime = systemVitals && systemVitals.uptime ? systemVitals.uptime : null;
  return uptime ? `${title}; uptime is ${uptime}.` : `${title} needs review.`;
}

function translatePrimaryAction(needs) {
  if (!Array.isArray(needs) || needs.length === 0) return 'No review items.';
  const first = String(needs[0] || '').toLowerCase();
  if (/external|public|funnel|access|tailscale/.test(first)) return 'Start with public access.';
  if (/internet|wan|dns|network/.test(first)) return 'Start with internet.';
  if (/homebridge|automation|accessor|service logs|homebridge log/.test(first)) return 'Start with automations.';
  if (/openclaw/.test(first)) return 'Start with OpenClaw.';
  if (/mac restart|watchdog|panic/.test(first)) return 'Start with the Mac mini restart.';
  if (/mac|cpu|memory|disk|system logs|updates|app versions/.test(first)) return 'Start with the Mac mini.';
  return 'Start with the first review item.';
}

function isResolvedRecentChange(event, current) {
  if (!event || (event.state !== 'warn' && event.state !== 'bad')) return false;
  const title = String(event.title || '').toLowerCase();
  const services = current.services || {};
  for (const key of Object.keys(services)) {
    if (title === `${key} changed` || title.includes(`${key} changed`)) {
      return services[key] && services[key].state !== 'warn' && services[key].state !== 'bad';
    }
  }
  if (title.includes('system logs')) return current.systemLogs && current.systemLogs.state === 'ok';
  if (title.includes('service logs')) {
    return current.serviceLogs && current.serviceLogs.state !== 'warn' && current.serviceLogs.state !== 'bad';
  }
  if (title.includes('updates') || title.includes('app versions')) {
    return current.softwareUpdates && current.softwareUpdates.state !== 'warn' && current.softwareUpdates.state !== 'bad';
  }
  if (title.includes('macos')) return current.macUpdates && current.macUpdates.state === 'ok';
  if (title.includes('wan')) return current.wanQuality && current.wanQuality.state === 'ok';
  if (title.includes('external access') || title.includes('public access')) {
    return current.tailscaleFunnel && current.tailscaleFunnel.state !== 'warn' && current.tailscaleFunnel.state !== 'bad';
  }
  return false;
}

function meaningfulRecentChanges(timeline, current = {}) {
  const grouped = [];
  for (const event of (Array.isArray(timeline) ? timeline : [])) {
    if (!event || event.title === 'Status check' || event.title === 'No drift') continue;
    const eventTime = new Date(event.at || 0).getTime();
    if (Number.isFinite(eventTime) && Date.now() - eventTime > 24 * HOUR_MS) continue;
    if (/no changes/i.test(event.detail || '')) continue;
    if (event.title === 'Service logs' && /\b\d+\s+service log signal changed\b/i.test(event.detail || '')) continue;
    if (isResolvedRecentChange(event, current)) continue;
    let title = event.title || 'Change';
    let detail = event.detail || 'Change detected.';
    if (/system logs/i.test(title) && current.systemLogs && signalBadOrWarn(current.systemLogs)) {
      title = 'Mac restart incident';
      detail = 'Mac system incident is still open.';
    }
    if (/service logs/i.test(title) && current.serviceLogs && signalBadOrWarn(current.serviceLogs)) {
      title = current.serviceLogs.value || 'Service logs';
      detail = 'Service log signal is still open.';
    }
    const key = `${title}|${detail}|${event.state || 'info'}`;
    const existing = grouped.find(item => item.key === key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.push({
      key,
      count: 1,
      title,
      detail,
      state: event.state || 'info',
      at: event.at,
      time: event.time
    });
  }
  return grouped
    .map(({ key, ...event }) => ({
      ...event,
      detail: event.count > 1 && event.title !== 'Mac restart incident'
        ? `${event.detail} Seen ${event.count} times.`
        : event.detail
    }))
    .slice(0, 3);
}

function deriveHouseState(services, intelligence, systemVitals, reviewItems, timeline, score) {
  const homebridge = intelligence.homebridge || {};
  const health = systemVitals.health || {};
  const macIncident = hasMacRestartIncident(intelligence, systemVitals);
  const publicAccess = intelligence.publicAccess || publicAccessRollup(intelligence.tailscaleFunnel);
  const outsideState = worstState([publicAccess]);
  const networkState = worstState([services.adguard, services.internet, services.tailscale, intelligence.wanQuality, actionSignal(intelligence.networkLogs)]);
  const smartHomeState = worstState([
    services.homebridge,
    homebridge.accessories,
    actionSignal(homebridge.logHealth),
    actionSignal(homebridge.version),
    actionSignal(intelligence.automationLogs)
  ]);
  const macMiniState = worstState([
    services.openclaw,
    reviewVital(health.cpu),
    reviewVital(health.memory),
    reviewVital(health.disk),
    actionSignal(intelligence.macUpdates),
    actionSignal(intelligence.systemLogs),
    actionSignal(intelligence.macMiniLogs)
  ]);
  const networkSignals = [services.internet, intelligence.wanQuality, services.adguard, services.tailscale, intelligence.networkLogs];
  const smartHomeSignals = [services.homebridge, intelligence.automationLogs, homebridge.logHealth, homebridge.version, homebridge.accessories];
  const macMiniSignals = [
    services.openclaw,
    health.cpu,
    health.memory,
    health.disk,
    intelligence.macUpdates,
    intelligence.systemLogs,
    intelligence.macMiniLogs
  ];
  const zones = [
    {
      id: 'outside-access',
      title: 'Public access',
      state: outsideState,
      value: zoneValue(outsideState, 'Known', 'Known'),
      detail: outsideState === 'ok' || outsideState === 'info'
        ? publicAccess.detail || 'Expected public routes are accounted for.'
        : publicAccess.detail || 'Public access needs review.',
      evidence: publicAccess.acceptedRoutes && publicAccess.acceptedRoutes.length > 0
        ? publicAccess.acceptedRoutes.map(route => route.name)
        : ['Tailscale Funnel']
    },
    {
      id: 'network',
      title: 'Internet',
      state: networkState,
      value: zoneValue(networkState, 'Normal'),
      detail: networkState === 'ok'
        ? 'Internet, DNS, and Tailscale are responding.'
        : firstReviewDetail(networkSignals, 'Network checks need review.'),
      evidence: ['Internet', 'DNS', 'Tailscale']
    },
    {
      id: 'smart-home',
      title: 'Automations',
      state: smartHomeState,
      value: zoneValue(smartHomeState, 'Responding'),
      detail: smartHomeState === 'ok'
        ? 'Homebridge and accessories are responding.'
        : firstReviewDetail(smartHomeSignals, 'Automation checks need review.'),
      evidence: ['Homebridge', 'Accessories', 'Homebridge logs']
    },
    {
      id: 'mac-mini',
      title: 'Mac mini',
      state: macMiniState,
      value: zoneValue(macMiniState, 'Healthy'),
      detail: macIncident
        ? macIncidentDetail(intelligence.systemLogs, systemVitals)
        : macMiniState === 'ok'
        ? 'System checks, updates, and service logs are quiet.'
        : firstReviewDetail(macMiniSignals, 'Mac mini checks need review.'),
      evidence: ['OpenClaw', 'macOS', 'System logs', 'Service logs']
    }
  ];
  zones.sort((a, b) => {
    if (macIncident) {
      if (a.id === 'mac-mini') return -1;
      if (b.id === 'mac-mini') return 1;
    }
    const stateRank = stateRankForSort(a.state) - stateRankForSort(b.state);
    if (stateRank !== 0) return stateRank;
    return DEFAULT_ZONE_KEYS.indexOf(a.id) - DEFAULT_ZONE_KEYS.indexOf(b.id);
  });
  const hasBad = zones.some(zone => zone.state === 'bad') || score < 70;
  const hasReview = hasBad || zones.some(zone => zone.state === 'warn') || (Array.isArray(reviewItems) && reviewItems.length > 0);
  const headline = macIncident
    ? 'Mac mini restarted this morning.'
    : hasBad ? 'Homebase found an issue.' : hasReview ? 'Something needs a look.' : "Dan's house is steady.";
  const summary = macIncident
    ? 'Start with the Mac mini restart; house services are online.'
    : hasBad
      ? `${translatePrimaryAction(reviewItems)} Core evidence is still available below.`
      : hasReview
        ? `${translatePrimaryAction(reviewItems)} Everything else is responding.`
        : 'Internet, automations, public access, and the Mac mini are quiet.';
  return {
    headline,
    summary,
    tone: hasBad ? 'issue' : hasReview ? 'review' : 'steady',
    primaryAction: macIncident ? 'Start with the Mac mini restart.' : translatePrimaryAction(reviewItems),
    incident: macIncident ? {
      title: systemIncidentTitle(intelligence.systemLogs),
      detail: macIncidentDetail(intelligence.systemLogs, systemVitals),
      source: 'System logs'
    } : null,
    zones,
    recentChanges: meaningfulRecentChanges(timeline, {
      systemLogs: intelligence.systemLogs,
      serviceLogs: intelligence.serviceLogs,
      softwareUpdates: intelligence.softwareUpdates,
      macUpdates: intelligence.macUpdates,
      wanQuality: intelligence.wanQuality,
      tailscaleFunnel: intelligence.tailscaleFunnel,
      publicAccess,
      services
    })
  };
}

function usefulSignals(intelligence) {
  if (!intelligence) return [];
  return [
    ['Mac restart incident', intelligence.systemLogs],
    ['Public access', intelligence.publicAccess || intelligence.tailscaleFunnel],
    ['Door locks', intelligence.homebridge && intelligence.homebridge.doorLocks],
    ['WAN', intelligence.wanQuality],
    ['Automation logs', intelligence.automationLogs],
    ['Mac mini service logs', intelligence.macMiniLogs],
    ['Network service logs', intelligence.networkLogs],
    ['Homebridge Log', intelligence.homebridge && intelligence.homebridge.logHealth],
    ['App Versions', intelligence.softwareUpdates],
    ['macOS', intelligence.macUpdates]
  ]
    .filter(([, signal]) => signal && signal.hidden !== true && (signal.state === 'warn' || signal.state === 'bad'))
    .map(([name, signal]) => ({ name, state: signal.state, metric: signal.metric || signal.value || 'watch', signal }));
}

function usefulVitals(systemVitals) {
  const health = systemVitals && systemVitals.health ? systemVitals.health : {};
  return Object.entries(health)
    .filter(([, signal]) => signal && (signal.state === 'bad' || signal.review === true))
    .map(([key, signal]) => ({
      name: key === 'cpu' ? 'CPU' : key === 'memory' ? 'Memory' : 'Disk',
      state: signal.state,
      metric: signal.metric || 'watch',
      signal
    }));
}

function needsDan(services, intelligence, systemVitals) {
  const serviceItems = Object.entries(services)
    .filter(([, service]) => service.state !== 'ok' && service.state !== 'info')
    .map(([key, service]) => {
      return `${SERVICE_NAMES[key] || key}: ${service.metric}`;
    });
  const signalItems = usefulSignals(intelligence).map(item => {
    if (item.name === 'Mac restart incident') return item.name;
    return `${item.name}: ${item.metric}`;
  });
  const vitalItems = usefulVitals(systemVitals).map(item => `${item.name}: ${item.metric}`);
  return [...serviceItems, ...signalItems, ...vitalItems];
}

function reviewEvidenceFor(services, intelligence, systemVitals, reviewItems) {
  const checkedAt = nowIso();
  const serviceEvidence = Object.entries(services || {})
    .filter(([, service]) => service && service.state !== 'ok' && service.state !== 'info')
    .map(([key, service]) => {
      const label = `${SERVICE_NAMES[key] || key}: ${service.metric}`;
      return {
        label,
        state: service.state || 'warn',
        source: service.source || service.check || `${SERVICE_NAMES[key] || key} check`,
        confidence: service.confidence || 'live',
        checkedAt,
        freshness: service.confidence || 'live',
        detail: service.detail || null
      };
    });
  const signalEvidence = usefulSignals(intelligence).map(item => {
    const label = item.name === 'Mac restart incident' ? item.name : `${item.name}: ${item.metric}`;
    const signal = item.signal || {};
    return {
      label,
      state: item.state || signal.state || 'warn',
      source: signal.source || signal.check || item.name,
      confidence: signal.confidence || 'live',
      checkedAt: signal.checkedAt || checkedAt,
      freshness: signal.confidence || 'live',
      detail: signal.detail || null
    };
  });
  const vitalEvidence = usefulVitals(systemVitals).map(item => {
    const label = `${item.name}: ${item.metric}`;
    const signal = item.signal || {};
    return {
      label,
      state: item.state || signal.state || 'warn',
      source: 'Mac mini vitals',
      confidence: signal.confidence || 'live',
      checkedAt,
      freshness: signal.confidence || 'live',
      detail: signal.detail || null
    };
  });
  const byLabel = new Map([...serviceEvidence, ...signalEvidence, ...vitalEvidence].map(item => [item.label, item]));
  return (Array.isArray(reviewItems) ? reviewItems : [])
    .map(label => byLabel.get(label) || {
      label,
      state: 'warn',
      source: 'Homebase ranking',
      confidence: 'derived',
      checkedAt,
      freshness: 'derived',
      detail: null
    });
}

function signalBadOrWarn(signal) {
  return signal && signal.hidden !== true && (signal.state === 'bad' || signal.state === 'warn');
}

function stripRawTelemetry(text) {
  return String(text || '')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, 'local address')
    .replace(/\b(?:\d{2,5},\s*)+\d{2,5}\b/g, 'known routes')
    .replace(/\b(?:\d+\.){2,}\d+\b/g, 'current version')
    .replace(/\b\d+\s*(?:ms|warnings?|errors?|issues?|findings?|notable lines)\b/gi, 'current signal')
    .trim();
}

function decisionSlot(key, text, state, source) {
  return {
    key,
    label: key === 'now' ? 'Now' : key === 'watch' ? 'Watch' : 'Later',
    text: stripRawTelemetry(text),
    state,
    source
  };
}

function optionalMaintenance(intelligence) {
  const homebridge = intelligence.homebridge || {};
  if (homebridge.version && homebridge.version.state === 'info' && /ui|patch|optional/i.test(homebridge.version.detail || '')) {
    return 'Homebridge UI has a patch update when convenient.';
  }
  if (intelligence.softwareUpdates && intelligence.softwareUpdates.state === 'info') {
    return 'App updates can wait until a maintenance pass.';
  }
  if (intelligence.macUpdates && intelligence.macUpdates.state === 'info') {
    return 'macOS update status can wait for maintenance.';
  }
  return 'Logs and route exposure are accounted for.';
}

function recentDecisionChange(houseState) {
  const currentChange = houseState && Array.isArray(houseState.recentChanges) ? houseState.recentChanges[0] : null;
  if (!currentChange) return null;
  const changedAt = Date.parse(currentChange.at || '');
  if (Number.isFinite(changedAt) && Date.now() - changedAt > 6 * HOUR_MS) return null;
  const title = String(currentChange.title || 'House signal').replace(/\s+changed$/i, '').trim();
  const cleanTitle = title ? title[0].toUpperCase() + title.slice(1) : 'House signal';
  const detail = String(currentChange.detail || '');
  if (/\b(?:bad|warn)\s*->\s*ok\b/i.test(detail)) return `${cleanTitle} recovered recently.`;
  return `${cleanTitle} changed recently.`;
}

function watchSignal(intelligence, houseState) {
  const currentChange = recentDecisionChange(houseState);
  if (currentChange) return currentChange;
  const publicAccess = intelligence.publicAccess || intelligence.tailscaleFunnel;
  if (publicAccess && publicAccess.state === 'info') return 'Public access is known and passworded.';
  if (intelligence.serviceLogs && intelligence.serviceLogs.state === 'ok') return 'Service logs are quiet.';
  if (intelligence.wanQuality && intelligence.wanQuality.state === 'ok') return 'Internet quality is normal.';
  return 'House evidence is current.';
}

function activeDecisionSignal(services, intelligence, systemVitals) {
  const homebridge = intelligence.homebridge || {};
  const health = systemVitals.health || {};
  const candidates = [
    ['Mac restart incident', intelligence.systemLogs, 'Review the Mac mini restart.', 0],
    ['Public access', intelligence.publicAccess || intelligence.tailscaleFunnel, 'Check public access first.', 10],
    ['Internet', intelligence.wanQuality, 'Check internet quality first.', 20],
    ['DNS', services.adguard, 'Check DNS first.', 30],
    ['Homebridge', services.homebridge, 'Check Homebridge first.', 40],
    ['OpenClaw', services.openclaw, 'Check OpenClaw first.', 50],
    ['Automation logs', intelligence.automationLogs, 'Check automations first.', 60],
    ['Mac mini service logs', intelligence.macMiniLogs, 'Check Mac mini service logs first.', 65],
    ['Network service logs', intelligence.networkLogs, 'Check network service logs first.', 67],
    ['Homebridge log', homebridge.logHealth, 'Check Homebridge logs first.', 70],
    ['CPU', reviewVital(health.cpu), 'Check Mac mini load first.', 80],
    ['Memory', reviewVital(health.memory), 'Check Mac mini memory pressure first.', 90],
    ['Disk', reviewVital(health.disk), 'Check Mac mini disk first.', 100]
  ];
  return candidates
    .filter(([, signal]) => signalBadOrWarn(signal))
    .sort((a, b) => {
      const stateRank = stateRankForSort(a[1].state) - stateRankForSort(b[1].state);
      const priorityRank = (a[3] ?? 999) - (b[3] ?? 999);
      if (a[0] === 'Mac restart incident' || b[0] === 'Mac restart incident') return priorityRank;
      return stateRank === 0 ? priorityRank : stateRank;
    })[0] || null;
}

function stateRankForSort(state) {
  if (state === 'bad') return 0;
  if (state === 'warn') return 1;
  if (state === 'info') return 2;
  return 3;
}

function deriveDailyDecision(services, intelligence, systemVitals, reviewItems, houseState) {
  const active = activeDecisionSignal(services, intelligence, systemVitals);
  const tone = houseState && houseState.tone ? houseState.tone : 'steady';
  let now;
  if (active) {
    const [, signal, fallback] = active;
    now = decisionSlot('now', fallback || signal.detail || translatePrimaryAction(reviewItems), signal.state, active[0]);
  } else if (Array.isArray(reviewItems) && reviewItems.length > 0) {
    now = decisionSlot('now', translatePrimaryAction(reviewItems), 'warn', 'needsDan');
  } else {
    now = decisionSlot('now', 'Nothing needs Dan.', 'ok', 'needsDan');
  }

  const watch = decisionSlot('watch', watchSignal(intelligence, houseState), 'info', 'houseState');
  const later = decisionSlot('later', optionalMaintenance(intelligence), 'info', 'maintenance');
  return {
    tone,
    slots: [now, watch, later]
  };
}

function eventsFromServices(services) {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return Object.entries(services).map(([key, service]) => ({
    time,
    title: SERVICE_NAMES[key] || key.replace(/^\w/, c => c.toUpperCase()),
    detail: service.state === 'ok' ? 'Passed' : service.detail
  }));
}

function teddyHouseApi(ctx = {}) {
  return {
    routes: {
      'POST /ask': async (req, res, { body }) => askTeddy(ctx, body || {}),
      'GET /logs': async () => logDetailPayload(ctx),
      'GET /health': async () => {
        const [adguard, homebridge, tailscale, internet, openclaw, backups, systemVitals, intelligence] = await Promise.all([
          checkAdGuard(),
          checkHomebridge(),
          checkTailscale(),
          checkInternet(),
          checkOpenClaw(),
          checkBackups(),
          vitals(ctx),
          buildIntelligence(ctx)
        ]);

        const services = { adguard, homebridge, tailscale, internet, openclaw, backups };
        const score = scoreServices(services, intelligence, systemVitals);
        const timeline = updateTimeline(ctx, services, intelligence, score);
        const insights = await buildInsights(services, systemVitals, intelligence);
        const reviewItems = needsDan(services, intelligence, systemVitals);
        const reviewEvidence = reviewEvidenceFor(services, intelligence, systemVitals, reviewItems);
        const houseState = deriveHouseState(services, intelligence, systemVitals, reviewItems, timeline, score);
        const dailyDecision = deriveDailyDecision(services, intelligence, systemVitals, reviewItems, houseState);
        const historicalSummaries = buildHistoricalSummaries(systemVitals, timeline, intelligence);
        const visualEvidence = updateVisualEvidenceLog(
          ctx,
          buildVisualEvidence(services, insights, intelligence, systemVitals, timeline, score, houseState, dailyDecision, historicalSummaries)
        );
        return {
          checkedAt: nowIso(),
          score,
          needsDan: reviewItems,
          reviewEvidence,
          houseState,
          dailyDecision,
          services,
          insights,
          intelligence,
          historicalSummaries,
          visualEvidence,
          presentation: buildPresentationContract(),
          vitals: systemVitals,
          events: timeline.length ? timeline : eventsFromServices(services),
          timeline
        };
      }
    }
  };
}

teddyHouseApi._internals = {
  deriveDailyDecision,
  deriveHouseState,
  domainServiceLogs,
  buildHistoricalSummaries,
  updateBootHistory,
  updateWanHistory,
  updatePublicAccessHistory,
  updateAutomationLogHistory,
  publicAccessRollup,
  needsDan,
  reviewEvidenceFor,
  scoreServices,
  summarizeForTeddy,
  answerFromDashboardContext
};

module.exports = teddyHouseApi;

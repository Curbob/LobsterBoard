const dns = require('dns').promises;
const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const TIMEOUT_MS = 2200;
const TIMELINE_LIMIT = 80;
const HOUR_MS = 60 * 60 * 1000;
const UPDATE_CACHE_MS = 12 * HOUR_MS;
const EVIDENCE_LIMIT = 120;
const DEFAULT_SERVICE_KEYS = ['adguard', 'homebridge', 'tailscale', 'internet', 'openclaw'];
const DEFAULT_SIGNAL_KEYS = [
  'adguardBlocks',
  'homebridgeAccessories',
  'homebridgeLogs',
  'publicFunnel',
  'wanQuality',
  'softwareUpdates'
];
const HIDDEN_BY_DEFAULT = {
  services: ['backups'],
  signals: ['weirdThings'],
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

function ok(detail, metric, check) {
  return { state: 'ok', detail, metric, check };
}

function warn(detail, metric, check) {
  return { state: 'warn', detail, metric, check };
}

function info(detail, metric, check) {
  return { state: 'info', detail, metric, check };
}

function bad(detail, metric, check) {
  return { state: 'bad', detail, metric, check };
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

function stripSignal(signal) {
  if (!signal || typeof signal !== 'object') return null;
  return {
    state: signal.state || 'info',
    metric: signal.metric ?? signal.value ?? signal.count ?? null,
    label: signal.label || signal.check || null,
    detail: signal.detail || null
  };
}

function buildVisualEvidence(services, insights, intelligence, vitalsData, timeline, score) {
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
          homebridgeAccessories: stripSignal(intelligence.homebridge.accessories),
          homebridgeLogs: stripSignal(intelligence.homebridge.logHealth),
          publicFunnel: stripSignal(intelligence.tailscaleFunnel),
          wanQuality: stripSignal(intelligence.wanQuality),
          softwareUpdates: stripSignal(intelligence.softwareUpdates),
          weirdThings: Array.isArray(intelligence.weirdThings)
            ? intelligence.weirdThings.filter(item => item.title !== 'No drift' && item.title !== 'No new weird thing').length
            : 0
        }
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
      }
    }
  };
}

function buildPresentationContract() {
  return {
    defaultServiceKeys: DEFAULT_SERVICE_KEYS,
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
    return ok(`DNS is resolving locally. ${admin === 'admin locked' ? 'Admin stats are locked.' : 'Admin is reachable.'}`, `${dnsMs} ms`, 'DNS');
  } catch (err) {
    return bad(`Local DNS failed: ${err.message}.`, 'failed', 'DNS');
  }
}

async function checkHomebridge() {
  try {
    await tcpCheck('127.0.0.1', 8581);
    return ok('Homebridge is reachable from the Mac mini.', '8581', 'Port');
  } catch (err) {
    return bad(`Homebridge did not answer: ${err.message}.`, 'offline', 'Port');
  }
}

async function checkTailscale() {
  try {
    const stdout = await run('tailscale', ['status', '--json']);
    const data = JSON.parse(stdout);
    const ip = (data.Self && data.Self.TailscaleIPs && data.Self.TailscaleIPs[0]) || 'connected';
    const online = data.Self && data.Self.Online !== false;
    if (!online) return warn('This Mac mini looks offline on Tailscale.', ip, 'Tailscale');
    return ok('This Mac mini is online on Tailscale.', ip, 'Tailscale');
  } catch (err) {
    return warn(`Could not read Tailscale status: ${err.message}.`, 'unknown', 'Tailscale');
  }
}

async function checkTailscaleFunnel() {
  const status = await tryRun('tailscale', ['funnel', 'status']);
  if (!status.ok) {
    return info('Could not read public access status.', 'unknown', 'Public access');
  }

  const ports = [...status.stdout.matchAll(/https:\/\/[^\s:]+(?::(\d+))?\s+\(Funnel on\)/g)]
    .map(match => match[1] || '443');
  const uniquePorts = [...new Set(ports)].sort((a, b) => Number(a) - Number(b));
  if (uniquePorts.length === 0) {
    return ok('Public access is off.', 'off', 'Public access');
  }

  const hasHouse = uniquePorts.includes('10000');
  const extras = uniquePorts.filter(port => port !== '10000');
  if (hasHouse && extras.length === 0) {
    return ok('Only Teddy Homebase is public.', '10000', 'Public access');
  }
  if (hasHouse) {
    return warn(`Teddy Homebase is public. Extra public port${extras.length === 1 ? '' : 's'}: ${extras.join(', ')}.`, uniquePorts.join(', '), 'Public access');
  }
  return warn(`Public access is on, but not on the Homebase port: ${uniquePorts.join(', ')}.`, uniquePorts.join(', '), 'Public access');
}

async function checkInternet() {
  const started = Date.now();
  try {
    await withTimeout(dns.resolve4('apple.com'));
    const dnsMs = Date.now() - started;
    try {
      const res = await fetchCheck('https://www.gstatic.com/generate_204');
      return ok('Internet checks are answering.', `${Math.max(dnsMs, res.ms)} ms`, 'WAN');
    } catch (_) {
      return warn('DNS works, but the web check did not finish.', `${dnsMs} ms`, 'WAN');
    }
  } catch (err) {
    return bad(`Internet DNS failed: ${err.message}.`, 'failed', 'WAN');
  }
}

async function checkWanQuality() {
  const ping = await tryRun('ping', ['-c', '4', '-W', '1000', '1.1.1.1'], 5500);
  if (!ping.ok) {
    return info('Could not run the packet-loss check.', 'unknown', 'WAN');
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

  if (loss !== null && loss > 0) return warn(`${detail} Packet loss is above zero.`, metric, 'WAN');
  if (avg !== null && avg > 80) return warn(`${detail} Latency is high.`, `${avg.toFixed(0)} ms`, 'WAN');
  return ok(detail, avg === null ? metric : `${avg.toFixed(0)} ms`, 'WAN');
}

async function checkOpenClaw() {
  const gateway = await tryRun('launchctl', ['list', 'ai.openclaw.gateway']);
  const pidMatch = gateway.stdout.match(/"PID"\s*=\s*(\d+)/);
  const pid = pidMatch ? pidMatch[1] : null;

  async function tailnetIp() {
    const status = await tryRun('tailscale', ['status', '--json']);
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

async function checkSoftwareUpdates(ctx) {
  const cached = readDataSafe(ctx, 'software-updates.json', null);
  if (cached && cached.checkedAt && Date.now() - new Date(cached.checkedAt).getTime() < UPDATE_CACHE_MS) {
    const gitState = await gitFreshness(path.resolve(__dirname, '..', '..'));
    const cachedUpdates = Array.isArray(cached.items)
      ? cached.items.filter(item => item.state === 'warn').length
      : Number(cached.value || 0);
    return normalizeSoftwareUpdateCopy({
      ...cached,
      state: cachedUpdates > 0 || gitState.state === 'warn' ? 'warn' : 'ok',
      value: cachedUpdates > 0 ? `${cachedUpdates}` : 'current',
      detail: cachedUpdates > 0
        ? `${cachedUpdates} update${cachedUpdates === 1 ? '' : 's'} available. ${gitState.detail}`
        : `OpenClaw and Teddy Homebase are current. ${gitState.detail}`,
      git: gitState
    });
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
    state: updatesAvailable > 0 || gitState.state === 'warn' ? 'warn' : 'ok',
    value: updatesAvailable > 0 ? `${updatesAvailable}` : 'current',
    label: 'version check',
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

async function adGuardStats() {
  try {
    const res = await fetchJson('http://127.0.0.1:3001/control/stats');
    if (res.status === 401 || res.status === 403) {
      return {
        state: 'info',
        value: 'locked',
        label: 'locked',
        detail: 'Blocked-query stats need the local AdGuard login.',
        topBlocked: []
      };
    }
    if (res.status !== 200 || !res.json) {
      return {
        state: 'warn',
        value: `HTTP ${res.status}`,
        label: 'stats',
        detail: 'AdGuard stats returned an unexpected response.',
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
      topBlocked
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'stats unavailable',
      detail: `Could not read AdGuard stats: ${err.message}.`,
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

async function vitals() {
  const total = os.totalmem();
  const free = os.freemem();
  const usedPct = Math.round(((total - free) / total) * 100);
  const load = os.loadavg()[0].toFixed(2);
  return {
    cpu: load,
    memory: `${usedPct}%`,
    disk: await diskUsage(),
    uptime: formatUptime(os.uptime()),
    network: 'local',
    host: os.hostname()
  };
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

async function homebridgeLogHealth() {
  try {
    const logPath = await freshestHomebridgeLog();
    const log = await fs.readFile(logPath, 'utf8');
    const lines = log.split('\n').slice(-500);
    const cleanLines = lines.map(stripAnsi);
    const issueLines = cleanLines.filter(line => /\b(error|warn|warning|failed|uncaught|exception)\b/i.test(line));
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
    if (issueLines.length > 20) {
      return {
        state: 'warn',
        value: `${issueLines.length}`,
        label: 'recent issues',
        detail: `${issueLines.length} recent warnings or errors.`
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
    const log = await fs.readFile('/Users/teddyclaw/.openclaw/logs/gateway.log', 'utf8');
    const ready = log
      .split('\n')
      .filter(line => line.includes('[gateway] ready'))
      .pop();
    if (!ready) return { age: 'unknown', detail: 'No recent ready signal found.' };
    const stamp = ready.slice(0, 29);
    return { age: formatAgeFromDate(new Date(stamp)), detail: `Last ready signal was ${formatAgeFromDate(new Date(stamp))}.` };
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
  const parked = Object.values(services).filter(service => service.state === 'info').length;
  const teddySays = blockers > 0
    ? `${blockers} failed check${blockers === 1 ? '' : 's'}.`
    : watches > 0
      ? `${watches} watch item${watches === 1 ? '' : 's'}.`
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
  const [adguard, accessories, logHealth, funnel, wanQuality, softwareUpdates] = await Promise.all([
    adGuardStats(),
    homebridgeAccessorySummary(),
    homebridgeLogHealth(),
    checkTailscaleFunnel(),
    checkWanQuality(),
    checkSoftwareUpdates(ctx)
  ]);

  return {
    adguard,
    homebridge: { accessories, logHealth },
    tailscaleFunnel: funnel,
    wanQuality,
    softwareUpdates,
    weirdThings: []
  };
}

function snapshotFor(services, intelligence, score) {
  return {
    score,
    services: Object.fromEntries(Object.entries(services).map(([key, service]) => [key, service.state])),
    funnelMetric: intelligence.tailscaleFunnel.metric,
    accessoryCount: intelligence.homebridge.accessories.count,
    homebridgeLogState: intelligence.homebridge.logHealth.state,
    wanState: intelligence.wanQuality.state,
    adguardStatsState: intelligence.adguard.state,
    softwareUpdateState: intelligence.softwareUpdates.state,
    softwareUpdateValue: intelligence.softwareUpdates.value
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
    items.push({ state: 'warn', title: 'Public access changed', detail: `${previous.funnelMetric || 'none'} -> ${current.funnelMetric || 'none'}` });
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

  if (items.length === 0) {
    return [{ state: 'ok', title: 'No drift', detail: 'No service, public access, accessory, or WAN changes since the last check.' }];
  }
  return items.slice(0, 5);
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
  const events = Array.isArray(timelineData.events) ? timelineData.events : [];

  const last = events[0];
  const shouldHeartbeat = !last || Date.now() - new Date(last.at || 0).getTime() > HOUR_MS;
  const meaningful = weirdThings.filter(item => item.title !== 'No drift' && item.title !== 'No new weird thing');
  const additions = meaningful.length
    ? meaningful.map(eventFromWeird)
    : shouldHeartbeat
      ? [eventFromWeird({ state: 'ok', title: 'System check', detail: `Health ${score}; no drift.` })]
      : [];

  const nextEvents = [...additions, ...events].slice(0, TIMELINE_LIMIT);
  writeDataSafe(ctx, 'timeline.json', { events: nextEvents });
  writeDataSafe(ctx, 'snapshot.json', current);
  intelligence.weirdThings = weirdThings;
  return nextEvents.length ? nextEvents : additions;
}

function scoreServices(services) {
  const values = Object.values(services);
  const points = values.reduce((sum, service) => {
    if (service.state === 'ok') return sum + 1;
    if (service.state === 'info') return sum + 1;
    if (service.state === 'warn') return sum + 0.55;
    return sum;
  }, 0);
  return Math.round((points / values.length) * 100);
}

function needsDan(services) {
  return Object.entries(services)
    .filter(([, service]) => service.state !== 'ok' && service.state !== 'info')
    .map(([key, service]) => {
      const names = {
        adguard: 'DNS',
        homebridge: 'Homebridge',
        tailscale: 'Tailscale',
        internet: 'Internet',
        openclaw: 'OpenClaw',
        backups: 'Backups'
      };
      return `${names[key]}: ${service.metric}`;
    });
}

function eventsFromServices(services) {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return Object.entries(services).map(([key, service]) => ({
    time,
    title: key.replace(/^\w/, c => c.toUpperCase()),
    detail: service.state === 'ok' ? 'Passed' : service.detail
  }));
}

module.exports = function(ctx = {}) {
  return {
    routes: {
      'GET /health': async () => {
        const [adguard, homebridge, tailscale, internet, openclaw, backups, systemVitals, intelligence] = await Promise.all([
          checkAdGuard(),
          checkHomebridge(),
          checkTailscale(),
          checkInternet(),
          checkOpenClaw(),
          checkBackups(),
          vitals(),
          buildIntelligence(ctx)
        ]);

        const services = { adguard, homebridge, tailscale, internet, openclaw, backups };
        const score = scoreServices(services);
        const timeline = updateTimeline(ctx, services, intelligence, score);
        const insights = await buildInsights(services, systemVitals, intelligence);
        const visualEvidence = updateVisualEvidenceLog(
          ctx,
          buildVisualEvidence(services, insights, intelligence, systemVitals, timeline, score)
        );
        return {
          checkedAt: nowIso(),
          score,
          needsDan: needsDan(services),
          services,
          insights,
          intelligence,
          visualEvidence,
          presentation: buildPresentationContract(),
          vitals: systemVitals,
          events: timeline.length ? timeline : eventsFromServices(services),
          timeline
        };
      }
    }
  };
};

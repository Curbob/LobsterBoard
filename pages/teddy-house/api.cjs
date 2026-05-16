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
        count: Object.keys(services).length,
        source: 'live service probes',
        inputs: serviceStates
      },
      insightGrid: {
        type: 'metric-cards',
        count: Array.isArray(insights.cards) ? insights.cards.length : 0,
        source: 'derived from live probes and local logs',
        inputs: (insights.cards || []).map(stripSignal)
      },
      signalGrid: {
        type: 'metric-cards',
        count: 7,
        source: 'AdGuard, Homebridge, Tailscale, WAN, npm, git, and change-detector probes',
        inputs: {
          adguardBlocks: stripSignal(intelligence.adguard),
          homebridgeAccessories: stripSignal(intelligence.homebridge.accessories),
          homebridgeLogs: stripSignal(intelligence.homebridge.logHealth),
          publicFunnel: stripSignal(intelligence.tailscaleFunnel),
          wanQuality: stripSignal(intelligence.wanQuality),
          softwareUpdates: stripSignal(intelligence.softwareUpdates),
          weirdThings: Array.isArray(intelligence.weirdThings) ? intelligence.weirdThings.length : 0
        }
      },
      vitalsGrid: {
        type: 'host-metrics',
        source: 'os and df probes',
        inputs: vitalsData
      },
      dependencyMap: {
        type: 'static-topology',
        source: 'declared Teddy House architecture',
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
      admin = res.status === 200 ? 'admin API reachable' : `admin returned ${res.status}`;
    } catch (_) {
      admin = 'DNS works; admin UI not checked';
    }
    return ok(`Local DNS resolved example.com through AdGuard; ${admin}.`, `${dnsMs} ms`, 'DNS probe');
  } catch (err) {
    return bad(`Local DNS through 127.0.0.1 failed: ${err.message}.`, 'failed', 'DNS probe');
  }
}

async function checkHomebridge() {
  try {
    await tcpCheck('127.0.0.1', 8581);
    return ok('Homebridge UI port is accepting local connections.', '8581', 'TCP probe');
  } catch (err) {
    return bad(`Homebridge did not answer on 127.0.0.1:8581: ${err.message}.`, 'offline', 'TCP probe');
  }
}

async function checkTailscale() {
  try {
    const stdout = await run('tailscale', ['status', '--json']);
    const data = JSON.parse(stdout);
    const ip = (data.Self && data.Self.TailscaleIPs && data.Self.TailscaleIPs[0]) || 'connected';
    const online = data.Self && data.Self.Online !== false;
    if (!online) return warn('Tailscale is installed but this node reports offline.', ip, 'CLI status');
    return ok('Tailscale reports this Mac mini online on the tailnet.', ip, 'CLI status');
  } catch (err) {
    return warn(`Tailscale status was not available to the dashboard: ${err.message}.`, 'unknown', 'CLI status');
  }
}

async function checkTailscaleFunnel() {
  const status = await tryRun('tailscale', ['funnel', 'status']);
  if (!status.ok) {
    return info('Funnel status was not readable from the dashboard process.', 'unknown', 'tailscale funnel');
  }

  const ports = [...status.stdout.matchAll(/https:\/\/[^\s:]+(?::(\d+))?\s+\(Funnel on\)/g)]
    .map(match => match[1] || '443');
  const uniquePorts = [...new Set(ports)].sort((a, b) => Number(a) - Number(b));
  if (uniquePorts.length === 0) {
    return ok('No public Funnel routes are currently advertised.', 'off', 'tailscale funnel');
  }

  const hasHouse = uniquePorts.includes('10000');
  const extras = uniquePorts.filter(port => port !== '10000');
  if (hasHouse && extras.length === 0) {
    return ok('Public Funnel is on for Teddy House only.', '10000', 'tailscale funnel');
  }
  if (hasHouse) {
    return warn(`Teddy House Funnel is on, and ${extras.length} other public Funnel port${extras.length === 1 ? ' is' : 's are'} also on: ${extras.join(', ')}.`, uniquePorts.join(', '), 'tailscale funnel');
  }
  return warn(`Public Funnel is on, but not for the expected Teddy House port: ${uniquePorts.join(', ')}.`, uniquePorts.join(', '), 'tailscale funnel');
}

async function checkInternet() {
  const started = Date.now();
  try {
    await withTimeout(dns.resolve4('apple.com'));
    const dnsMs = Date.now() - started;
    try {
      const res = await fetchCheck('https://www.gstatic.com/generate_204');
      return ok(`System DNS works and a public HTTP probe returned ${res.status}.`, `${Math.max(dnsMs, res.ms)} ms`, 'WAN probe');
    } catch (_) {
      return warn('System DNS works, but the public HTTP probe did not complete.', `${dnsMs} ms`, 'WAN probe');
    }
  } catch (err) {
    return bad(`System internet DNS failed: ${err.message}.`, 'failed', 'WAN probe');
  }
}

async function checkWanQuality() {
  const ping = await tryRun('ping', ['-c', '4', '-W', '1000', '1.1.1.1'], 5500);
  if (!ping.ok) {
    return info('Packet-loss probe was not available from the dashboard process.', 'unknown', 'ping');
  }

  const lossMatch = ping.stdout.match(/([\d.]+)% packet loss/);
  const rttMatch = ping.stdout.match(/round-trip min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
  const loss = lossMatch ? Number(lossMatch[1]) : null;
  const avg = rttMatch ? Number(rttMatch[2]) : null;
  const max = rttMatch ? Number(rttMatch[3]) : null;
  const metric = loss === null ? 'unknown' : `${loss}% loss`;
  const detail = avg === null
    ? 'Ping completed, but latency summary was not parseable.'
    : `Cloudflare ping average ${avg.toFixed(1)} ms, max ${max.toFixed(1)} ms.`;

  if (loss !== null && loss > 0) return warn(`${detail} Packet loss is above zero.`, metric, 'packet probe');
  if (avg !== null && avg > 80) return warn(`${detail} Latency is elevated.`, `${avg.toFixed(0)} ms`, 'packet probe');
  return ok(detail, avg === null ? metric : `${avg.toFixed(0)} ms`, 'packet probe');
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
      const bindLabel = host === '127.0.0.1' ? 'loopback' : 'tailnet';
      return ok(
        pid ? `OpenClaw gateway is loaded as PID ${pid} and accepts ${bindLabel} connections on ${host}:18789.` : `OpenClaw gateway accepts ${bindLabel} connections on ${host}:18789.`,
        host,
        'launchd + TCP'
      );
    } catch (_) {}
  }

  try {
    await tcpCheck('127.0.0.1', 18789);
    return ok(
      pid ? `OpenClaw gateway is loaded as PID ${pid} and accepts local connections.` : 'OpenClaw gateway accepts local connections.',
      pid || '18789',
      'launchd + TCP'
    );
  } catch (err) {
    if (pid) {
      return bad(
        `OpenClaw gateway is loaded as PID ${pid}, but port 18789 is not accepting connections: ${err.message}.`,
        'loaded, closed',
        'launchd + TCP'
      );
    }
    if (gateway.ok) {
      return bad('OpenClaw gateway LaunchAgent is loaded but has no active PID.', 'no PID', 'launchd');
    }
    return warn('OpenClaw gateway launchd status was unavailable to the dashboard.', 'unknown', 'launchd');
  }
}

async function checkBackups() {
  return info('Time Machine is intentionally ignored for now.', 'ignored', 'Dan setting');
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
    return { name: 'Teddy House', installed: pkg.version || 'unknown', latest: null };
  } catch (_) {
    return { name: 'Teddy House', installed: 'unknown', latest: null, state: 'info', detail: 'Teddy House package version was not readable.' };
  }
}

async function gitFreshness(repoPath) {
  const status = await tryRun('git', ['-C', repoPath, 'status', '-sb']);
  if (!status.ok) return { state: 'info', detail: 'Git status was not readable.' };
  const first = status.stdout.split('\n')[0] || '';
  const ahead = first.match(/ahead\s+(\d+)/);
  const behind = first.match(/behind\s+(\d+)/);
  const dirty = status.stdout.split('\n').slice(1).filter(Boolean).length;
  if (behind) return { state: 'warn', detail: `Git branch is behind origin by ${behind[1]} commit${behind[1] === '1' ? '' : 's'}.` };
  if (ahead) return { state: 'info', detail: `Git branch has ${ahead[1]} local commit${ahead[1] === '1' ? '' : 's'} not pushed.` };
  if (dirty) return { state: 'info', detail: `Git branch has ${dirty} local change${dirty === 1 ? '' : 's'}.` };
  return { state: 'ok', detail: 'Git branch is clean locally.' };
}

async function checkSoftwareUpdates(ctx) {
  const cached = readDataSafe(ctx, 'software-updates.json', null);
  if (cached && cached.checkedAt && Date.now() - new Date(cached.checkedAt).getTime() < UPDATE_CACHE_MS) {
    return cached;
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
    label: 'available updates',
    detail: updatesAvailable > 0
      ? `${updatesAvailable} software update${updatesAvailable === 1 ? '' : 's'} available. ${gitState.detail}`
      : `OpenClaw and Teddy House package checks are current. ${gitState.detail}`,
    items,
    git: gitState
  };
  writeDataSafe(ctx, 'software-updates.json', result);
  return result;
}

async function adGuardStats() {
  try {
    const res = await fetchJson('http://127.0.0.1:3001/control/stats');
    if (res.status === 401 || res.status === 403) {
      return {
        state: 'info',
        value: 'locked',
        label: 'stats auth',
        detail: 'AdGuard DNS is working, but blocked-query stats require local AdGuard auth.',
        topBlocked: []
      };
    }
    if (res.status !== 200 || !res.json) {
      return {
        state: 'warn',
        value: `HTTP ${res.status}`,
        label: 'stats API',
        detail: 'AdGuard stats endpoint answered unexpectedly.',
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
      detail: `${queries} queries, ${blocked} blocked (${pct}%).${topBlocked.length ? ` Top blocked: ${topBlocked.map(item => item.name).join(', ')}.` : ''}`,
      topBlocked
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'stats unavailable',
      detail: `AdGuard stats were not readable: ${err.message}.`,
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
    detail: names.length > 0 ? `${names.length} plugin process${names.length === 1 ? '' : 'es'} running.` : 'Homebridge UI is up; plugin process count is zero.'
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
      detail: `${seen.size} cached Homebridge accessor${seen.size === 1 ? 'y' : 'ies'} found across ${cacheFiles.length} active cache file${cacheFiles.length === 1 ? '' : 's'}.`
    };
  } catch (err) {
    return { state: 'info', count: null, detail: `Accessory cache was not readable: ${err.message}.` };
  }
}

function newestLogTimestamp(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]/);
    if (!match) continue;
    const [, month, day, year, hourRaw, minute, second, ampm] = match;
    let hour = Number(hourRaw);
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
  }
  return null;
}

async function homebridgeLogHealth() {
  try {
    const log = await fs.readFile('/Users/teddyclaw/.homebridge/logs/homebridge.log', 'utf8');
    const lines = log.split('\n').slice(-500);
    const issueLines = lines.filter(line => /\b(error|warn|warning|failed|uncaught|exception)\b/i.test(line));
    const newest = newestLogTimestamp(lines);
    const stale = newest ? Date.now() - newest.getTime() > 24 * HOUR_MS : true;
    if (stale) {
      return {
        state: 'info',
        value: 'stale',
        label: 'log freshness',
        detail: newest ? `Homebridge log has no fresh entries; newest visible line is ${formatAgeFromDate(newest)}.` : 'Homebridge log has no parseable timestamp.'
      };
    }
    if (issueLines.length > 20) {
      return {
        state: 'warn',
        value: `${issueLines.length}`,
        label: 'recent issues',
        detail: `Homebridge log has ${issueLines.length} warning/error-style lines in the recent tail.`
      };
    }
    return {
      state: 'ok',
      value: `${issueLines.length}`,
      label: 'recent issues',
      detail: `Homebridge log tail is quiet: ${issueLines.length} warning/error-style lines.`
    };
  } catch (err) {
    return {
      state: 'info',
      value: '--',
      label: 'log unavailable',
      detail: `Homebridge log was not readable: ${err.message}.`
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
    if (!ready) return { age: 'unknown', detail: 'No recent ready marker found.' };
    const stamp = ready.slice(0, 29);
    return { age: formatAgeFromDate(new Date(stamp)), detail: `Last ready marker: ${ready.slice(0, 19).replace('T', ' ')}.` };
  } catch (_) {
    return { age: 'unknown', detail: 'OpenClaw gateway log was not readable.' };
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
    ? `${blockers} core check${blockers === 1 ? '' : 's'} failed. Start there.`
    : watches > 0
      ? `${watches} check${watches === 1 ? '' : 's'} on watch. The house is mostly usable.`
      : parked > 0
        ? 'All active systems are clean. Time Machine is parked by choice.'
        : 'All active systems are clean.';

  return {
    teddySays,
    cards: [
      {
        title: 'AdGuard',
        value: services.adguard.metric || '--',
        label: 'DNS response',
        state: services.adguard.state,
        detail: services.adguard.detail
      },
      {
        title: 'Homebridge',
        value: intelligence.homebridge.accessories.count === null ? '--' : `${intelligence.homebridge.accessories.count}`,
        label: 'accessories',
        state: services.homebridge.state,
        detail: `${intelligence.homebridge.accessories.detail} ${plugins.names.length ? `Plugin processes: ${plugins.count}. First: ${plugins.names.join(', ')}.` : plugins.detail}`
      },
      {
        title: 'OpenClaw',
        value: openclawReady.age,
        label: 'last ready',
        state: services.openclaw.state,
        detail: openclawReady.detail
      },
      {
        title: 'WAN',
        value: intelligence.wanQuality.metric || '--',
        label: intelligence.wanQuality.check || 'packet probe',
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
    return [{ state: 'info', title: 'Baseline captured', detail: 'Teddy has a starting point for change detection.' }];
  }

  const items = [];
  for (const [key, state] of Object.entries(current.services)) {
    if (previous.services && previous.services[key] && previous.services[key] !== state) {
      items.push({ state: state === 'bad' ? 'bad' : 'warn', title: `${key} changed`, detail: `${previous.services[key]} -> ${state}` });
    }
  }

  if (previous.funnelMetric !== current.funnelMetric) {
    items.push({ state: 'warn', title: 'Funnel changed', detail: `${previous.funnelMetric || 'none'} -> ${current.funnelMetric || 'none'}` });
  }
  if (previous.accessoryCount !== current.accessoryCount && previous.accessoryCount !== null && current.accessoryCount !== null) {
    items.push({ state: 'warn', title: 'Accessory count changed', detail: `${previous.accessoryCount} -> ${current.accessoryCount}` });
  }
  if (current.wanState === 'warn' || current.wanState === 'bad') {
    items.push({ state: current.wanState, title: 'WAN quality', detail: 'Packet-loss or latency probe needs attention.' });
  }
  if (current.softwareUpdateState === 'warn' && previous.softwareUpdateValue !== current.softwareUpdateValue) {
    items.push({ state: 'warn', title: 'Software update', detail: `${current.softwareUpdateValue} update signal changed.` });
  }

  if (items.length === 0) {
    return [{ state: 'ok', title: 'No new weird thing', detail: 'No state, Funnel, accessory, or WAN quality drift since the last check.' }];
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
  const meaningful = weirdThings.filter(item => item.title !== 'No new weird thing');
  const additions = meaningful.length
    ? meaningful.map(eventFromWeird)
    : shouldHeartbeat
      ? [eventFromWeird({ state: 'ok', title: 'House check', detail: `Score ${score}; no new weird thing.` })]
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
        adguard: 'AdGuard DNS',
        homebridge: 'Homebridge',
        tailscale: 'Tailscale',
        internet: 'Internet',
        openclaw: 'OpenClaw/Teddy',
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
    detail: service.state === 'ok' ? 'passed' : service.detail
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
          vitals: systemVitals,
          events: timeline.length ? timeline : eventsFromServices(services),
          timeline
        };
      }
    }
  };
};

const dns = require('dns').promises;
const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const { execFile } = require('child_process');

const TIMEOUT_MS = 2200;

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

function run(command, args) {
  return withTimeout(new Promise((resolve, reject) => {
    execFile(command, args, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve(stdout);
    });
  }));
}

async function tryRun(command, args) {
  try {
    return { ok: true, stdout: await run(command, args), stderr: '' };
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

async function buildInsights(services, systemVitals) {
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
        value: plugins.count === null ? '--' : `${plugins.count}`,
        label: 'plugin processes',
        state: services.homebridge.state,
        detail: plugins.names.length ? `${plugins.detail} First: ${plugins.names.join(', ')}.` : plugins.detail
      },
      {
        title: 'OpenClaw',
        value: openclawReady.age,
        label: 'last ready',
        state: services.openclaw.state,
        detail: openclawReady.detail
      },
      {
        title: 'Mac mini',
        value: systemVitals.disk || '--',
        label: 'disk used',
        state: 'ok',
        detail: `Memory ${systemVitals.memory || '--'}, CPU load ${systemVitals.cpu || '--'}, uptime ${systemVitals.uptime || '--'}.`
      }
    ]
  };
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

module.exports = function() {
  return {
    routes: {
      'GET /health': async () => {
        const [adguard, homebridge, tailscale, internet, openclaw, backups, systemVitals] = await Promise.all([
          checkAdGuard(),
          checkHomebridge(),
          checkTailscale(),
          checkInternet(),
          checkOpenClaw(),
          checkBackups(),
          vitals()
        ]);

        const services = { adguard, homebridge, tailscale, internet, openclaw, backups };
        const insights = await buildInsights(services, systemVitals);
        return {
          checkedAt: nowIso(),
          score: scoreServices(services),
          needsDan: needsDan(services),
          services,
          insights,
          vitals: systemVitals,
          events: eventsFromServices(services)
        };
      }
    }
  };
};

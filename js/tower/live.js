/**
 * Lobster Tower: live states.
 *
 * Turns each widget's real data (the same endpoints the dashboard widgets use) into a tower state:
 *   working  the service is doing something now     → its own station
 *   idle     nothing to do right now                 → cafeteria (the engine turns a long idle into sleep)
 *   gym      background housekeeping                 → gym
 *   alert    unreachable, failing or over a limit    → basement (or panics in place)
 *
 * An adapter gets the widget ({ id, type, properties }) and resolves to { state, read }, where `read`
 * is the one-line summary shown on the room's card. Widgets without an adapter simply stay at work.
 * Agent Wall panels use the same idea with panel states: idle · working · near · limited · error.
 */
(function (root) {
'use strict';

const getJson = (url) => fetch(url, { credentials: 'same-origin' }).then(r => {
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
});

// /api/stats is shared by several system widgets: fetch it at most once every 10 s
let statsCache = null, statsAt = 0;
function stats() {
  if (statsCache && Date.now() - statsAt < 10000) return statsCache;
  statsAt = Date.now();
  statsCache = getJson('/api/stats').catch(e => { statsCache = null; throw e; });
  return statsCache;
}

const pct = n => Math.round(n) + '%';
const mbps = bps => (bps * 8 / 1e6).toFixed(1) + ' Mb/s';
const hasError = health => (health || []).some(h => h.level === 'error');
const hasWarning = health => (health || []).some(h => h.level === 'warning' || h.level === 'error');
const SETUP = /^(not_saved|no_url|no_key|bad_url)$/;

function media(service, rule) {
  return w => getJson('/api/media/' + service + '?widgetId=' + encodeURIComponent(w.id)).then(d => {
    if (!d || !d.ok) {
      if (d && SETUP.test(d.code)) return { state: 'idle', read: 'Not set up yet' };
      return { state: 'alert', read: (d && d.error) || 'Not responding' };
    }
    if (hasError(d.health)) return { state: 'alert', read: d.health[0].message };
    return rule(d.stats || {}, d);
  });
}

const ADAPTERS = {
  // media server
  'media-plex': media('plex', s => ({ state: s.streams > 0 ? 'working' : 'idle',
    read: `${s.streams || 0} streaming${s.transcoding ? ` · ${s.transcoding} transcoding` : ''} · ${s.movies || 0} movies · ${s.shows || 0} shows` })),
  'media-radarr': media('radarr', s => ({ state: s.queue > 0 ? 'working' : 'idle',
    read: `${s.onDisk || 0}/${s.movies || 0} movies on disk · ${s.queue || 0} queued · ${s.missing || 0} missing` })),
  'media-sonarr': media('sonarr', s => ({ state: s.queue > 0 ? 'working' : 'idle',
    read: `${s.episodesOnDisk || 0}/${s.episodes || 0} episodes · ${s.queue || 0} queued · ${s.missing || 0} missing` })),
  'media-seerr': media('seerr', s => ({ state: (s.pending || 0) + (s.processing || 0) > 0 ? 'working' : 'idle',
    read: `${s.pending || 0} pending · ${s.processing || 0} processing · ${s.available || 0} available` })),
  'media-prowlarr': media('prowlarr', (s, d) => {
    if (s.indexers > 0 && s.enabled === 0) return { state: 'alert', read: 'No indexers enabled' };
    return { state: hasWarning(d.health) ? 'gym' : 'working', read: `${s.enabled || 0}/${s.indexers || 0} indexers · ${s.grabs ?? '?'} grabs` };
  }),
  'media-sabnzbd': media('sabnzbd', s => ({ state: s.speedBps > 0 ? 'working' : s.queue > 0 && /verif|repair|extract|unpack/i.test(s.status) ? 'gym' : 'idle',
    read: `${(s.speedBps / 1048576).toFixed(1)} MB/s · ${s.queue || 0} in queue${s.timeLeft && s.queue ? ` · ${s.timeLeft} left` : ''}` })),

  // system (this server; remote servers show as working)
  'cpu-memory': w => remote(w) || stats().then(s => {
    const cpu = s.cpu ? s.cpu.currentLoad : 0, mem = s.memory ? s.memory.active / s.memory.total * 100 : 0;
    return { state: cpu >= 95 ? 'alert' : cpu > 8 ? 'working' : 'idle', read: `CPU ${pct(cpu)} · RAM ${pct(mem)}` };
  }),
  'disk-usage': w => remote(w) || stats().then(s => {
    const worst = Math.max(0, ...(s.disk || []).map(d => d.use || 0));
    return { state: worst >= 90 ? 'alert' : 'working', read: `fullest disk ${pct(worst)}` };
  }),
  'network-speed': w => remote(w) || stats().then(s => {
    const rx = (s.network || []).reduce((n, i) => n + (i.rx_sec || 0), 0), tx = (s.network || []).reduce((n, i) => n + (i.tx_sec || 0), 0);
    return { state: rx + tx > 50000 ? 'working' : 'idle', read: `↓ ${mbps(rx)} · ↑ ${mbps(tx)}` };
  }),
  'docker-containers': w => remote(w) || stats().then(s => {
    const list = s.docker || [], running = list.filter(c => c.state === 'running').length;
    const bad = list.filter(c => /unhealthy|restarting|dead/i.test(c.status || c.state || '')).length;
    return { state: bad ? 'alert' : running ? 'working' : 'idle', read: `${running} running · ${list.length - running} stopped${bad ? ` · ${bad} unhealthy` : ''}` };
  }),
  'uptime-monitor': w => remote(w) || stats().then(s => {
    const d = Math.floor((s.uptime || 0) / 86400), h = Math.floor((s.uptime || 0) % 86400 / 3600);
    return { state: 'working', read: `up ${d}d ${h}h`, text: `UP ${d}d` };
  }),

  // OpenClaw: reachable means working
  'auth-status': w => getJson('/api/auth').then(d => ({ state: d.mode === 'Monthly' ? 'working' : 'idle', read: d.mode === 'Monthly' ? 'Max subscription' : 'API key fallback' })),
  'cron-jobs': w => getJson('/api/cron').then(d => { const jobs = d.jobs || d || []; return { state: 'working', read: `${jobs.length || 0} jobs` }; }),
  'system-log': w => getJson('/api/system-log').then(d => { const lines = d.lines || d.logs || d || []; const err = (Array.isArray(lines) ? lines : []).slice(-20).some(l => /error/i.test(JSON.stringify(l))); return { state: err ? 'alert' : 'working', read: err ? 'Errors in the log' : 'Log is quiet' }; }),
  'activity-list': w => getJson('/api/activity').then(d => { const items = d.items || d.activity || d || []; return { state: (items.length || 0) ? 'working' : 'idle', read: `${items.length || 0} recent events` }; }),

  // productivity
  'todo-list': w => getJson('/api/todos').then(d => { const list = d.todos || d || []; const open = list.filter(t => !t.done && !t.completed).length; return { state: open ? 'working' : 'idle', read: `${open} open tasks` }; }),
  'pomodoro': w => { const min = new Date().getMinutes() % 30; return Promise.resolve(min < 25 ? { state: 'working', read: `Focus · ${25 - min} min left` } : { state: 'idle', read: `Break · ${30 - min} min left` }); },
  'rss-ticker': w => getJson('/api/rss?url=' + encodeURIComponent((w.properties || {}).feedUrl || '') + '&widgetId=' + encodeURIComponent(w.id))
    .then(d => { const items = d.items || []; return { state: items.length ? 'working' : 'idle', read: items[0] ? items[0].title : 'No headlines' }; }),

  // releases: an update waiting makes Mr. Claws panic (in place)
  'lobsterboard-release': w => getJson('/api/lb-release').then(d => {
    const clean = v => String(v || '').replace(/^v/, '');
    const behind = d.latest && clean(d.latest) !== clean(d.current);
    return { state: behind ? 'alert' : 'working', read: behind ? `v${clean(d.current)} · v${clean(d.latest)} available` : `v${clean(d.current)} · up to date` };
  }),
};

function remote(w) {
  const server = (w.properties || {}).server;
  return server && server !== 'local' ? Promise.resolve({ state: 'working', read: 'Remote server · ' + server }) : null;
}

/* Agent Wall panels: AI usage widgets → panel state from their usage metrics */
const AI_PROVIDER = { 'claude-code': 'claude', 'codex-cli': 'codex', 'github-copilot': 'copilot', 'cursor': 'cursor', 'gemini-cli': 'gemini',
  'amp-code': 'amp', 'factory': 'factory', 'kimi-code': 'kimi', 'jetbrains-ai': 'jetbrains', 'minimax': 'minimax', 'zai': 'zai', 'antigravity-local': 'antigravity' };
function panel(w) {
  const provider = AI_PROVIDER[w.type];
  if (!provider) return Promise.resolve({ state: 'working', read: 'On the dashboard', s: 50, wk: 30 });
  return getJson('/api/ai-usage/' + provider).then(d => {
    const metrics = (d && d.metrics) || [];
    if (d && d.error && !metrics.length) return { state: 'error', read: d.error, s: 0, wk: 0 };
    const use = m => m && m.limit ? m.used / m.limit * 100 : 0;
    const session = use(metrics[0]), week = use(metrics.find(m => /week/i.test(m.label)) || metrics[1]);
    const top = Math.max(session, week);
    return { state: top >= 100 ? 'limited' : top >= 80 ? 'near' : session > 0 ? 'working' : 'idle',
             read: metrics.slice(0, 2).map(m => `${m.label} ${pct(use(m))}`).join(' · ') || 'No usage yet', s: Math.min(100, session), wk: Math.min(100, week) };
  }).catch(e => ({ state: 'error', read: e.message, s: 0, wk: 0 }));
}

/* Poll every avatar and panel. onAvatar(avatar, result) and onPanel(panel, result) apply the results. */
function start(model, { onAvatar, onPanel, intervalMs = 30000 }) {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    for (const a of model.avatars) {
      const fn = ADAPTERS[a.type];
      if (!fn) { onAvatar(a, { state: 'working', read: 'On the dashboard' }); continue; }
      Promise.resolve().then(() => fn(a.widget)).then(r => !stopped && onAvatar(a, r))
        .catch(e => !stopped && onAvatar(a, { state: 'alert', read: 'Not responding (' + e.message + ')' }));
    }
    for (const p of model.panels) panel(p.w).then(r => !stopped && onPanel(p, r));
    for (const p of model.pieces) {
      const fn = ADAPTERS[p.w.type];
      if (fn) Promise.resolve().then(() => fn(p.w)).then(r => { if (!stopped) p.live = r; }).catch(() => {});
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => { stopped = true; clearInterval(timer); };
}

/* Real weather for the sky, from the weather widget's location (same Open-Meteo calls as the widget). */
function wmoKind(code) {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}
async function weather(w) {
  const p = w.properties || {}, units = p.units === 'C' ? 'celsius' : 'fahrenheit';
  const geo = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(p.location || 'New York') + '&count=1').then(r => r.json());
  const place = geo.results && geo.results[0];
  if (!place) throw new Error('Location not found');
  const d = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude +
    '&current=temperature_2m,weathercode&temperature_unit=' + units).then(r => r.json());
  return { kind: wmoKind(d.current.weathercode), temp: Math.round(d.current.temperature_2m), unit: units === 'celsius' ? 'C' : 'F', place: place.name };
}

root.TowerLive = { start, ADAPTERS, panel, weather, wmoKind };
if (typeof module !== 'undefined' && module.exports) module.exports = root.TowerLive;
})(typeof window !== 'undefined' ? window : globalThis);

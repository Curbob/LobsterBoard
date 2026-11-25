/**
 * Media server widgets: Radarr, Sonarr, Seerr, Plex, Prowlarr, SABnzbd.
 *
 * GET /api/media/:service?widgetId=ID
 *   Looks up the saved widget by id, takes its Service URL from the config and
 *   its API key from secrets.json, calls a fixed set of read-only endpoints on
 *   that service and returns a small summary. The browser never sees the key.
 *
 * GET /api/media/plex/image?widgetId=ID&path=/library/metadata/123/thumb/456
 *   Proxies a Plex poster (Plex images need the token). Only library metadata
 *   thumb/art paths are accepted.
 *
 * These services normally live on the local network, so unlike the RSS/iCal
 * proxy this route does allow private addresses. It only ever talks to the URL
 * saved in a widget of the matching type, and only on the endpoints below.
 *
 * API usage informed by Media Server Dashboard Extended
 * (https://github.com/freelancer381/media-server-dashboard-extended, MIT).
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { sendJson, sendResponse } = require('../response.cjs');
const { CONFIG_FILE } = require('../config.cjs');
const { getSecrets } = require('../secrets.cjs');

const SERVICES = {
  radarr: { type: 'media-radarr', name: 'Radarr' },
  sonarr: { type: 'media-sonarr', name: 'Sonarr' },
  seerr: { type: 'media-seerr', name: 'Seerr' },
  plex: { type: 'media-plex', name: 'Plex' },
  prowlarr: { type: 'media-prowlarr', name: 'Prowlarr' },
  sabnzbd: { type: 'media-sabnzbd', name: 'SABnzbd' },
};

const TIMEOUT_MS = 10000;
const MAX_JSON_BYTES = 150 * 1024 * 1024; // a large Radarr/Sonarr library list
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FAST = 10 * 1000;       // queues, sessions, speed
const MEDIUM = 60 * 1000;     // health, counts, calendar, history
const SLOW = 5 * 60 * 1000;   // full library lists, indexer stats
const DAY = 24 * 60 * 60 * 1000;

class MediaError extends Error {
  constructor(message, code) { super(message); this.code = code || 'error'; }
}

// ── Widget lookup ──

function findWidget(widgetId, service) {
  const svc = SERVICES[service];
  if (!widgetId) throw new MediaError('Missing widgetId', 'bad_request');
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (_) { throw new MediaError('Save the layout to connect', 'not_saved'); }
  const w = (cfg.widgets || []).find(x => x && x.id === widgetId);
  if (!w) throw new MediaError('Save the layout to connect', 'not_saved');
  if (w.type !== svc.type) throw new MediaError('Widget is not a ' + svc.name + ' widget', 'bad_request');

  const props = w.properties || {};
  const rawUrl = String(props.serviceUrl || '').trim();
  if (!rawUrl) throw new MediaError('Set the Service URL in the widget settings', 'no_url');
  let base;
  try { base = new URL(rawUrl); } catch (_) { throw new MediaError('Service URL is not a valid URL', 'bad_url'); }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new MediaError('Service URL must start with http:// or https://', 'bad_url');
  }
  base.search = '';
  base.hash = '';

  let apiKey = props.apiKey;
  if (!apiKey || apiKey === '__SECRET__' || apiKey === '••••••••') {
    apiKey = (getSecrets()[w.id] || {}).apiKey || '';
  }
  apiKey = String(apiKey || '').trim();
  if (!apiKey) throw new MediaError('Add the API key in the widget settings', 'no_key');

  return { id: w.id, base, apiKey, name: svc.name };
}

// ── HTTP ──

function hostLabel(base) {
  return base.hostname + (base.port ? ':' + base.port : '');
}

/** Build a URL under the service's base path (keeps reverse-proxy sub-paths like /radarr). */
function serviceUrl(base, path, query) {
  const u = new URL(base.href);
  u.pathname = u.pathname.replace(/\/+$/, '') + path;
  if (query) for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  return u;
}

function request(conn, url, headers, maxBytes, binary) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'LobsterBoard', ...headers }, timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        return reject(new MediaError(conn.name + ' rejected the API key', 'auth'));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new MediaError(conn.name + ' returned HTTP ' + res.statusCode + ' (is the URL right?)', 'http'));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) { req.destroy(); reject(new MediaError(conn.name + ' response was too large', 'too_large')); return; }
        chunks.push(c);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (binary) return resolve({ body: buf, type: res.headers['content-type'] || '' });
        try { resolve(JSON.parse(buf.toString('utf8'))); }
        catch (_) { reject(new MediaError('Unexpected response from ' + conn.name + ' (is the URL right?)', 'bad_response')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new MediaError(conn.name + ' did not answer in time', 'timeout')); });
    req.on('error', (e) => {
      if (e instanceof MediaError) return reject(e);
      const why = e.code === 'ECONNREFUSED' ? 'connection refused'
        : e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? 'host not found'
        : e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH' ? 'host unreachable'
        : /certificate|SSL|TLS/i.test(e.message || '') ? 'TLS certificate problem'
        : (e.code || 'network error');
      // Never echo the full URL: it can carry the API key (SABnzbd) or user:pass.
      reject(new MediaError("Can't reach " + conn.name + ' at ' + hostLabel(conn.base) + ' (' + why + ')', 'unreachable'));
    });
  });
}

// ── Cache (also de-duplicates concurrent requests) ──

const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

function cached(conn, key, ttl, fn) {
  const fp = crypto.createHash('sha256').update(conn.base.href + '\n' + conn.apiKey).digest('hex').slice(0, 16);
  const k = conn.id + '|' + fp + '|' + key;
  const hit = cache.get(k);
  const now = Date.now();
  if (hit && now - hit.at < ttl) return hit.promise;
  const promise = Promise.resolve().then(fn);
  cache.set(k, { at: now, promise });
  promise.catch(() => { if (cache.get(k) && cache.get(k).promise === promise) cache.delete(k); });
  if (cache.size > MAX_CACHE_ENTRIES) {
    for (const [ck, v] of cache) { if (now - v.at > DAY) cache.delete(ck); }
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }
  return promise;
}

function settle(p) { return p.then(v => v, () => null); }

// ── Helpers ──

function httpsImage(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url) ? url : null;
}

function arrPoster(item) {
  const img = ((item && item.images) || []).find(i => i.coverType === 'poster');
  return img ? httpsImage(img.remoteUrl) : null;
}

function arrHealth(list) {
  return (Array.isArray(list) ? list : [])
    .filter(h => h && (h.type === 'warning' || h.type === 'error'))
    .slice(0, 5)
    .map(h => ({ level: h.type, message: String(h.message || '').slice(0, 200) }));
}

function episodeCode(e) {
  const s = String(e.seasonNumber ?? 0).padStart(2, '0');
  const n = String(e.episodeNumber ?? 0).padStart(2, '0');
  return 'S' + s + 'E' + n;
}

function isoDay(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }

function uniqueRootFree(roots) {
  const seen = new Set();
  let free = 0;
  for (const r of Array.isArray(roots) ? roots : []) {
    if (!r || seen.has(r.path)) continue;
    seen.add(r.path);
    free += Number(r.freeSpace) || 0;
  }
  return free;
}

// ── Radarr / Sonarr ──

function arrGet(conn, path, query, ttl) {
  return cached(conn, path + '?' + JSON.stringify(query || {}), ttl, () =>
    request(conn, serviceUrl(conn.base, '/api/v3/' + path, query), { 'X-Api-Key': conn.apiKey, Accept: 'application/json' }, MAX_JSON_BYTES));
}

async function radarr(conn) {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * DAY);
  const [status, health, movies, missing, queue, roots, calendar, history] = await Promise.all([
    arrGet(conn, 'system/status', null, SLOW),
    settle(arrGet(conn, 'health', null, MEDIUM)),
    arrGet(conn, 'movie', null, SLOW),
    settle(arrGet(conn, 'wanted/missing', { pageSize: 1 }, MEDIUM)),
    settle(arrGet(conn, 'queue', { pageSize: 1 }, FAST)),
    settle(arrGet(conn, 'rootfolder', null, MEDIUM)),
    settle(arrGet(conn, 'calendar', { start: isoDay(now), end: isoDay(end) }, MEDIUM)),
    settle(arrGet(conn, 'history', { pageSize: 20, sortKey: 'date', sortDirection: 'descending', eventType: 3, includeMovie: true }, MEDIUM)),
  ]);
  const list = Array.isArray(movies) ? movies : [];
  const nowIso = now.toISOString();

  const upcoming = (Array.isArray(calendar) ? calendar : [])
    .filter(m => !m.hasFile)
    .map(m => {
      const when = [m.digitalRelease, m.physicalRelease, m.inCinemas].filter(d => d && d >= nowIso).sort()[0];
      return when ? { title: m.title, year: m.year, date: when, poster: arrPoster(m) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const seen = new Set();
  const recent = [];
  for (const h of (history && history.records) || []) {
    const m = h.movie || list.find(x => x.id === h.movieId) || {};
    const key = h.movieId || m.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recent.push({ title: m.title || h.sourceTitle, year: m.year, date: h.date, poster: arrPoster(m),
      quality: ((h.quality || {}).quality || {}).name || null });
    if (recent.length === 8) break;
  }

  return {
    version: status && status.version,
    health: arrHealth(health),
    stats: {
      movies: list.length,
      onDisk: list.filter(m => m.hasFile).length,
      monitored: list.filter(m => m.monitored).length,
      missing: missing && typeof missing.totalRecords === 'number' ? missing.totalRecords
        : list.filter(m => m.monitored && !m.hasFile && m.isAvailable).length,
      queue: queue && typeof queue.totalRecords === 'number' ? queue.totalRecords : null,
      sizeOnDisk: list.reduce((s, m) => s + (Number(m.sizeOnDisk) || 0), 0),
      freeSpace: roots ? uniqueRootFree(roots) : null,
    },
    upcoming,
    recent,
  };
}

async function sonarr(conn) {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * DAY);
  const [status, health, series, missing, queue, roots, calendar, history] = await Promise.all([
    arrGet(conn, 'system/status', null, SLOW),
    settle(arrGet(conn, 'health', null, MEDIUM)),
    arrGet(conn, 'series', null, SLOW),
    settle(arrGet(conn, 'wanted/missing', { pageSize: 1 }, MEDIUM)),
    settle(arrGet(conn, 'queue', { pageSize: 1 }, FAST)),
    settle(arrGet(conn, 'rootfolder', null, MEDIUM)),
    settle(arrGet(conn, 'calendar', { start: isoDay(now), end: isoDay(end), includeSeries: true }, MEDIUM)),
    settle(arrGet(conn, 'history', { pageSize: 20, sortKey: 'date', sortDirection: 'descending', eventType: 3, includeSeries: true, includeEpisode: true }, MEDIUM)),
  ]);
  const list = Array.isArray(series) ? series : [];
  const stat = (s, k) => Number((s.statistics || {})[k]) || 0;
  const byId = new Map(list.map(s => [s.id, s]));

  const upcoming = (Array.isArray(calendar) ? calendar : [])
    .filter(e => !e.hasFile && e.airDateUtc && e.airDateUtc >= now.toISOString())
    .sort((a, b) => a.airDateUtc.localeCompare(b.airDateUtc))
    .slice(0, 6)
    .map(e => {
      const s = e.series || byId.get(e.seriesId) || {};
      return { title: s.title || '', episode: episodeCode(e), name: e.title || '', date: e.airDateUtc, poster: arrPoster(s) };
    });

  const recent = [];
  for (const h of (history && history.records) || []) {
    const s = h.series || byId.get(h.seriesId) || {};
    const e = h.episode || {};
    recent.push({ title: s.title || h.sourceTitle, episode: h.episode ? episodeCode(e) : '', name: e.title || '',
      date: h.date, poster: arrPoster(s), quality: ((h.quality || {}).quality || {}).name || null });
    if (recent.length === 8) break;
  }

  return {
    version: status && status.version,
    health: arrHealth(health),
    stats: {
      series: list.length,
      episodes: list.reduce((n, s) => n + stat(s, 'episodeCount'), 0),
      episodesOnDisk: list.reduce((n, s) => n + stat(s, 'episodeFileCount'), 0),
      missing: missing && typeof missing.totalRecords === 'number' ? missing.totalRecords : null,
      queue: queue && typeof queue.totalRecords === 'number' ? queue.totalRecords : null,
      sizeOnDisk: list.reduce((n, s) => n + stat(s, 'sizeOnDisk'), 0),
      freeSpace: roots ? uniqueRootFree(roots) : null,
    },
    upcoming,
    recent,
  };
}

// ── Prowlarr ──

function prowlarrGet(conn, path, query, ttl) {
  return cached(conn, path + '?' + JSON.stringify(query || {}), ttl, () =>
    request(conn, serviceUrl(conn.base, '/api/v1/' + path, query), { 'X-Api-Key': conn.apiKey, Accept: 'application/json' }, MAX_JSON_BYTES));
}

async function prowlarr(conn) {
  const [status, health, indexers, stats] = await Promise.all([
    prowlarrGet(conn, 'system/status', null, SLOW),
    settle(prowlarrGet(conn, 'health', null, MEDIUM)),
    prowlarrGet(conn, 'indexer', null, MEDIUM),
    settle(prowlarrGet(conn, 'indexerstats', null, SLOW)),
  ]);
  const list = Array.isArray(indexers) ? indexers : [];
  const per = ((stats && stats.indexers) || []).map(i => ({
    name: i.indexerName || ('#' + i.indexerId),
    queries: Number(i.numberOfQueries) || 0,
    grabs: Number(i.numberOfGrabs) || 0,
    failedQueries: Number(i.numberOfFailedQueries) || 0,
    failedGrabs: Number(i.numberOfFailedGrabs) || 0,
    avgResponseMs: Math.round(Number(i.averageResponseTime) || 0),
  })).sort((a, b) => b.queries - a.queries || b.grabs - a.grabs);
  const sum = k => per.reduce((n, i) => n + i[k], 0);
  return {
    version: status && status.version,
    health: arrHealth(health),
    stats: {
      indexers: list.length,
      enabled: list.filter(i => i.enable).length,
      queries: stats ? sum('queries') : null,
      grabs: stats ? sum('grabs') : null,
      failedQueries: stats ? sum('failedQueries') : null,
      failedGrabs: stats ? sum('failedGrabs') : null,
    },
    indexers: per.slice(0, 10),
  };
}

// ── SABnzbd ──

function sabGet(conn, mode, extra, ttl) {
  return cached(conn, 'sab:' + mode + JSON.stringify(extra || {}), ttl, () => {
    const query = { mode, output: 'json', apikey: conn.apiKey, ...(extra || {}) };
    return request(conn, serviceUrl(conn.base, '/api', query), { Accept: 'application/json' }, 5 * 1024 * 1024)
      .then((data) => {
        if (data && data.status === false && data.error) {
          throw new MediaError(/api key/i.test(data.error) ? 'SABnzbd rejected the API key' : 'SABnzbd: ' + String(data.error).slice(0, 120), 'auth');
        }
        return data;
      });
  });
}

async function sabnzbd(conn) {
  const [queueRes, version, serverStats, failed] = await Promise.all([
    sabGet(conn, 'queue', { limit: 5 }, FAST),
    settle(sabGet(conn, 'version', null, SLOW)),
    settle(sabGet(conn, 'server_stats', null, MEDIUM)),
    settle(sabGet(conn, 'history', { limit: 1, failed_only: 1 }, MEDIUM)),
  ]);
  const q = (queueRes && queueRes.queue) || {};
  const mb = v => Number.parseFloat(v) || 0;
  return {
    version: version && version.version,
    health: [],
    stats: {
      status: q.status || (q.paused ? 'Paused' : 'Idle'),
      paused: !!q.paused,
      speedBps: Math.round((Number.parseFloat(q.kbpersec) || 0) * 1024),
      queue: Number(q.noofslots_total ?? q.noofslots) || 0,
      leftBytes: Math.round(mb(q.mbleft) * 1024 * 1024),
      totalBytes: Math.round(mb(q.mb) * 1024 * 1024),
      timeLeft: q.timeleft || null,
      today: serverStats ? Number(serverStats.day) || 0 : null,
      week: serverStats ? Number(serverStats.week) || 0 : null,
      month: serverStats ? Number(serverStats.month) || 0 : null,
      total: serverStats ? Number(serverStats.total) || 0 : null,
      failed: failed && failed.history ? Number(failed.history.noofslots) || 0 : null,
    },
    items: (q.slots || []).slice(0, 5).map(s => ({
      name: String(s.filename || '').slice(0, 200),
      percent: Number(s.percentage) || 0,
      sizeBytes: Math.round(mb(s.mb) * 1024 * 1024),
      timeLeft: s.timeleft || null,
      status: s.status || null,
    })),
  };
}

// ── Seerr (Overseerr / Jellyseerr / Seerr) ──

function seerrGet(conn, path, query, ttl) {
  return cached(conn, path + '?' + JSON.stringify(query || {}), ttl, () =>
    request(conn, serviceUrl(conn.base, '/api/v1/' + path, query), { 'X-Api-Key': conn.apiKey, Accept: 'application/json' }, 10 * 1024 * 1024));
}

const SEERR_REQUEST_STATUS = { 1: 'pending', 2: 'approved', 3: 'declined', 4: 'failed', 5: 'completed' };
const SEERR_MEDIA_STATUS = { 1: 'unknown', 2: 'pending', 3: 'processing', 4: 'partial', 5: 'available', 6: 'deleted' };

async function seerr(conn) {
  const [status, counts, issues, requests] = await Promise.all([
    settle(seerrGet(conn, 'status', null, SLOW)),
    seerrGet(conn, 'request/count', null, MEDIUM),
    settle(seerrGet(conn, 'issue/count', null, MEDIUM)),
    settle(seerrGet(conn, 'request', { take: 6, skip: 0, sort: 'added', filter: 'all' }, MEDIUM)),
  ]);
  const recent = await Promise.all(((requests && requests.results) || []).slice(0, 6).map(async (r) => {
    const media = r.media || {};
    const kind = r.type || media.mediaType;
    let title = null, poster = null, year = null;
    if (media.tmdbId && (kind === 'movie' || kind === 'tv')) {
      const d = await settle(seerrGet(conn, kind + '/' + Number(media.tmdbId), null, DAY));
      if (d) {
        title = d.title || d.name || null;
        year = String(d.releaseDate || d.firstAirDate || '').slice(0, 4) || null;
        poster = d.posterPath ? 'https://image.tmdb.org/t/p/w185' + String(d.posterPath).replace(/[^\w./-]/g, '') : null;
      }
    }
    return {
      title: title || (kind === 'tv' ? 'TV show' : 'Movie') + (media.tmdbId ? ' #' + media.tmdbId : ''),
      year, kind, poster,
      requestedBy: ((r.requestedBy || {}).displayName || '').slice(0, 60) || null,
      status: SEERR_REQUEST_STATUS[r.status] || 'unknown',
      mediaStatus: SEERR_MEDIA_STATUS[media.status] || 'unknown',
      date: r.createdAt || null,
    };
  }));
  const c = counts || {};
  return {
    version: status && status.version,
    health: status && status.updateAvailable ? [{ level: 'info', message: 'Update available' }] : [],
    stats: {
      total: Number(c.total) || 0,
      movie: Number(c.movie) || 0,
      tv: Number(c.tv) || 0,
      pending: Number(c.pending) || 0,
      approved: Number(c.approved) || 0,
      processing: Number(c.processing) || 0,
      available: Number(c.available) || 0,
      declined: Number(c.declined) || 0,
      openIssues: issues ? Number(issues.open) || 0 : null,
    },
    recent,
  };
}

// ── Plex ──

const PLEX_IMAGE_PATH = /^\/library\/metadata\/\d+\/(thumb|art)(\/\d+)?$/;

function plexGet(conn, path, query, ttl) {
  return cached(conn, path + '?' + JSON.stringify(query || {}), ttl, () =>
    request(conn, serviceUrl(conn.base, path, query), { 'X-Plex-Token': conn.apiKey, Accept: 'application/json' }, 20 * 1024 * 1024)
      .then(d => (d && d.MediaContainer) || {}));
}

function plexImage(conn, path) {
  return typeof path === 'string' && PLEX_IMAGE_PATH.test(path)
    ? '/api/media/plex/image?widgetId=' + encodeURIComponent(conn.id) + '&path=' + encodeURIComponent(path)
    : null;
}

async function plex(conn) {
  const [identity, sessions, sections, recentlyAdded] = await Promise.all([
    settle(plexGet(conn, '/identity', null, SLOW)),
    plexGet(conn, '/status/sessions', null, FAST),
    settle(plexGet(conn, '/library/sections', null, SLOW)),
    settle(plexGet(conn, '/library/recentlyAdded', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 8 }, MEDIUM)),
  ]);

  const dirs = (sections && sections.Directory) || [];
  const libraries = await Promise.all(dirs.slice(0, 12).map(async (d) => {
    const key = String(d.key).replace(/\D/g, '');
    const count = await settle(plexGet(conn, '/library/sections/' + key + '/all', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 }, SLOW));
    let episodes = null;
    if (d.type === 'show') {
      const ep = await settle(plexGet(conn, '/library/sections/' + key + '/all', { type: 4, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 }, SLOW));
      episodes = ep ? Number(ep.totalSize) || 0 : null;
    }
    return { title: d.title, type: d.type, count: count ? Number(count.totalSize ?? count.size) || 0 : null, episodes };
  }));

  const playing = ((sessions && sessions.Metadata) || []).slice(0, 8).map((m) => {
    const isEp = m.type === 'episode';
    const ts = m.TranscodeSession;
    return {
      title: isEp ? m.grandparentTitle : m.title,
      subtitle: isEp ? ('S' + String(m.parentIndex ?? 0).padStart(2, '0') + 'E' + String(m.index ?? 0).padStart(2, '0') + ' · ' + (m.title || '')) : (m.year ? String(m.year) : ''),
      type: m.type,
      user: (m.User || {}).title || null,
      player: (m.Player || {}).title || (m.Player || {}).product || null,
      state: (m.Player || {}).state || null,
      progress: m.duration ? Math.min(100, Math.round((Number(m.viewOffset) || 0) / m.duration * 100)) : 0,
      transcode: !!ts && (ts.videoDecision === 'transcode' || ts.audioDecision === 'transcode'),
      poster: plexImage(conn, isEp ? (m.grandparentThumb || m.thumb) : m.thumb),
    };
  });

  const recent = ((recentlyAdded && recentlyAdded.Metadata) || []).slice(0, 8).map((m) => ({
    title: m.type === 'season' ? (m.parentTitle || m.title) : m.type === 'episode' ? (m.grandparentTitle || m.title) : m.title,
    subtitle: m.type === 'season' ? m.title : m.type === 'episode' ? m.title : (m.year ? String(m.year) : ''),
    type: m.type,
    date: m.addedAt ? new Date(m.addedAt * 1000).toISOString() : null,
    poster: plexImage(conn, m.type === 'season' ? (m.thumb || m.parentThumb) : m.type === 'episode' ? (m.grandparentThumb || m.thumb) : m.thumb),
  }));

  return {
    version: identity && identity.version,
    health: [],
    stats: {
      streams: playing.length,
      transcoding: playing.filter(p => p.transcode).length,
      movies: libraries.filter(l => l.type === 'movie').reduce((n, l) => n + (l.count || 0), 0),
      shows: libraries.filter(l => l.type === 'show').reduce((n, l) => n + (l.count || 0), 0),
      episodes: libraries.filter(l => l.type === 'show').reduce((n, l) => n + (l.episodes || 0), 0),
      music: libraries.filter(l => l.type === 'artist').reduce((n, l) => n + (l.count || 0), 0),
    },
    libraries,
    playing,
    recent,
  };
}

async function plexImageProxy(res, conn, path) {
  if (!PLEX_IMAGE_PATH.test(path || '')) {
    sendJson(res, 400, { ok: false, error: 'Invalid image path' });
    return;
  }
  try {
    const img = await cached(conn, 'img:' + path, DAY, () => request(conn,
      serviceUrl(conn.base, '/photo/:/transcode', { width: 240, height: 360, minSize: 1, upscale: 1, url: path }),
      { 'X-Plex-Token': conn.apiKey, Accept: 'image/*' }, MAX_IMAGE_BYTES, true));
    const type = /^image\/(jpeg|png|webp|gif)/i.test(img.type) ? img.type : 'image/jpeg';
    sendResponse(res, 200, type, img.body, { 'Cache-Control': 'private, max-age=3600' });
  } catch (e) {
    sendJson(res, 502, { ok: false, error: e instanceof MediaError ? e.message : 'Image unavailable' });
  }
}

// ── Route ──

const HANDLERS = { radarr, sonarr, seerr, plex, prowlarr, sabnzbd };

function handle(req, res, pathname, parsedUrl) {
  if (req.method !== 'GET' || !pathname.startsWith('/api/media/')) return false;
  const parts = pathname.slice('/api/media/'.length).split('/');
  const service = parts[0];
  const isImage = service === 'plex' && parts[1] === 'image' && parts.length === 2;
  if (!SERVICES[service] || (parts.length > 1 && !isImage)) {
    sendJson(res, 404, { ok: false, error: 'Unknown media service' });
    return true;
  }

  (async () => {
    let conn;
    try {
      conn = findWidget(parsedUrl.searchParams.get('widgetId'), service);
    } catch (e) {
      sendJson(res, e.code === 'bad_request' ? 400 : 200, { ok: false, code: e.code, error: e.message });
      return;
    }
    if (isImage) return plexImageProxy(res, conn, parsedUrl.searchParams.get('path'));
    try {
      const data = await HANDLERS[service](conn);
      sendJson(res, 200, { ok: true, service, at: new Date().toISOString(), ...data });
    } catch (e) {
      const known = e instanceof MediaError;
      if (!known) console.error('[media] ' + service + ':', e && e.message);
      sendJson(res, 200, { ok: false, service, code: known ? e.code : 'error', error: known ? e.message : 'Could not read ' + SERVICES[service].name });
    }
  })();
  return true;
}

module.exports = function () { return { handle }; };
module.exports._internals = { findWidget, serviceUrl, PLEX_IMAGE_PATH, cache };

/**
 * Media server widgets: /api/media/:service against mock Radarr, Sonarr,
 * Seerr, Plex, Prowlarr, SABnzbd and Youtarr, plus the widget renderers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { startServer } from '../helpers/server.js';
import { startMockMedia, MOCK_KEYS, YOUTARR_DOWNLOAD_KEY } from '../helpers/mock-media.js';

const SERVICES = ['radarr', 'sonarr', 'seerr', 'plex', 'prowlarr', 'sabnzbd', 'youtarr'];
const ALL_KEYS = Object.values(MOCK_KEYS);

let mock, srv;

function widget(id, service, props = {}) {
  return { id, type: 'media-' + service, x: 0, y: 0, width: 300, height: 200,
    properties: { title: service, displayStyle: 'visual', ...props } };
}

async function media(service, widgetId, base = srv.baseUrl) {
  const res = await fetch(`${base}/api/media/${service}?widgetId=${encodeURIComponent(widgetId)}`);
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

beforeAll(async () => {
  mock = await startMockMedia();
  const widgets = SERVICES.map(s => widget('w-' + s, s, { serviceUrl: mock.url(s), apiKey: '__SECRET__' }));
  widgets.push(
    widget('w-badkey', 'radarr', { serviceUrl: mock.url('radarr'), apiKey: '__SECRET__' }),
    widget('w-sab-badkey', 'sabnzbd', { serviceUrl: mock.url('sabnzbd'), apiKey: '__SECRET__' }),
    widget('w-nourl', 'sonarr', { serviceUrl: '', apiKey: '__SECRET__' }),
    widget('w-nokey', 'sonarr', { serviceUrl: mock.url('sonarr'), apiKey: '' }),
    widget('w-ftp', 'sonarr', { serviceUrl: 'ftp://127.0.0.1/sonarr', apiKey: '__SECRET__' }),
    widget('w-down', 'radarr', { serviceUrl: 'http://127.0.0.1:1/radarr', apiKey: '__SECRET__' }),
    widget('w-wrongtype', 'radarr', { serviceUrl: mock.url('radarr'), apiKey: '__SECRET__' }),
    widget('w-yt-paused', 'youtarr', { serviceUrl: mock.url('youtarr-paused'), apiKey: '__SECRET__' }),
    widget('w-yt-badkey', 'youtarr', { serviceUrl: mock.url('youtarr'), apiKey: '__SECRET__' }),
    widget('w-yt-downloadkey', 'youtarr', { serviceUrl: mock.url('youtarr'), apiKey: '__SECRET__' }),
    widget('w-yt-old', 'youtarr', { serviceUrl: mock.url('youtarr-old'), apiKey: '__SECRET__' }),
  );
  const secrets = Object.fromEntries(SERVICES.map(s => ['w-' + s, { apiKey: MOCK_KEYS[s] }]));
  Object.assign(secrets, {
    'w-badkey': { apiKey: 'wrong-key' }, 'w-sab-badkey': { apiKey: 'wrong-key' }, 'w-nourl': { apiKey: 'x' },
    'w-ftp': { apiKey: 'x' }, 'w-down': { apiKey: 'down-secret-key' }, 'w-wrongtype': { apiKey: MOCK_KEYS.radarr },
    'w-yt-paused': { apiKey: MOCK_KEYS.youtarr }, 'w-yt-badkey': { apiKey: 'wrong-key' },
    'w-yt-downloadkey': { apiKey: YOUTARR_DOWNLOAD_KEY }, 'w-yt-old': { apiKey: MOCK_KEYS.youtarr },
  });
  srv = await startServer({ config: { canvas: { width: 1920, height: 1080 }, widgets }, secrets });
});

afterAll(async () => {
  if (srv) await srv.kill();
  if (mock) await mock.close();
});

describe('media summaries', () => {
  it('Radarr: library counts, health, recent (de-duplicated) and upcoming', async () => {
    const { body } = await media('radarr', 'w-radarr');
    expect(body.ok).toBe(true);
    expect(body.version).toBe('5.14.0.9383');
    expect(body.stats).toMatchObject({ movies: 6, onDisk: 4, monitored: 5, missing: 1, queue: 2 });
    expect(body.stats.sizeOnDisk).toBe(200 * 1024 ** 3);
    expect(body.stats.freeSpace).toBe(1.5 * 1024 ** 4); // the same root folder listed twice counts once
    expect(body.health).toEqual([{ level: 'warning', message: 'Indexers unavailable due to failures: NZBgeek' }]);
    expect(body.recent.map(r => r.title)).toEqual(['Dune: Part Two', 'Dune']);
    expect(body.recent[0].poster).toMatch(/^https:\/\/image\.tmdb\.org\//);
    expect(body.upcoming).toHaveLength(1);
    expect(body.upcoming[0].title).toBe('Project Hail Mary');
  });

  it('Sonarr: series and episode counts, recent episodes, airing soon', async () => {
    const { body } = await media('sonarr', 'w-sonarr');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ series: 3, episodes: 81, episodesOnDisk: 79, missing: 2, queue: 1 });
    // one entry per series: Andor's three new episodes (one imported twice) collapse into one
    expect(body.recent.map(r => r.title)).toEqual(['Andor', 'Severance']);
    expect(body.recent[0]).toMatchObject({ title: 'Andor', episode: 'S02E12', episodes: 3 });
    expect(body.recent[1]).toMatchObject({ title: 'Severance', episode: 'S02E10', episodes: 1 });
    expect(body.upcoming.map(u => u.title + ' ' + u.episode)).toEqual(['The Bear S04E01', 'Severance S03E01']);
  });

  it('Seerr: request counts and the latest requests with titles', async () => {
    const { body } = await media('seerr', 'w-seerr');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ total: 57, pending: 3, approved: 6, processing: 4, available: 42, openIssues: 1 });
    expect(body.recent.map(r => r.title)).toEqual(['Project Hail Mary', 'The Bear', 'Dune: Part Two']);
    expect(body.recent[0]).toMatchObject({ requestedBy: 'Sam', status: 'pending', kind: 'movie' });
    expect(body.recent[0].poster).toBe('https://image.tmdb.org/t/p/w185/yihdXomYb5kTeSivtFndMy5iDmf.jpg');
  });

  it('Plex: sessions, libraries and proxied poster links', async () => {
    const { body } = await media('plex', 'w-plex');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ streams: 2, transcoding: 1, movies: 1243, shows: 211, episodes: 15873, music: 88 });
    expect(body.playing[0]).toMatchObject({ title: 'Severance', user: 'Sam', state: 'playing', progress: 55, transcode: false });
    expect(body.playing[0].subtitle).toContain('S02E10');
    expect(body.playing[1]).toMatchObject({ title: 'Arrival', transcode: true });
    expect(body.playing[0].poster).toBe('/api/media/plex/image?widgetId=w-plex&path=' + encodeURIComponent('/library/metadata/200/thumb/1700000000'));
    expect(body.recent[1]).toMatchObject({ title: 'Andor', subtitle: 'Season 2' });
  });

  it('Prowlarr: indexer totals and per-indexer stats', async () => {
    const { body } = await media('prowlarr', 'w-prowlarr');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ indexers: 3, enabled: 2, queries: 8000, grabs: 517, failedQueries: 53 });
    expect(body.indexers[0]).toMatchObject({ name: 'NZBgeek', queries: 4120, grabs: 312 });
    expect(body.health[0].level).toBe('error');
  });

  it('SABnzbd: speed, queue items and totals', async () => {
    const { body } = await media('sabnzbd', 'w-sabnzbd');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ status: 'Downloading', paused: false, queue: 3, timeLeft: '0:07:15', failed: 4 });
    expect(body.stats.speedBps).toBe(Math.round(42318.25 * 1024));
    expect(body.items[0]).toMatchObject({ name: 'Andor.S02E12.2160p.WEB.H265', percent: 64 });
  });

  it('Youtarr: library, what is downloading, the last run and recent downloads', async () => {
    const { body } = await media('youtarr', 'w-youtarr');
    expect(body.ok).toBe(true);
    expect(body).toMatchObject({ version: '1.94.0', ytDlpVersion: '2026.11.10', health: [] });
    expect(body.stats).toEqual({ channels: 42, videos: 1873, storageBytes: 512 * 1024 ** 3,
      paused: false, active: true, downloading: 2, queued: 5, queuedJobs: 1 });
    expect(body.lastRun).toMatchObject({ status: 'warning', downloaded: 7, failed: 1 });
    expect(body.lastRun.date).toBeTruthy();
    expect(body.recent.map(r => r.title)).toEqual(['How a Mechanical Watch Works', 'Sourdough From Scratch', 'A video with an odd id']);
    expect(body.recent[0]).toMatchObject({ channel: 'Clockwork', poster: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' });
    expect(body.recent[2].poster).toBeNull(); // only a well-formed video id becomes a thumbnail URL
  });

  it('Youtarr: a storage pause is a health warning, and an empty library is fine', async () => {
    const { body } = await media('youtarr', 'w-yt-paused');
    expect(body.ok).toBe(true);
    expect(body.stats).toMatchObject({ paused: true, active: false, videos: 0 });
    expect(body.health).toEqual([{ level: 'warning', message: 'Downloads are paused by the storage limit' }]);
    expect(body.lastRun).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it('keeps reverse-proxy sub-paths and sends keys the right way', () => {
    const youtarr = mock.requests.find(r => r.service === 'youtarr' && r.path === '/api/status/summary');
    expect(youtarr.headers['x-api-key']).toBe(MOCK_KEYS.youtarr);
    const radarr = mock.requests.find(r => r.service === 'radarr' && r.path === '/api/v3/movie');
    expect(radarr.headers['x-api-key']).toBe(MOCK_KEYS.radarr);
    const plex = mock.requests.find(r => r.service === 'plex' && r.path === '/status/sessions');
    expect(plex.headers['x-plex-token']).toBe(MOCK_KEYS.plex);
    expect(mock.requests.some(r => r.service === 'sabnzbd' && r.query.includes('apikey=' + MOCK_KEYS.sabnzbd))).toBe(true);
  });
});

describe('media errors and setup messages', () => {
  it('reports a rejected key without leaking it', async () => {
    const { body, text } = await media('radarr', 'w-badkey');
    expect(body).toMatchObject({ ok: false, code: 'auth', error: 'Radarr rejected the API key' });
    expect(text).not.toContain('wrong-key');
  });

  it('understands SABnzbd\'s own bad-key reply', async () => {
    const { body } = await media('sabnzbd', 'w-sab-badkey');
    expect(body).toMatchObject({ ok: false, code: 'auth', error: 'SABnzbd rejected the API key' });
  });

  it('tells a Youtarr user which key it needs, for a wrong key and for a download key', async () => {
    for (const id of ['w-yt-badkey', 'w-yt-downloadkey']) {
      const { body, text } = await media('youtarr', id);
      expect(body, id).toMatchObject({ ok: false, code: 'auth', error: 'Youtarr rejected the API key (it needs a read-only status key)' });
      expect(text).not.toContain('wrong-key');
      expect(text).not.toContain(YOUTARR_DOWNLOAD_KEY);
    }
  });

  it('names the version needed when Youtarr has no status API', async () => {
    const { body } = await media('youtarr', 'w-yt-old');
    expect(body).toMatchObject({ ok: false, code: 'bad_response' });
    expect(body.error).toContain('Youtarr 1.94.0 or newer');
  });

  it('asks for a URL, a key, or a valid scheme', async () => {
    expect((await media('sonarr', 'w-nourl')).body.code).toBe('no_url');
    expect((await media('sonarr', 'w-nokey')).body.code).toBe('no_key');
    expect((await media('sonarr', 'w-ftp')).body.code).toBe('bad_url');
  });

  it('says to save the layout for a widget that is not saved yet', async () => {
    const { body } = await media('radarr', 'not-saved-yet');
    expect(body).toMatchObject({ ok: false, code: 'not_saved' });
  });

  it('names the host when a service is unreachable, without the key', async () => {
    const { body, text } = await media('radarr', 'w-down');
    expect(body.ok).toBe(false);
    expect(body.code).toBe('unreachable');
    expect(body.error).toContain('127.0.0.1:1');
    expect(text).not.toContain('down-secret-key');
  });

  it('refuses to use a widget of another type', async () => {
    const { status, body } = await media('sonarr', 'w-wrongtype');
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('404s unknown services and extra path segments', async () => {
    expect((await fetch(`${srv.baseUrl}/api/media/lidarr?widgetId=w-radarr`)).status).toBe(404);
    expect((await fetch(`${srv.baseUrl}/api/media/radarr/movie?widgetId=w-radarr`)).status).toBe(404);
  });

  it('never returns any API key in any response', async () => {
    for (const s of SERVICES) {
      const { text } = await media(s, 'w-' + s);
      for (const k of ALL_KEYS) expect(text).not.toContain(k);
    }
    const cfg = await (await fetch(`${srv.baseUrl}/config`)).text();
    for (const k of ALL_KEYS) expect(cfg).not.toContain(k);
  });
});

describe('Plex image proxy', () => {
  it('serves library posters', async () => {
    const res = await fetch(`${srv.baseUrl}/api/media/plex/image?widgetId=w-plex&path=${encodeURIComponent('/library/metadata/200/thumb/1700000000')}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('rejects any other path and never forwards it', async () => {
    for (const path of ['/:/prefs', '/library/metadata/1/../../:/prefs', '/library/sections', 'http://evil/x.png', '/library/metadata/1/thumb?X-Plex-Token=x']) {
      const res = await fetch(`${srv.baseUrl}/api/media/plex/image?widgetId=w-plex&path=${encodeURIComponent(path)}`);
      expect(res.status, path).toBe(400);
    }
    expect(mock.requests.some(r => r.service === 'plex' && /prefs|evil/.test(r.path + r.query))).toBe(false);
  });
});

describe('media route requires login when a password is set', () => {
  it('returns 401 without a session', async () => {
    const locked = await startServer({ password: 'pw', config: { widgets: [widget('w', 'radarr', { serviceUrl: mock.url('radarr') })] } });
    try {
      const res = await fetch(`${locked.baseUrl}/api/media/radarr?widgetId=w`);
      expect(res.status).toBe(401);
    } finally {
      await locked.kill();
    }
  });
});

describe('media widgets (browser side)', () => {
  let W, M;
  beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'http://localhost', runScripts: 'dangerously' });
    for (const f of ['js/widgets/shared/icons.js', 'js/widgets/index.js', 'js/widgets/arr.js']) {
      dom.window.eval(readFileSync(join(process.cwd(), f), 'utf8'));
    }
    W = dom.window.WIDGETS;
    M = dom.window._lbMedia;
  });

  it('registers every widget with URL, key and style settings', () => {
    for (const s of SERVICES) {
      const w = W['media-' + s];
      expect(w, s).toBeDefined();
      expect(w.hasApiKey).toBe(true);
      expect(w.properties).toMatchObject({ serviceUrl: '', apiKey: '', displayStyle: 'visual' });
    }
  });

  it('generated scripts only embed a JSON-escaped id, the service and the style', () => {
    const js = W['media-radarr'].generateJs({ id: 'x");alert(1);("', displayStyle: '"><script>', refreshInterval: '1' });
    expect(js).toBe('window._lbMedia && window._lbMedia.start("x\\");alert(1);(\\"", "radarr", 5, "visual", "1");');
  });

  it('offers a poster size on the poster widgets only, and passes only known values', () => {
    for (const s of ['radarr', 'sonarr', 'seerr', 'plex', 'youtarr']) expect(W['media-' + s].properties.posterSize, s).toBe('1');
    for (const s of ['prowlarr', 'sabnzbd']) expect(W['media-' + s].properties.posterSize, s).toBeUndefined();
    expect(W['media-plex'].generateJs({ id: 'p', posterSize: '2' })).toContain(', "2");');
    expect(W['media-plex'].generateJs({ id: 'p', posterSize: '1.5' })).toContain(', "1.5");');
    expect(W['media-plex'].generateJs({ id: 'p', posterSize: '9"' })).toContain(', "1");');
  });

  it('Sonarr captions a series with several new episodes by count', () => {
    const html = M.renderers.sonarr({ stats: {}, recent: [{ title: 'Andor', episode: 'S02E12', episodes: 3 }, { title: 'Severance', episode: 'S02E10', episodes: 1 }] }, 'visual', {});
    expect(html).toContain('>3 episodes<');
    expect(html).toContain('>S02E10<');
  });

  it('Seerr shows status under posters when one person makes all requests, names when several do', () => {
    const one = [{ title: 'A', requestedBy: 'Curbob', status: 'approved', mediaStatus: 'processing' },
      { title: 'B', requestedBy: 'Curbob', status: 'completed', mediaStatus: 'available' },
      { title: 'C', requestedBy: 'Curbob', status: 'pending', mediaStatus: 'pending' }];
    const solo = M.renderers.seerr({ stats: {}, recent: one }, 'visual', {});
    expect(solo).not.toContain('>Curbob<');
    expect(solo).toContain('>Processing<');
    expect(solo).toContain('>Available<');
    expect(solo).toContain('>Pending<');
    const many = M.renderers.seerr({ stats: {}, recent: [one[0], { ...one[1], requestedBy: 'Sam' }] }, 'visual', {});
    expect(many).toContain('>Curbob<');
    expect(many).toContain('>Sam<');
  });

  it('Youtarr says what it is doing and shows the last run and recent downloads as wide thumbnails', () => {
    const recent = [{ title: 'How a Mechanical Watch Works', channel: 'Clockwork', date: new Date().toISOString(), poster: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' }];
    const stats = { channels: 42, videos: 1873, storageBytes: 512 * 1024 ** 3, downloading: 2, queued: 5, queuedJobs: 1, active: true };
    const busy = M.renderers.youtarr({ stats, lastRun: { status: 'warning', downloaded: 7, failed: 1 }, recent }, 'visual', {});
    expect(busy).toContain('>Downloading<');
    expect(busy).toContain('2 downloading · 5 queued · 1 job waiting');
    expect(busy).toContain('Last run: 7 downloaded, 1 failed');
    expect(busy).toContain('class="lbm-posters lbm-wide"');
    expect(busy).toContain('>Clockwork<');
    expect(busy).toContain('42 channels · 1,873 videos · 512 GB');

    const idle = M.renderers.youtarr({ stats: { channels: 1 }, lastRun: null, recent: [] }, 'visual', {});
    expect(idle).toContain('>Idle<');
    expect(idle).toContain('Nothing in the queue');
    expect(idle).toContain('No downloads yet');
    expect(idle).not.toContain('Last run');

    const paused = M.renderers.youtarr({ stats: { paused: true }, health: [{ level: 'warning', message: 'Downloads are paused by the storage limit' }] }, 'visual', {});
    expect(paused).toContain('>Paused<');
    expect(paused).toContain('Downloads are paused by the storage limit');

    const numbers = M.renderers.youtarr({ version: '1.94.0', ytDlpVersion: '2026.11.10', stats, lastRun: { status: 'error', downloaded: 0, failed: 3 }, recent }, 'numbers', {});
    expect(numbers).toContain('>Error<');
    expect(numbers).toContain('Latest: How a Mechanical Watch Works');
    expect(numbers).toContain('Youtarr 1.94.0 · yt-dlp 2026.11.10');
  });

  it('escapes Youtarr video titles and channel names', () => {
    const evil = '<img src=x onerror=alert(1)>';
    for (const style of ['visual', 'numbers']) {
      const html = M.renderers.youtarr({ version: evil, stats: {}, lastRun: { status: 'success', downloaded: 1, failed: 0 },
        recent: [{ title: evil, channel: evil, poster: 'https://x/"onerror="alert(1)' }] }, style, {});
      expect(html, style).not.toContain('<img src=x');
      expect(html, style).not.toContain('"onerror="alert');
    }
  });

  it('escapes titles and messages from the services', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const html = M.renderers.radarr({ stats: { movies: 1, onDisk: 1 }, health: [{ level: 'warning', message: evil }],
      recent: [{ title: evil, poster: 'https://x/"onerror="alert(1)' }], upcoming: [{ title: evil, date: new Date().toISOString() }] }, 'visual', {});
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"onerror="alert');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders both styles for every service without throwing', () => {
    const empty = { stats: {}, health: [], recent: [], upcoming: [], items: [], indexers: [], playing: [], libraries: [] };
    for (const s of SERVICES) {
      for (const style of ['numbers', 'visual']) {
        expect(typeof M.renderers[s](empty, style, {}), s + ' ' + style).toBe('string');
      }
    }
  });
});

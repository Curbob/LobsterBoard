/**
 * Test helper: one HTTP server that imitates Radarr, Sonarr, Prowlarr, SABnzbd,
 * Seerr and Plex under sub-paths (/radarr, /sonarr, ...), using the response
 * shapes of their real APIs. Each service only answers with its own key.
 *
 *   const mock = await startMockMedia();
 *   mock.url('radarr')  // -> http://127.0.0.1:PORT/radarr
 *   mock.keys.radarr    // -> the key it accepts
 *   mock.requests       // -> every request path it received (for assertions)
 *   await mock.close();
 *
 * Also runnable on its own for manual testing:  node helpers/mock-media.js 9911
 */

import http from 'node:http';

export const MOCK_KEYS = {
  radarr: 'radarr-test-key',
  sonarr: 'sonarr-test-key',
  prowlarr: 'prowlarr-test-key',
  sabnzbd: 'sabnzbd-test-key',
  seerr: 'seerr-test-key',
  plex: 'plex-test-token',
};

const GB = 1024 ** 3;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const tmdb = (p) => 'https://image.tmdb.org/t/p/original' + p;
const poster = (p) => [{ coverType: 'poster', url: '/MediaCover/1/poster.jpg', remoteUrl: tmdb(p) }];

const MOVIES = [
  { id: 1, title: 'Dune', year: 2021, hasFile: true, monitored: true, isAvailable: true, sizeOnDisk: 62 * GB, images: poster('/d5NXSklXo0qyIYkgV94XAgMIckC.jpg') },
  { id: 2, title: 'Dune: Part Two', year: 2024, hasFile: true, monitored: true, isAvailable: true, sizeOnDisk: 71 * GB, images: poster('/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg') },
  { id: 3, title: 'Arrival', year: 2016, hasFile: true, monitored: true, isAvailable: true, sizeOnDisk: 38 * GB, images: poster('/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg') },
  { id: 4, title: 'Blade Runner 2049', year: 2017, hasFile: false, monitored: true, isAvailable: true, sizeOnDisk: 0, images: poster('/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg') },
  { id: 5, title: 'Sicario', year: 2015, hasFile: true, monitored: false, isAvailable: true, sizeOnDisk: 29 * GB, images: poster('/lz8vNyXeidqqOdJW9ZjnDAMb5Vr.jpg') },
  { id: 6, title: 'Project Hail Mary', year: 2026, hasFile: false, monitored: true, isAvailable: false, sizeOnDisk: 0, images: poster('/yihdXomYb5kTeSivtFndMy5iDmf.jpg') },
];

const SERIES = [
  { id: 1, title: 'Severance', year: 2022, statistics: { episodeCount: 19, episodeFileCount: 19, sizeOnDisk: 88 * GB }, images: poster('/pqzjCxPVc9TkVgGRWeAoMmyqkZV.jpg') },
  { id: 2, title: 'The Bear', year: 2022, statistics: { episodeCount: 38, episodeFileCount: 36, sizeOnDisk: 41 * GB }, images: poster('/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg') },
  { id: 3, title: 'Andor', year: 2022, statistics: { episodeCount: 24, episodeFileCount: 24, sizeOnDisk: 120 * GB }, images: poster('/59SVNwLfoMnZPPB6ukW6dlPxAdI.jpg') },
];

const HEALTH = [
  { source: 'IndexerStatusCheck', type: 'warning', message: 'Indexers unavailable due to failures: NZBgeek', wikiUrl: '' },
  { source: 'UpdateCheck', type: 'notice', message: 'New update is available', wikiUrl: '' },
];

function radarr(path, q) {
  switch (path) {
    case '/api/v3/system/status': return { version: '5.14.0.9383', appName: 'Radarr' };
    case '/api/v3/health': return HEALTH;
    case '/api/v3/movie': return MOVIES;
    case '/api/v3/wanted/missing': return { page: 1, pageSize: Number(q.get('pageSize')) || 10, totalRecords: 1, records: [] };
    case '/api/v3/queue': return { page: 1, pageSize: 1, totalRecords: 2, records: [] };
    case '/api/v3/rootfolder': return [{ path: '/movies', freeSpace: 1.5 * 1024 * GB }, { path: '/movies', freeSpace: 1.5 * 1024 * GB }];
    case '/api/v3/calendar': return [
      { ...MOVIES[5], digitalRelease: day(5), physicalRelease: day(30), inCinemas: day(-20) },
      { ...MOVIES[0], digitalRelease: day(3) }, // has a file: skipped
    ];
    case '/api/v3/history': return { page: 1, totalRecords: 3, records: [
      { movieId: 2, date: day(-0.1), eventType: 'downloadFolderImported', quality: { quality: { name: 'Bluray-2160p' } }, movie: MOVIES[1] },
      { movieId: 1, date: day(-1), eventType: 'downloadFolderImported', quality: { quality: { name: 'Bluray-1080p' } } },
      { movieId: 2, date: day(-2), eventType: 'downloadFolderImported', quality: { quality: { name: 'WEBDL-1080p' } }, movie: MOVIES[1] },
    ] };
  }
  return undefined;
}

function sonarr(path) {
  switch (path) {
    case '/api/v3/system/status': return { version: '4.0.11.2680', appName: 'Sonarr' };
    case '/api/v3/health': return [];
    case '/api/v3/series': return SERIES;
    case '/api/v3/wanted/missing': return { page: 1, pageSize: 1, totalRecords: 2, records: [] };
    case '/api/v3/queue': return { page: 1, pageSize: 1, totalRecords: 1, records: [] };
    case '/api/v3/rootfolder': return [{ path: '/tv', freeSpace: 900 * GB }];
    case '/api/v3/calendar': return [
      { seriesId: 2, seasonNumber: 4, episodeNumber: 1, title: 'Groundhog', airDateUtc: day(2), hasFile: false, series: SERIES[1] },
      { seriesId: 1, seasonNumber: 3, episodeNumber: 1, title: 'Hello, Ms. Cobel', airDateUtc: day(9), hasFile: false },
    ];
    case '/api/v3/history': return { page: 1, totalRecords: 2, records: [
      { seriesId: 3, date: day(-0.2), quality: { quality: { name: 'WEBDL-2160p' } }, series: SERIES[2], episode: { seasonNumber: 2, episodeNumber: 12, title: 'Jedha, Kyber, Erso' } },
      { seriesId: 3, date: day(-0.3), quality: { quality: { name: 'WEBDL-2160p' } }, series: SERIES[2], episode: { seasonNumber: 2, episodeNumber: 11, title: 'Who Else Knows?' } },
      { seriesId: 3, date: day(-0.3), quality: { quality: { name: 'WEBDL-2160p' } }, series: SERIES[2], episode: { seasonNumber: 2, episodeNumber: 11, title: 'Who Else Knows?' } }, // re-import: counted once
      { seriesId: 3, date: day(-0.4), quality: { quality: { name: 'WEBDL-2160p' } }, series: SERIES[2], episode: { seasonNumber: 2, episodeNumber: 10, title: 'Make It Stop' } },
      { seriesId: 1, date: day(-1.5), quality: { quality: { name: 'WEBDL-1080p' } }, series: SERIES[0], episode: { seasonNumber: 2, episodeNumber: 10, title: 'Cold Harbor' } },
    ] };
  }
  return undefined;
}

function prowlarr(path) {
  switch (path) {
    case '/api/v1/system/status': return { version: '1.28.2.4885', appName: 'Prowlarr' };
    case '/api/v1/health': return [{ type: 'error', message: 'All indexers are unavailable due to failures' }];
    case '/api/v1/indexer': return [{ id: 1, name: 'NZBgeek', enable: true }, { id: 2, name: 'DrunkenSlug', enable: true }, { id: 3, name: 'Old one', enable: false }];
    case '/api/v1/indexerstats': return { indexers: [
      { indexerId: 1, indexerName: 'NZBgeek', numberOfQueries: 4120, numberOfGrabs: 312, numberOfFailedQueries: 41, numberOfFailedGrabs: 2, averageResponseTime: 412 },
      { indexerId: 2, indexerName: 'DrunkenSlug', numberOfQueries: 3880, numberOfGrabs: 205, numberOfFailedQueries: 12, numberOfFailedGrabs: 0, averageResponseTime: 655 },
    ] };
  }
  return undefined;
}

function sabnzbd(q) {
  if (q.get('apikey') !== MOCK_KEYS.sabnzbd) return { status: false, error: 'API Key Incorrect' };
  switch (q.get('mode')) {
    case 'version': return { version: '4.4.1' };
    case 'queue': return { queue: {
      status: 'Downloading', paused: false, kbpersec: '42318.25', speed: '41.3 M', mbleft: '18432.50', mb: '30720.00',
      timeleft: '0:07:15', noofslots: 3, noofslots_total: 3,
      slots: [
        { filename: 'Andor.S02E12.2160p.WEB.H265', percentage: '64', mb: '12288.00', mbleft: '4423.68', timeleft: '0:01:47', status: 'Downloading' },
        { filename: 'The.Bear.S04E01.1080p.WEB.H264', percentage: '0', mb: '3072.00', mbleft: '3072.00', timeleft: '0:01:14', status: 'Queued' },
        { filename: 'Dune.Part.Two.2024.2160p.UHD.BluRay', percentage: '0', mb: '15360.00', mbleft: '15360.00', timeleft: '0:06:11', status: 'Queued' },
      ] } };
    case 'server_stats': return { total: 18.2 * 1024 * GB, month: 2.1 * 1024 * GB, week: 410 * GB, day: 58 * GB, servers: {} };
    case 'history': return { history: { noofslots: 4, slots: [] } };
  }
  return { status: false, error: 'not implemented' };
}

function seerr(path, q) {
  switch (path) {
    case '/api/v1/status': return { version: '2.1.0', updateAvailable: false };
    case '/api/v1/request/count': return { total: 57, movie: 33, tv: 24, pending: 3, approved: 6, declined: 2, processing: 4, available: 42 };
    case '/api/v1/issue/count': return { total: 5, open: 1, closed: 4 };
    case '/api/v1/request': return { pageInfo: { results: 57 }, results: [
      { id: 57, status: 1, type: 'movie', createdAt: day(-0.05), media: { tmdbId: 687163, mediaType: 'movie', status: 2 }, requestedBy: { displayName: 'Sam' } },
      { id: 56, status: 2, type: 'tv', createdAt: day(-1), media: { tmdbId: 136315, mediaType: 'tv', status: 3 }, requestedBy: { displayName: 'Alex' } },
      { id: 55, status: 2, type: 'movie', createdAt: day(-3), media: { tmdbId: 693134, mediaType: 'movie', status: 5 }, requestedBy: { displayName: 'Sam' } },
    ].slice(0, Number(q.get('take')) || 10) };
    case '/api/v1/movie/687163': return { title: 'Project Hail Mary', releaseDate: '2026-03-20', posterPath: '/yihdXomYb5kTeSivtFndMy5iDmf.jpg' };
    case '/api/v1/tv/136315': return { name: 'The Bear', firstAirDate: '2022-06-23', posterPath: '/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg' };
    case '/api/v1/movie/693134': return { title: 'Dune: Part Two', releaseDate: '2024-02-27', posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg' };
  }
  return undefined;
}

function plex(path, q) {
  const mc = (o) => ({ MediaContainer: o });
  switch (path) {
    case '/identity': return mc({ machineIdentifier: 'abc', version: '1.41.3.9314' });
    case '/status/sessions': return mc({ size: 2, Metadata: [
      { type: 'episode', title: 'Cold Harbor', grandparentTitle: 'Severance', parentIndex: 2, index: 10, duration: 3600000, viewOffset: 1980000,
        thumb: '/library/metadata/201/thumb/1700000001', grandparentThumb: '/library/metadata/200/thumb/1700000000',
        User: { title: 'Sam' }, Player: { title: 'Living Room TV', product: 'Plex for LG', state: 'playing' } },
      { type: 'movie', title: 'Arrival', year: 2016, duration: 6960000, viewOffset: 696000, thumb: '/library/metadata/300/thumb/1700000002',
        User: { title: 'Alex' }, Player: { title: 'iPad', state: 'paused' }, TranscodeSession: { videoDecision: 'transcode', audioDecision: 'copy' } },
    ] });
    case '/library/sections': return mc({ Directory: [
      { key: '1', title: 'Movies', type: 'movie' }, { key: '2', title: 'TV Shows', type: 'show' }, { key: '3', title: 'Music', type: 'artist' },
    ] });
    case '/library/sections/1/all': return mc({ size: 0, totalSize: 1243 });
    case '/library/sections/2/all': return mc({ size: 0, totalSize: q.get('type') === '4' ? 15873 : 211 });
    case '/library/sections/3/all': return mc({ size: 0, totalSize: 88 });
    case '/library/recentlyAdded': return mc({ size: 3, Metadata: [
      { type: 'movie', title: 'Dune: Part Two', year: 2024, addedAt: Math.floor(Date.now() / 1000) - 3600, thumb: '/library/metadata/400/thumb/1700000003' },
      { type: 'season', title: 'Season 2', parentTitle: 'Andor', addedAt: Math.floor(Date.now() / 1000) - 7200, thumb: '/library/metadata/501/thumb/1700000004', parentThumb: '/library/metadata/500/thumb/1700000005' },
      { type: 'movie', title: 'Sicario', year: 2015, addedAt: Math.floor(Date.now() / 1000) - 86400, thumb: '/library/metadata/600/thumb/1700000006' },
      ...['Heat', 'Alien', 'Arrival', 'Prisoners', 'Enemy', 'Gattaca', 'Moon', 'Her', 'Drive'].map((title, i) => (
        { type: 'movie', title, year: 2000 + i, addedAt: Math.floor(Date.now() / 1000) - 86400 * (2 + i), thumb: '/library/metadata/' + (700 + i) + '/thumb/1700000100' })),
    ].slice(0, Number(q.get('X-Plex-Container-Size')) || 50) });
  }
  return undefined;
}

// A 1x1 PNG, for the Plex photo transcoder
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export function startMockMedia(port = 0) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const [, service, ...rest] = u.pathname.split('/');
    const path = '/' + rest.join('/');
    requests.push({ service, path, query: u.search, headers: req.headers });
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

    let body;
    if (service === 'sabnzbd') {
      if (path !== '/api') return json(404, { error: 'not found' });
      return json(200, sabnzbd(u.searchParams));
    }
    if (service === 'plex') {
      if (path !== '/identity' && req.headers['x-plex-token'] !== MOCK_KEYS.plex) return json(401, { error: 'Unauthorized' });
      if (path === '/photo/:/transcode') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
      body = plex(path, u.searchParams);
    } else if (MOCK_KEYS[service]) {
      if (req.headers['x-api-key'] !== MOCK_KEYS[service]) return json(401, { error: 'Unauthorized' });
      body = { radarr, sonarr, prowlarr, seerr }[service](path, u.searchParams);
    }
    if (body === undefined) return json(404, { error: 'not found' });
    json(200, body);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({
        port: p,
        keys: MOCK_KEYS,
        requests,
        url: (service) => `http://127.0.0.1:${p}/${service}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('mock-media.js')) {
  startMockMedia(Number(process.argv[2]) || 9911).then((m) => console.log('Mock media services on ' + m.url('').replace(/\/$/, '')));
}

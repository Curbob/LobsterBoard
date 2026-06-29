const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { sendJson, sendError } = require('../response.cjs');

const TEDDYCAMERA_REPO = process.env.TEDDYCAMERA_REPO
  || '/Users/teddyclaw/Documents/Codex/2026-06-25/teddycamera';
const TEDDYCAMERA_NODE = process.env.TEDDYCAMERA_NODE
  || '/opt/homebrew/bin/node';

// ── Logging ──────────────────────────────────────────────────────────────
// One line per event, JSON-encoded, goes to stderr (LaunchAgent picks it up)
// and to a rolling file at ~/.local/share/teddy-house/teddy-camera-route.log.
// Tuned for OODA loops: every step of buildFeedForWidget is logged so you
// can trace why the widget shows what it shows.
const TEDDYCAMERA_LOG_FILE = process.env.TEDDYCAMERA_LOG_FILE
  || path.join(os.homedir(), '.local', 'share', 'teddy-house', 'teddy-camera-route.log');
try { fs.mkdirSync(path.dirname(TEDDYCAMERA_LOG_FILE), { recursive: true }); } catch (_) {}

function log(event, fields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...fields
  });
  try { process.stderr.write(line + '\n'); } catch (_) {}
  try { fs.appendFileSync(TEDDYCAMERA_LOG_FILE, line + '\n'); } catch (_) {}
}

function wrapResponseForLog(res, pathname, t0) {
  // Wrap res.writeHead/res.end so we can log the upstream status and body size
  // without touching the proxyToTeddyCamera internals.
  const originalWriteHead = res.writeHead.bind(res);
  let statusCode = 200;
  res.writeHead = function (code, headers) {
    statusCode = code;
    return originalWriteHead(code, headers);
  };
  const originalEnd = res.end.bind(res);
  res.end = function (chunk) {
    log('proxy.out', {
      pathname,
      status: statusCode,
      latency_ms: Date.now() - t0,
      bytes: chunk ? (chunk.length || 0) : 0
    });
    return originalEnd(chunk);
  };
  return res;
}

const TEDDYCAMERA_DEFAULT_PORT = Number(process.env.TEDDYCAMERA_PORT || 18116);
const TEDDYCAMERA_DEFAULT_HOST = process.env.TEDDYCAMERA_HOST || '127.0.0.1';
const TEDDYCAMERA_TOKEN_FILE = path.join(os.homedir(), '.config', 'teddycamera', 'token');
const FORWARDED_PATHS = new Set([
  '/api/timeline',
  '/api/events',
  '/api/status',
  '/api/dashboard',
  '/api/thumbnails',
  '/api/cameras',
  '/api/ops',
  '/api/history',
  // Static assets that need to flow through the funnel so a phone on Tailscale
  // can render the feed and open the live camera.
  '/thumbs/',
  '/stream.mjpg',
  '/latest.jpg',
  // Camera player proxied under a dedicated homebase sub-path so the funnel
  // URL https://...ts.net:10000/teddycam/ shows the live player. The homebase
  // proxy injects the Bearer token so the camera's session heal is not needed.
  '/teddycam/',
  '/teddycam/index.html',
  '/teddycam/manifest.webmanifest',
  '/teddycam/sw.js',
  '/teddycam/favicon.ico'
]);

log('boot', { repo: TEDDYCAMERA_REPO, host: TEDDYCAMERA_DEFAULT_HOST, port: TEDDYCAMERA_DEFAULT_PORT, log: TEDDYCAMERA_LOG_FILE });

// Voice guide:
//   GSOC: terse, ops-briefing. Time-stamped. Calls a hand-off. No fluff, no "please", no hype.
//   teddy: dry, slightly weary. No exclamation marks. Sits with the camera. Not impressed.
//   Together: a SOC analyst on shift with a bear that won't stop narrating.

const FRIENDLY_LABEL_GROUPS = {
  person:      { icon: '🚶', noun: 'Person',     verb: 'on camera' },
  vehicle:     { icon: '🚗', noun: 'Vehicle',    verb: 'on camera' },
  car:         { icon: '🚗', noun: 'Car',        verb: 'on camera' },
  truck:       { icon: '🚚', noun: 'Truck',      verb: 'on camera' },
  bus:         { icon: '🚌', noun: 'Bus',        verb: 'on camera' },
  motorcycle:  { icon: '🏍️', noun: 'Motorcycle', verb: 'on camera' },
  bicycle:     { icon: '🚲', noun: 'Bicycle',    verb: 'on camera' },
  dog:         { icon: '🐕', noun: 'Dog',        verb: 'on camera' },
  cat:         { icon: '🐈', noun: 'Cat',        verb: 'on camera' },
  bird:        { icon: '🐦', noun: 'Bird',       verb: 'on camera' },
  horse:       { icon: '🐎', noun: 'Horse',      verb: 'on camera' },
  sheep:       { icon: '🐑', noun: 'Sheep',      verb: 'on camera' },
  cow:         { icon: '🐄', noun: 'Cow',        verb: 'on camera' },
  animal:      { icon: '🐾', noun: 'Animal',     verb: 'on camera' },
  backpack:    { icon: '🎒', noun: 'Backpack',   verb: 'left behind' },
  handbag:     { icon: '👜', noun: 'Bag',        verb: 'left behind' },
  suitcase:    { icon: '🧳', noun: 'Suitcase',   verb: 'left behind' },
  package:     { icon: '📦', noun: 'Package',    verb: 'left at the door' },
  delivery:    { icon: '📬', noun: 'Delivery',   verb: 'logged' },
  garbage:     { icon: '🗑️', noun: 'Garbage truck', verb: 'logged' }
};

// Caption bank: picked based on labels + event kind. Each entry is a {soc, teddy} pair
// so the GSOC line and the teddy line can be read together as a hand-off.
const CAPTION_BANK = {
  person: [
    { soc: 'Single person on approach. No identifying detail logged.', teddy: 'Someone walked in. I am not going to ask who.' },
    { soc: 'One person, no package, no vehicle. Tagged as casual contact.', teddy: 'Just a person. The frame did not get any closer.' },
    { soc: 'Person on foot, moving through the scene. Cross-ref with calendar if you need to.', teddy: 'Foot traffic. They came, they left, my tea is still warm.' }
  ],
  car: [
    { soc: 'Vehicle in frame. Plate not read. Treat as a casual pass unless followed by a person.', teddy: 'A car went by. The wheel nuts are still tight on mine.' },
    { soc: 'Car spotted. No plate capture per privacy contract.', teddy: 'Driveway visitor. None of my business, but the camera still made me log it.' }
  ],
  delivery: [
    { soc: 'Delivery vehicle on approach. Flagged for follow-up clip. No plate logged.', teddy: 'A van pulled up, a van left. I did not get the brand, the contract says I do not.' },
    { soc: 'Delivery-class vehicle. Cross-ref with front-door cam when available.', teddy: 'Courier. The package is not in the frame yet, give it a minute.' }
  ],
  truck: [
    { soc: 'Larger vehicle. Could be service, could be a resident. Verify on follow-up.', teddy: 'Big thing on wheels. The road noise is briefly interesting and then not.' }
  ],
  garbage: [
    { soc: 'Garbage run. No action. Logged for completeness.', teddy: 'Bins day. The cans are out of frame, the truck is not.' }
  ],
  package: [
    { soc: 'Package-class object left on approach. Review the clip before locking the door in your head.', teddy: 'Something was set down. The dropper did not stick around to chat.' }
  ],
  dog: [
    { soc: 'Animal on approach. Likely neighbourhood, not threat.', teddy: 'A dog walked through. Tail up. I respect the energy.' }
  ],
  cat: [
    { soc: 'Animal on approach. Tagged low priority.', teddy: 'A cat decided to be in my frame. I will allow it.' }
  ],
  animal: [
    { soc: 'Animal on approach. Lowest priority lane.', teddy: 'Wildlife. The frame belongs to them, I am just borrowing it.' }
  ],
  bird: [
    { soc: 'Bird. Lowest priority. No follow-up.', teddy: 'A bird. Loud, brief, gone.' }
  ],
  bus: [
    { soc: 'Bus in frame. Public transit pass.', teddy: 'A bus. People got off. I did not count them.' }
  ],
  motorcycle: [
    { soc: 'Motorbike. Plate not read. Treat as a casual pass.', teddy: 'A motorbike went by. Loud, fast, not here anymore.' }
  ],
  bicycle: [
    { soc: 'Bicycle. Casual contact. No plate logged.', teddy: 'A bike rolled past. I will not race them.' }
  ],
  backpack: [
    { soc: 'Bag-class object left behind. Cross-ref if person returns for it.', teddy: 'Someone left a bag. The owner is probably still close.' }
  ],
  handbag: [
    { soc: 'Bag left behind. Tag for follow-up.', teddy: 'A bag was set down. Not my bag, not my problem, but the camera is keeping score.' }
  ],
  suitcase: [
    { soc: 'Suitcase in frame. Likely a pickup, not a drop. Tag accordingly.', teddy: 'A suitcase. Someone is going somewhere, or coming back from it.' }
  ],
  horse: [
    { soc: 'Large animal. Low threat, high noise. Logged for fun.', teddy: 'A horse. I am not built for this.' }
  ],
  sheep: [
    { soc: 'Flock-class. If there is one, there are more.', teddy: 'Sheep. Plural implied. I am not going to count them.' }
  ],
  cow: [
    { soc: 'Large animal. Low threat. Logged.', teddy: 'A cow. Loud, slow, and apparently in the way of the camera.' }
  ],
  fallback: [
    { soc: 'Unknown object on camera. Classifier is being honest about the limit.', teddy: 'Something is in the frame. The model is not going to lie about it.' }
  ]
};

const EMPTY_STATE_BY_HOUR = (() => {
  // Quiet hours get teddy's grumpier copy. Daytime gets a normal watch note.
  return {
    night: 'Quiet house. The camera is awake, I am barely.',
    morning: 'Watching the door. Tea first, then threats.',
    midday: 'Front of the house, no motion. I will tell you when something changes.',
    evening: 'Watching. The light is bad. I am blaming the light.',
    default: 'Camera is up. No motion in the rolling window.'
  };
})();

let cachedToken = null;
let cachedTokenMtime = 0;
let sessionCookieJar = '';
let lastItemsFingerprint = '';

function readToken() {
  try {
    const stat = fs.statSync(TEDDYCAMERA_TOKEN_FILE);
    if (cachedToken && stat.mtimeMs === cachedTokenMtime) return cachedToken;
    const text = fs.readFileSync(TEDDYCAMERA_TOKEN_FILE, 'utf8').trim();
    if (text) {
      cachedToken = text;
      cachedTokenMtime = stat.mtimeMs;
      return cachedToken;
    }
  } catch (_) {}
  return null;
}

function teddycameraUpstreamOptions() {
  return {
    host: TEDDYCAMERA_DEFAULT_HOST,
    port: TEDDYCAMERA_DEFAULT_PORT,
    token: readToken()
  };
}

function extractSetCookies(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function mergeCookies(existing, newRawCookies) {
  const map = new Map();
  for (const piece of existing.split(';').map(s => s.trim()).filter(Boolean)) {
    const eq = piece.indexOf('=');
    if (eq > 0) map.set(piece.slice(0, eq), piece.slice(eq + 1));
  }
  for (const raw of newRawCookies) {
    const first = raw.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) map.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function requestUpstream(targetPath, headers) {
  const t0 = Date.now();
  return new Promise(resolve => {
    const opts = teddycameraUpstreamOptions();
    log('upstream.req', { path: targetPath, host: opts.host, port: opts.port, has_token: !!opts.token, has_session: !!sessionCookieJar });
    const req = http.request({
      host: opts.host,
      port: opts.port,
      method: 'GET',
      path: targetPath,
      headers: { Accept: 'application/json', 'User-Agent': 'TeddyHomebase/1.0', ...headers },
      timeout: 8000
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const setCookies = extractSetCookies(res.headers);
        if (setCookies.length) sessionCookieJar = mergeCookies(sessionCookieJar, setCookies);
        log('upstream.res', { path: targetPath, status: res.statusCode, bytes: chunks.reduce((a, c) => a + c.length, 0), latency_ms: Date.now() - t0, cookies_set: setCookies.length });
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });
    req.on('timeout', () => {
      log('upstream.timeout', { path: targetPath, latency_ms: Date.now() - t0 });
      req.destroy(new Error('upstream timeout'));
    });
    req.on('error', e => {
      log('upstream.error', { path: targetPath, error: e.message, latency_ms: Date.now() - t0 });
      resolve({ status: 0, headers: {}, body: Buffer.alloc(0), error: e.message });
    });
    req.end();
  });
}

async function ensureSession() {
  if (sessionCookieJar) return;
  await requestUpstream('/', {});
}

function buildAuthHeaders() {
  const headers = {};
  if (sessionCookieJar) headers['Cookie'] = sessionCookieJar;
  const token = readToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function pathnameMatches(pathname) {
  if (FORWARDED_PATHS.has(pathname)) return true;
  for (const p of FORWARDED_PATHS) {
    if (p.endsWith('/') && pathname.startsWith(p)) return true;
  }
  return false;
}

function proxyToTeddyCamera(pathname, parsedUrl, res) {
  const search = parsedUrl.search || '';
  // The homebase path /teddycam/* is a public-facing alias for the camera
  // server's root. Strip the /teddycam prefix before forwarding, since the
  // camera server itself doesn't know about the alias.
  let cameraPath = pathname;
  if (cameraPath === '/teddycam' || cameraPath === '/teddycam/') cameraPath = '/';
  else if (cameraPath.startsWith('/teddycam/')) cameraPath = cameraPath.slice('/teddycam'.length);
  const targetPath = cameraPath + search;
  ensureSession()
    .then(() => requestUpstream(targetPath, buildAuthHeaders()))
    .then(upstream => {
      const outHeaders = { 'Access-Control-Allow-Origin': '*' };
      const contentType = upstream.headers['content-type'];
      if (contentType) outHeaders['Content-Type'] = contentType;
      res.writeHead(upstream.status || 502, outHeaders);
      res.end(upstream.body);
    })
    .catch(e => sendError(res, `Teddy Camera upstream error: ${e.message}`, 502));
}

// Cache for rotated thumbs. Keyed by source path. Avoids re-running
// Pillow on every widget poll (30s) when the underlying file is unchanged.
const THUMB_CACHE_DIR = process.env.TEDDYCAMERA_THUMB_CACHE
  || path.join(os.homedir(), '.cache', 'teddy-house', 'thumbs-rotated');
try { fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true }); } catch (_) {}

const THUMB_PYTHON = process.env.TEDDYCAMERA_PYTHON
  || '/Users/teddyclaw/Documents/Codex/2026-06-25/teddycamera/.venv/bin/python3';

function rotateThumbIfPortrait(bodyBuffer, sourceId) {
  return new Promise((resolve) => {
    // Look up cached rotated version.
    const cacheKey = crypto.createHash('sha1').update(bodyBuffer).digest('hex').slice(0, 16);
    const cachePath = path.join(THUMB_CACHE_DIR, `${sourceId}-${cacheKey}.jpg`);
    try {
      const stat = fs.statSync(cachePath);
      if (stat.isFile() && stat.size > 0) {
        return resolve({ body: fs.readFileSync(cachePath), rotated: true, cached: true });
      }
    } catch (_) {}

    // Spawn Python to detect orientation and rotate if portrait.
    const script = `
import sys, io
from PIL import Image
data = sys.stdin.buffer.read()
img = Image.open(io.BytesIO(data))
if img.height > img.width:
    img = img.rotate(-90, expand=True)
    buf = io.BytesIO()
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(buf, format='JPEG', quality=85, optimize=True)
    sys.stdout.buffer.write(buf.getvalue())
else:
    sys.stdout.buffer.write(data)
`;
    const child = spawn(THUMB_PYTHON, ['-c', script], { timeout: 8000 });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', d => chunks.push(d));
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => resolve({ body: bodyBuffer, rotated: false, error: e.message }));
    child.on('close', code => {
      if (code !== 0 || !chunks.length) {
        log('thumb.rotate.error', { source_id: sourceId, code, stderr: stderr.slice(0, 200) });
        return resolve({ body: bodyBuffer, rotated: false, error: 'rotate failed' });
      }
      const out = Buffer.concat(chunks);
      try { fs.writeFileSync(cachePath, out); } catch (_) {}
      log('thumb.rotate.ok', { source_id: sourceId, bytes_in: bodyBuffer.length, bytes_out: out.length });
      resolve({ body: out, rotated: true, cached: false });
    });
    child.stdin.write(bodyBuffer);
    child.stdin.end();
  });
}

function handleThumbProxy(targetPath, res) {
  ensureSession()
    .then(() => requestUpstream(targetPath, buildAuthHeaders()))
    .then(async (upstream) => {
      if (upstream.status !== 200) {
        res.writeHead(upstream.status || 502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': upstream.headers['content-type'] || 'application/octet-stream' });
        res.end(upstream.body);
        return;
      }
      const sourceId = path.basename(targetPath, '.jpg') || 'unknown';
      const result = await rotateThumbIfPortrait(upstream.body, sourceId);
      const outHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300' };
      res.writeHead(200, outHeaders);
      res.end(result.body);
    })
    .catch(e => sendError(res, `Teddy thumb proxy error: ${e.message}`, 502));
}

function relativeAge(ageSeconds) {
  if (ageSeconds == null) return null;
  const s = Math.max(0, Math.floor(ageSeconds));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function captionFor(labels, kindHint) {
  // Pick the most specific known label first, then fall back.
  // kindHint lets the timeline-driven path use the highlight kind (e.g. "delivery")
  // even when the only detector label is "car".
  const order = [];
  if (kindHint) order.push(kindHint);
  for (const l of labels) order.push(l);
  order.push('fallback');
  for (const key of order) {
    const bank = CAPTION_BANK[key];
    if (bank && bank.length) {
      // Deterministic pick based on labels hash so the same event gets the same line.
      const idx = (labels.join('|') + '|' + (kindHint || '')).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % bank.length;
      return bank[idx];
    }
  }
  return CAPTION_BANK.fallback[0];
}

function formatDetectionMessage(detection, options = {}) {
  if (!detection) return null;
  const labels = Array.isArray(detection.labels) && detection.labels.length ? detection.labels : ['person'];
  const primary = labels.find(l => FRIENDLY_LABEL_GROUPS[l]) || labels[0];
  const group = FRIENDLY_LABEL_GROUPS[primary] || FRIENDLY_LABEL_GROUPS.person;
  const age = relativeAge(detection.age_seconds);
  const labelText = labels.length > 1 ? `${group.noun} + ${labels.length - 1} more` : group.noun;

  // Hand-off line: GSOC analyst writes the time-stamped ops line.
  // teddy writes the dry ground-level note below it.
  const bank = captionFor(labels, options.kindHint || detection.kind || null);
  const ageText = age ? ` ${age}` : '';
  const message = `${group.icon} ${labelText} ${group.verb}${ageText}.`;

  return {
    id: detection.id,
    icon: group.icon,
    label: labelText,
    message,
    verb: group.verb,
    age_seconds: detection.age_seconds ?? null,
    captured_at: detection.captured_at,
    thumb_url: detection.thumb_url || null,
    source: detection.source || null,
    severity: detection.severity || null,
    labels,
    soc: bank.soc,
    teddy: bank.teddy,
    hand_off: `${bank.soc}  //  ${bank.teddy}`,
    kind: options.kindHint || detection.kind || primary
  };
}

function buildEventsFeed(eventsPayload) {
  const events = Array.isArray(eventsPayload?.events) ? eventsPayload.events : [];
  const items = [];
  for (const ev of events) {
    const labels = Array.isArray(ev.labels) && ev.labels.length ? ev.labels : null;
    if (!labels) continue;
    // Skip the low-info "detector-latest" / "motion-latest" placeholders — they
    // are summary rows from /api/events that duplicate the highlight entries.
    if (ev.id === 'detector-latest' || ev.id === 'motion-latest' || ev.id === 'status-latest') continue;
    const kindHint = ev.event_type || ev.type || null;
    const f = formatDetectionMessage({
      id: ev.id,
      captured_at: ev.captured_at,
      age_seconds: ev.age_seconds,
      labels,
      thumb_url: ev.thumb_url,
      source: ev.source,
      severity: ev.severity
    }, { kindHint });
    if (!f) continue;
    items.push(f);
  }
  return items;
}

function mergeTimelineIntoFeed(timelinePayload, friendly) {
  const highlights = Array.isArray(timelinePayload?.highlights) ? timelinePayload.highlights : [];
  const seen = new Set(friendly.map(i => (i.captured_at || '') + '|' + (i.labels || []).sort().join('|')));
  for (const h of highlights) {
    if (h.status !== 'seen' && h.status !== 'candidate') continue;
    if (!h.signal) continue;
    const signalLabels = Array.isArray(h.signal) ? h.signal : [h.signal];
    const key = (h.last_seen_at || '') + '|' + signalLabels.sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const friendly2 = formatDetectionMessage({
      id: h.id,
      captured_at: h.last_seen_at,
      age_seconds: h.age_seconds,
      labels: signalLabels,
      thumb_url: h.thumb_url,
      source: h.source,
      severity: null,
      title: h.title,
      caption: h.caption
    }, { kindHint: h.kind });
    if (friendly2) {
      friendly2.kind = h.kind;
      friendly2.status = h.status;
      friendly.push(friendly2);
    }
  }
}

function fetchTeddyCameraJson(pathname) {
  return ensureSession()
    .then(() => requestUpstream(pathname, buildAuthHeaders()))
    .then(res => {
      const body = res.body.toString('utf8');
      try { return { status: res.status, data: JSON.parse(body) }; }
      catch (e) { return { status: res.status, data: null, error: e.message }; }
    });
}

function queryTeddyDbEvents(lookbackHours, limit) {
  return new Promise(resolve => {
    const script = `
      import('./server/lib/teddydb.mjs').then(async (m) => {
        try {
          const events = m.queryRecentTeddyDbEvents({ hours: ${Number(lookbackHours) || 48}, limit: ${Number(limit) || 30} });
          const filtered = events.filter(e => {
            const t = e.event_type;
            return t === 'person' || t === 'vehicle' || t === 'delivery' || t === 'package' || t === 'animal' || t === 'garbage';
          });
          process.stdout.write(JSON.stringify({ ok: true, events: filtered }));
        } catch (e) {
          process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
        }
      }).catch(e => process.stdout.write(JSON.stringify({ ok: false, error: e.message })));
    `;
    const child = spawn(TEDDYCAMERA_NODE, ['--input-type=module', '-e', script], {
      cwd: TEDDYCAMERA_REPO,
      timeout: 8000,
      env: process.env
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        resolve({ ok: false, error: `parse error: ${e.message} | stderr: ${stderr.slice(0, 200)}` });
      }
    });
    child.on('error', e => resolve({ ok: false, error: e.message }));
  });
}

function formatTeddyDbEvent(ev) {
  const labels = Array.isArray(ev.labels) && ev.labels.length ? ev.labels : null;
  if (!labels) return null;
  const captured = ev.captured_at || ev.capturedAt;
  if (!captured) return null;
  const capturedMs = Date.parse(captured);
  if (Number.isNaN(capturedMs)) return null;
  const ageSeconds = Math.max(0, Math.floor((Date.now() - capturedMs) / 1000));
  const isSimulated = (ev.source || '').includes('simulated');
  const friendly = formatDetectionMessage({
    id: ev.id,
    captured_at: captured,
    age_seconds: ageSeconds,
    labels,
    thumb_url: ev.thumb_url || null,
    source: ev.source,
    severity: ev.severity
  }, { kindHint: ev.event_type || null });
  if (!friendly) return null;
  if (isSimulated) {
    // Don't pollute the SOC line. Just append a quiet test marker to teddy's note.
    friendly.teddy = friendly.teddy + '  //  test trigger, not a real capture.';
    friendly.hand_off = `${friendly.soc}  //  ${friendly.teddy}`;
  }
  return friendly;
}

async function buildFeedForWidget() {
  const t0 = Date.now();
  log('feed.step', { step: 'fetch.events' });
  const eventsRes = await fetchTeddyCameraJson('/api/events');
  log('feed.step', { step: 'fetch.events.done', status: eventsRes.status, has_data: !!eventsRes.data });
  log('feed.step', { step: 'fetch.timeline' });
  const timelineRes = await fetchTeddyCameraJson('/api/timeline');
  log('feed.step', { step: 'fetch.timeline.done', status: timelineRes.status, has_data: !!timelineRes.data });

  let friendly = [];
  let capturedAt = null;
  let primaryError = null;

  // Build the rich semantic events first (they have titles and captions)
  if (eventsRes.status === 200 && eventsRes.data) {
    capturedAt = eventsRes.data.captured_at || capturedAt;
    friendly = buildEventsFeed(eventsRes.data);
    log('feed.step', { step: 'build.events', items: friendly.length });
  } else {
    primaryError = `events returned ${eventsRes.status}`;
    log('feed.step', { step: 'build.events.skipped', status: eventsRes.status });
  }

  // Augment with timeline highlights that aren't already in the feed
  if (timelineRes.status === 200 && timelineRes.data) {
    capturedAt = timelineRes.data.captured_at || capturedAt;
    const before = friendly.length;
    mergeTimelineIntoFeed(timelineRes.data, friendly);
    log('feed.step', { step: 'merge.timeline', added: friendly.length - before });
  } else if (!primaryError) {
    primaryError = `timeline returned ${timelineRes.status}`;
    log('feed.step', { step: 'merge.timeline.skipped', status: timelineRes.status });
  }

  log('feed.step', { step: 'fetch.teddydb' });
  const dbRes = await queryTeddyDbEvents(48, 30);
  if (dbRes.ok && Array.isArray(dbRes.events)) {
    const seen = new Set(friendly.map(i => (i.captured_at || '') + '|' + (i.labels || []).sort().join('|')));
    let added = 0;
    for (const ev of dbRes.events) {
      const f = formatTeddyDbEvent(ev);
      if (!f) continue;
      const key = (f.captured_at || '') + '|' + (f.labels || []).sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      friendly.push(f);
      added += 1;
    }
    log('feed.step', { step: 'fetch.teddydb.done', db_events: dbRes.events.length, added });
  } else {
    log('feed.step', { step: 'fetch.teddydb.skipped', ok: dbRes.ok, error: dbRes.error || null });
  }

  friendly.sort((a, b) => (a.age_seconds ?? 1e9) - (b.age_seconds ?? 1e9));
  const beforeSlice = friendly.length;
  friendly = friendly.slice(0, 12);
  log('feed.step', { step: 'finalize', sorted_from: beforeSlice, kept: friendly.length, total_ms: Date.now() - t0 });

  // Per-item log so the user can see "at 3:45pm a car was detected" without
  // reading the entire feed JSON. Only fires for items that are NEW vs the
  // last poll (or for the first item we ever see).
  const itemsFingerprint = friendly.map(i => (i.captured_at || '') + '|' + (i.labels || []).sort().join('|') + '|' + (i.kind || '')).join(';');
  if (itemsFingerprint !== lastItemsFingerprint) {
    if (lastItemsFingerprint && friendly.length > 0) {
      // log only NEW items so the file doesn't explode with one line per poll
      const prev = new Set(lastItemsFingerprint.split(';').filter(Boolean));
      for (const it of friendly) {
        const sig = (it.captured_at || '') + '|' + (it.labels || []).sort().join('|') + '|' + (it.kind || '');
        if (!prev.has(sig)) {
          log('detection.new', {
            captured_at: it.captured_at,
            age_seconds: it.age_seconds,
            labels: it.labels,
            kind: it.kind,
            message: it.message,
            thumb_url: it.thumb_url
          });
        }
      }
    } else if (lastItemsFingerprint === '' && friendly.length > 0) {
      // first call — log each item as a one-time event so the log starts with state
      for (const it of friendly) {
        log('detection.new', {
          captured_at: it.captured_at,
          age_seconds: it.age_seconds,
          labels: it.labels,
          kind: it.kind,
          message: it.message,
          thumb_url: it.thumb_url
        });
      }
    }
    lastItemsFingerprint = itemsFingerprint;
  }

  if (!capturedAt && !friendly.length) {
    log('feed.step', { step: 'result.empty', primary_error: primaryError });
    return {
      ok: false,
      source: 'teddy-camera',
      upstream_status: timelineRes.status || eventsRes.status || 0,
      error: primaryError || 'no data from upstream',
      items: [],
      last_updated: new Date().toISOString()
    };
  }

  return {
    ok: true,
    source: 'teddy-camera',
    captured_at: capturedAt,
    last_updated: new Date().toISOString(),
    item_count: friendly.length,
    items: friendly
  };
}

function handle(req, res, pathname, parsedUrl) {
  log('handle.in', { pathname, method: req.method });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 'Method not allowed', 405);
    return true;
  }
  if (pathname === '/api/teddy-camera/feed') {
    const t0 = Date.now();
    buildFeedForWidget()
      .then(payload => {
        const dt = Date.now() - t0;
        log('feed', {
          ok: payload.ok,
          item_count: payload.item_count,
          upstream_status: payload.upstream_status || null,
          latency_ms: dt,
          error: payload.error || null
        });
        sendJson(res, 200, payload);
      })
      .catch(e => {
        log('feed.error', { error: e.message, stack: e.stack });
        sendError(res, e.message, 500);
      });
    return true;
  }
  if (pathname === '/api/teddy-camera/health') {
    fetchTeddyCameraJson('/api/status')
      .then(r => {
        log('health', { ok: r.status === 200, upstream_status: r.status });
        sendJson(res, r.status === 200 ? 200 : 502, {
          ok: r.status === 200,
          upstream_status: r.status,
          last_updated: new Date().toISOString()
        });
      })
      .catch(e => {
        log('health.error', { error: e.message });
        sendError(res, e.message, 500);
      });
    return true;
  }
  if (pathnameMatches(pathname)) {
    const t0 = Date.now();
    log('proxy.in', { pathname, query: parsedUrl?.search || '' });
    const wrapped = wrapResponseForLog(res, pathname, t0);
    if (pathname.startsWith('/thumbs/')) {
      // Thumbs go through the rotate-on-portrait handler so a 960x2080
      // portrait frame renders as landscape in the widget.
      handleThumbProxy(pathname, wrapped);
    } else {
      proxyToTeddyCamera(pathname, parsedUrl, wrapped);
    }
    return true;
  }
  return false;
}

module.exports = function() {
  return { handle };
};

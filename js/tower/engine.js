'use strict';
/**
 * Lobster Tower engine: builds the building from a dashboard's widgets, lays out floors, moves the
 * avatars (walking, shared elevators), draws the sky and weather, and opens a room's cards on click.
 * The catalog (which widget lives where) is js/tower/catalog.js; live data comes from js/tower/live.js.
 */
const A = p => `tower/assets/${p}`;
const CATALOG = window.TOWER_CATALOG, ROOMS = window.TOWER_ROOMS, AI_TOOLS = window.TOWER_AI;
const GROUP_ORDER = window.TOWER_GROUPS.order, WORK_GROUPS = window.TOWER_GROUPS.work;

/* Demo dashboards. Inside LobsterBoard the list comes from the page's own config. */
const PRESETS = {
  all:       { name: 'Everything', types: null },
  media:     { name: 'Media server', types: ['media-plex', 'media-radarr', 'media-sonarr', 'media-seerr', 'media-prowlarr', 'media-sabnzbd', 'weather', 'clock', 'text-header'] },
  homelab:   { name: 'Homelab', types: ['media-plex', 'media-radarr', 'media-sonarr', 'media-sabnzbd', 'cpu-memory', 'disk-usage', 'uptime-monitor', 'docker-containers', 'network-speed', 'api-status', 'weather', 'clock', 'lobsterboard-release', 'release'] },
  developer: { name: 'Developer', types: ['claude-code', 'codex-cli', 'cursor', 'github-copilot', 'ai-cost-tracker', 'github-stats', 'todo-list', 'pomodoro', 'calendar', 'email-count', 'rss-ticker', 'now-playing', 'clock', 'countdown', 'weather', 'cpu-memory', 'lobsterboard-release'] },
};
/* The owner's own dashboard (from /config) and the Tower widget's settings. */
let MINE = null;
const SETTINGS = { sleepHours: 2, hidden: [] };
const dashboardFor = key => key === 'mine' ? MINE : (PRESETS[key].types || Object.keys(CATALOG)).map((type, i) => ({ id: `w${i}`, type, properties: {} }));
const HEADER_TEXT = 'LOBSTER TOWER';

/* Rooms the owner has switched off. Inside LobsterBoard this is saved in the Tower widget's settings;
   here it lives in this browser only. Shared rooms can't be hidden: avatars need them. */
const HIDEABLE = k => !ROOMS[k].shared;
let HIDDEN = new Set();
try { HIDDEN = new Set(JSON.parse(localStorage.getItem('tower.hidden') || '[]')); } catch (e) {}
const isHidden = room => HIDDEN.has(room) || SETTINGS.hidden.includes(room);
function saveHidden() { try { localStorage.setItem('tower.hidden', JSON.stringify([...HIDDEN])); } catch (e) {} }

/* ---------- helpers ---------- */
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function countdownDays() { const t = new Date(new Date().getFullYear(), 11, 25); if (t < new Date()) t.setFullYear(t.getFullYear() + 1); return Math.ceil((t - new Date()) / 864e5); }

const STATES = ['working', 'idle', 'sleep', 'gym', 'alert'];
const STATE_LABEL = { working: 'Working', idle: 'Break', sleep: 'Asleep', gym: 'Housekeeping', alert: 'Alert' };
const STATE_COLOR = { working: 'var(--ok)', idle: 'var(--warn)', sleep: 'var(--sleep)', gym: 'var(--gym)', alert: 'var(--bad)' };
const SAB = {
  walk: [0, 1, 2, 3, 4, 5].map(i => A(`tony/walk-${i}.webp`)), lift: [0, 1, 2, 2, 1, 0].map(i => A(`tony/lift-${i}.webp`)),
  work: [A('tony/work-0.webp'), A('tony/work-1.webp'), A('tony/work-1.webp'), A('tony/door.webp')], ride: A('tony/ride.webp'),
};

/* ============================================================
   MODEL: rooms, stations, avatars and wall pieces for a dashboard
   ============================================================ */
let M = null;
function buildModel(dashboard) {
  const m = { rooms: {}, avatars: [], pieces: [], panels: [], roof: { clock: false, billboard: false, sky: false, sign: HEADER_TEXT } };
  const need = new Set(['dorm', 'gym', 'lobby', 'cafe', 'basement']);
  for (const w of dashboard) {
    const c = CATALOG[w.type]; if (!c) continue;
    if (isHidden(c.room)) continue;                             // the owner switched this room off
    if (c.room === 'roof' && c.piece === 'sign' && w.properties && w.properties.title) m.roof.sign = String(w.properties.title).slice(0, 40);
    if (c.room === 'roof') { if (c.piece === 'clocktower') m.roof.clock = true; if (c.piece === 'billboard') m.roof.billboard = true; if (c.piece === 'sky') m.roof.sky = true; continue; }
    need.add(c.room);
    if (c.avatar) m.avatars.push(newAvatar(w, c));
    else if (c.piece === 'panel') m.panels.push({ w, c, state: 'idle', s: rnd(5, 60), wk: rnd(5, 50) });
    else m.pieces.push({ w, c, room: c.room });
  }
  for (const key of need) {
    const R = ROOMS[key];
    const stations = m.avatars.filter(a => a.c.room === key);
    const pieces = m.pieces.filter(p => p.room === key);
    let units = R.ar || Math.max(R.minUnits || 1.4, .6 + stations.length * .62 + pieces.length * .35);
    if (R.agentwall) units = Math.max(1.6, .5 + Math.ceil(m.panels.length / 3) * .55);
    m.rooms[key] = { key, R, stations, pieces, units, base: units };
  }
  // shared rooms grow with the cast
  const n = m.avatars.length;
  const r = m.rooms;
  r.cafe.tables = Math.max(3, Math.ceil(n * .45 / 2)); r.cafe.units = Math.max(2.33, r.cafe.tables * .78 + .3);
  r.dorm.beds = Math.max(3, Math.ceil(n * .35)); r.dorm.units = Math.max(2.33, r.dorm.beds * .86 + .25);
  r.gym.spots = Math.max(4, Math.ceil(n * .3)); r.gym.units = Math.max(2.33, r.gym.spots * .5);
  r.basement.spots = Math.max(4, Math.ceil(n * .25)); r.basement.units = Math.max(1.4, r.basement.spots * .45);
  return m;
}
function newAvatar(w, c) {
  const hue = [...w.type].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return { id: w.id, type: w.type, widget: w, c, label: c.label, color: `hsl(${hue} 55% 52%)`, state: 'working', want: 'working',
           floor: 0, x: 0, plan: [], mode: 'pose', pose: 'working', flip: false, slot: null, timer: 0, frameT: 0, riding: null, el: null };
}

/* ============================================================
   LAYOUT: pack rooms into floors, choose the room width that makes the building biggest
   ============================================================ */
const SH = .62, SLAB = .07, ROOF = 1.5, STRETCH = 1.3;
const ROOF_WX = { h: 458, screen: { x: 33.6, y: 42.4, w: 32.2, h: 24 } };   // roof-weather.webp height (600 wide) and its blank screen, in %
const TILED = new Set(['basement', 'dorm', 'cafe', 'gym']);   // shared rooms that grow: their art repeats sideways
let G = null;
function packFloors(C) {
  const rooms = M.rooms, floors = [];
  const pack = keys => {
    let row = [], used = 0;
    for (const k of keys) {
      const u = rooms[k].units;
      if (row.length && used + u > C) { floors.push(row); row = []; used = 0; }
      row.push(k); used += u;
    }
    if (row.length) floors.push(row);
  };
  const byGroup = g => Object.keys(ROOMS).filter(k => rooms[k] && ROOMS[k].group === g);
  for (const g of GROUP_ORDER) pack(g === 'work*' ? WORK_GROUPS.flatMap(byGroup) : byGroup(g));
  return floors;
}
function layout() {
  const main = document.querySelector('main');
  const vw = main.clientWidth - 32, vh = main.clientHeight - 20;
  // shrink the shared rooms to what a floor can hold before choosing a width
  let best = null;
  for (let C = 6.5; C <= 15; C += .25) {
    const floors = packFloors(C);
    const H = Math.min(vw / (C + 2 * SH), vh / (ROOF + floors.length * (1 + SLAB) + SLAB));
    if (!best || H > best.H + .01) best = { C, floors, H };
  }
  const { C, floors } = best, H = Math.floor(best.H);
  const g = { H, C, sh: SH * H, slab: SLAB * H, roof: ROOF * H, inner: C * H, W: (C + 2 * SH) * H, floors: [], rooms: {}, walls: [] };
  floors.forEach((keys, i) => {
    const top = g.roof + g.slab + i * (H + g.slab);
    // Fill the floor: placeholder and tiled rooms widen freely, art rooms stretch at most STRETCH,
    // and whatever is left becomes a hallway.
    const units = keys.map(k => M.rooms[k].units), sum = units.reduce((a, b) => a + b, 0);
    const flexible = keys.map(k => !ROOMS[k].art || TILED.has(k));
    let spare = Math.max(0, C - sum);
    const widths = units.slice();
    const flexSum = units.reduce((a, u, j) => a + (flexible[j] ? u : 0), 0);
    if (flexSum > 0) { keys.forEach((_, j) => { if (flexible[j]) widths[j] += spare * units[j] / flexSum; }); spare = 0; }
    else { const k = Math.min(STRETCH, C / sum); keys.forEach((_, j) => widths[j] = units[j] * k); }
    let x = g.sh;
    keys.forEach((key, j) => {
      const w = widths[j] * H;
      g.rooms[key] = { key, floor: i, x, w, top, h: H };
      if (j > 0) g.walls.push({ floor: i, x });
      x += w;
    });
    const hall = g.W - g.sh - x;
    g.floors.push({ top, bottom: top + H, keys, hall: hall > 2 ? { x, w: hall } : null });
    if (hall > 2) g.walls.push({ floor: i, x });
  });
  g.walkY = i => g.floors[i].bottom - .06 * H;
  g.shaftX = s => s === 'L' ? g.sh / 2 : g.W - g.sh / 2;
  g.landX = s => s === 'L' ? g.sh + .2 * H : g.W - g.sh - .2 * H;
  return g;
}

/* ---------- slots: stations, seats, beds, gym and basement spots (px within the tower) ---------- */
function stationSpot(a) {
  const room = M.rooms[a.c.room], g = G.rooms[a.c.room], i = room.stations.indexOf(a);
  const spots = room.R.spots || [];
  const s = spots[i] || { x: stationSpotPct(room, i) };
  return { floor: g.floor, x: g.x + g.w * s.x / 100, pose: a.c.cast ? (s.pose || 'working') : 'working', h: s.h, b: s.b, flip: s.flip, desk: !room.R.art };
}
function sharedSlots() {
  const S = { idle: [], sleep: [], bags: [], gym: [], alert: [] };
  const cafe = G.rooms.cafe, T = M.rooms.cafe.tables, H = G.H;
  for (let i = 0; i < T; i++) { const x = cafe.x + cafe.w * (i + .5) / T; S.idle.push({ x: x - .2 * H, flip: false }, { x: x + .2 * H, flip: true }); }
  M.rooms.cafe.tableX = Array.from({ length: T }, (_, i) => (i + .5) / T * 100);
  const dorm = G.rooms.dorm, beds = Math.max(1, Math.floor((dorm.w - .1 * H) / (.86 * H)));
  M.rooms.dorm.bedX = Array.from({ length: beds }, (_, i) => (i + .5) / beds * 100);
  for (const p of M.rooms.dorm.bedX) S.sleep.push({ x: dorm.x + dorm.w * p / 100 });
  for (let i = 0; i < beds; i++) S.bags.push({ x: dorm.x + dorm.w * (i + .5) / beds + .43 * H * (i % 2 ? 1 : -1) * .5, bag: true });
  const gym = G.rooms.gym, gn = M.rooms.gym.spots;
  for (let i = 0; i < gn; i++) S.gym.push({ x: gym.x + gym.w * (.15 + .7 * (i + .5) / gn) });
  const b = G.rooms.basement, bn = M.rooms.basement.spots;
  for (let i = 0; i < bn; i++) S.alert.push({ x: b.x + b.w * (.12 + .76 * (i + .5) / bn) });
  for (const k in S) S[k].forEach(s => s.taken = null);
  return S;
}
let SLOTS = null;
function claim(list, a) { const s = list.find(s => !s.taken); if (s) s.taken = a; return s || null; }
function release(a) { if (a.slot && a.slot.ref) a.slot.ref.taken = null; }

/* Where an avatar goes for a state. Beds overflow to sleeping bags, then to a cafeteria table. */
function targetFor(a, state) {
  const floorOf = k => G.rooms[k].floor;
  if (state === 'working' || (state === 'alert' && a.c.alertStays)) return { ...stationSpot(a), state };
  if (state === 'idle') { const s = claim(SLOTS.idle, a); return s ? { floor: floorOf('cafe'), x: s.x, pose: 'sitting', flip: s.flip, ref: s, state } : { floor: floorOf('cafe'), x: G.rooms.cafe.x + G.rooms.cafe.w * .5 + rnd(-20, 20), pose: 'coffee', state }; }
  if (state === 'sleep') {
    let s = claim(SLOTS.sleep, a); if (s) return { floor: floorOf('dorm'), x: s.x, pose: 'sleeping', bed: true, ref: s, state };
    s = claim(SLOTS.bags, a); if (s) return { floor: floorOf('dorm'), x: s.x, pose: 'sleeping', bag: true, ref: s, state };
    s = claim(SLOTS.idle, a); if (s) return { floor: floorOf('cafe'), x: s.x, pose: 'sitting', flip: s.flip, ref: s, state, dozing: true };
    return { floor: floorOf('dorm'), x: G.rooms.dorm.x + G.rooms.dorm.w / 2, pose: 'sleeping', bag: true, state };
  }
  if (state === 'gym') { const s = claim(SLOTS.gym, a) || SLOTS.gym[0]; return { floor: floorOf('gym'), x: s.x, pose: 'gym', ref: s.taken === a ? s : null, state }; }
  const s = claim(SLOTS.alert, a) || SLOTS.alert[0];
  return { floor: floorOf('basement'), x: s.x, pose: 'alert', ref: s.taken === a ? s : null, state };
}

/* ============================================================
   MOVEMENT: plans of steps; elevators run a simple up/down sweep and carry several riders
   ============================================================ */
function setState(a, state) {
  if (state === a.want && a.plan.length) return;
  a.want = state;
  release(a);
  const t = targetFor(a, state);
  a.slot = t;
  if (a.riding) { a.plan = [{ t: 'ride', to: t.floor }, ...routeFrom(t.floor, G.landX(a.riding), t)]; return; }
  if (a.plan[0] && a.plan[0].t === 'call') a.plan = [];
  a.mode = 'walk';
  a.plan = routeFrom(a.floor, a.x, t);
}
function routeFrom(floor, x, t) {
  if (floor === t.floor) return [{ t: 'walk', x: t.x }, { t: 'settle' }];
  const cost = s => Math.abs(x - G.landX(s)) + Math.abs(t.x - G.landX(s)) + LIFTS[s].load() * G.H * .8;
  const side = cost('L') <= cost('R') ? 'L' : 'R';
  return [{ t: 'walk', x: G.landX(side) + (side === 'L' ? 1 : -1) * rnd(0, 8) }, { t: 'call', side, to: t.floor }, { t: 'ride', to: t.floor }, { t: 'walk', x: t.x }, { t: 'settle' }];
}

const LIFTS = {};
function makeLift(side, floor) {
  return { side, floor, y: 0, target: null, dir: 0, door: 'closed', doorT: 0, riders: [],
    load() { return this.riders.length + M.avatars.filter(a => a.plan[0] && a.plan[0].t === 'call' && a.plan[0].side === side).length; } };
}
const cabH = () => G.H * .9, cabW = () => cabH() * 441 / 700;
const cabY = f => G.floors[f].bottom - cabH();
function liftTick(L, dt) {
  const waiting = M.avatars.filter(a => a.plan[0] && a.plan[0].t === 'call' && a.plan[0].side === L.side && a.mode === 'wait');
  if (L.door === 'open') {
    // riders out, then waiting avatars in
    for (const a of [...L.riders]) if (a.plan[0].to === L.floor) {
      L.riders.splice(L.riders.indexOf(a), 1); a.riding = null; a.floor = L.floor; a.plan.shift(); a.x = G.landX(L.side); a.mode = 'walk';
    }
    for (const a of waiting) if (a.floor === L.floor && L.riders.length < 4) {
      a.plan.shift(); a.riding = L.side; L.riders.push(a); a.mode = 'ride';
    }
    L.doorT -= dt;
    if (L.doorT <= 0) { L.door = 'closing'; L.doorT = .5; }
    return;
  }
  if (L.door === 'closing') { L.doorT -= dt; if (L.doorT <= 0) L.door = 'closed'; return; }
  const stops = new Set([...L.riders.map(a => a.plan[0].to), ...waiting.map(a => a.floor)]);
  if (L.target == null) {
    if (!stops.size) return;
    if (stops.has(L.floor)) { L.door = 'open'; L.doorT = 1.3; return; }
    const ahead = [...stops].filter(f => L.dir >= 0 ? f > L.floor : f < L.floor);
    const pool = ahead.length ? ahead : [...stops];
    L.target = pool.reduce((b, f) => Math.abs(f - L.floor) < Math.abs(b - L.floor) ? f : b);
    L.dir = Math.sign(L.target - L.floor);
  }
  const ty = cabY(L.target), v = G.H * 1.7 * dt;
  if (Math.abs(ty - L.y) <= v) {
    L.y = ty; L.floor = L.target; L.target = null; L.door = 'open'; L.doorT = 1.3;
  } else {
    L.y += Math.sign(ty - L.y) * v;
    // stop on the way for anyone waiting at a floor we pass
    const f = G.floors.findIndex((_, i) => Math.abs(cabY(i) - L.y) < v);
    if (f >= 0 && f !== L.floor && stops.has(f) && Math.sign(f - L.floor) === L.dir) { L.target = f; }
  }
}

function avatarTick(a, dt) {
  a.frameT += dt;
  if (a.mode === 'ride') { const L = LIFTS[a.riding]; const i = L.riders.indexOf(a); a.x = G.shaftX(a.riding) + (i - (L.riders.length - 1) / 2) * G.H * .13; return; }
  const step = a.plan[0];
  if (!step) return;
  if (step.t === 'walk') {
    a.mode = 'walk';
    const d = step.x - a.x, v = G.H * .75 * dt;
    a.flip = d < 0;
    if (Math.abs(d) <= v) { a.x = step.x; a.plan.shift(); } else a.x += Math.sign(d) * v;
    a.dist = (a.dist || 0) + Math.min(Math.abs(d), v);
  } else if (step.t === 'call') { a.mode = 'wait'; a.flip = step.side === 'L'; }
  else if (step.t === 'settle') {
    a.plan.shift(); a.state = a.want; a.mode = 'pose'; a.pose = a.slot.pose; a.flip = !!a.slot.flip; a.frameT = 0;
  }
}

/* ============================================================
   DEMO: simulated data drives each avatar's state
   ============================================================ */
let demo = true;
function demoTick(dt) {
  for (const a of M.avatars) {
    a.timer -= dt;
    if (a.timer > 0) continue;
    let next;
    if (a.c.pomodoro) next = a.want === 'working' ? 'idle' : 'working';
    else {
      const w = { working: 5, idle: 2, sleep: 1, gym: a.c.gym === false ? 0 : 1.5, alert: a.c.alert === false ? 0 : .5 };
      let r = Math.random() * Object.values(w).reduce((s, v) => s + v, 0);
      next = Object.keys(w).find(k => (r -= w[k]) < 0);
    }
    a.timer = a.c.pomodoro ? (next === 'working' ? 25 : 8) : (next === 'working' ? rnd(20, 45) : rnd(12, 30));
    setState(a, next);
  }
  for (const p of M.panels) {
    p.t = (p.t || 0) - dt;
    if (p.t > 0) continue;
    p.t = rnd(6, 16);
    p.state = pick(['idle', 'working', 'working', 'working', 'near', 'limited', 'error']);
    p.s = p.state === 'idle' ? rnd(0, 30) : p.state === 'near' ? rnd(80, 95) : p.state === 'limited' ? 100 : rnd(20, 75);
    p.wk = Math.min(100, p.wk + rnd(0, 4));
    paintPanel(p);
  }
}
function paintPanel(p) {
  const el = document.getElementById('panel-' + p.w.id);
  if (el) { el.className = 'panel ' + p.state; el.querySelector('.s i').style.width = p.s + '%'; el.querySelector('.k i').style.width = p.wk + '%'; el.title = `${p.c.label}: ${p.live || p.state}`; }
}

/* ============================================================
   LIVE: real widget data drives the states (js/tower/live.js)
   ============================================================ */
let stopLive = null;
function applyLive(a, r) {
  a.live = r.read;
  let st = r.state;
  if (st === 'gym' && a.c.gym === false) st = 'working';
  if (st === 'alert' && a.c.alert === false) st = 'working';
  const now = Date.now();
  if (st !== 'idle' || !a.busyAt) a.busyAt = now;
  if (st === 'idle' && now - a.busyAt > SETTINGS.sleepHours * 3600e3) st = 'sleep';   // a long quiet spell: off to bed
  if (st !== a.want) setState(a, st);
}
let wxTimer = null;
function liveWeather() {
  const w = MINE && MINE.find(x => x.type === 'weather');
  if (!w) return;
  const sel = document.getElementById('wx');
  if (!sel.querySelector('option[value="live"]')) sel.insertAdjacentHTML('afterbegin', '<option value="live">Live</option>');
  if (sel.value === 'auto') sel.value = 'live';
  const pull = () => { if (sel.value !== 'live') return;
    window.TowerLive.weather(w).then(r => { wxAuto = false; WX.place = r.place; WX.unit = r.unit; setWeather(r.kind, r.temp); }).catch(() => {}); };
  pull(); clearInterval(wxTimer); wxTimer = setInterval(pull, 10 * 60 * 1000);
}
function startLive() {
  liveWeather();
  stopLive = window.TowerLive.start(M, {
    onAvatar: applyLive,
    onPanel: (p, r) => { p.state = r.state; p.s = Math.round(r.s); p.wk = Math.round(r.wk); p.live = r.read; paintPanel(p); },
  });
}

/* ============================================================
   RENDER
   ============================================================ */
const tower = document.getElementById('tower');
function render() {
  G = layout();
  SLOTS = sharedSlots();
  const { H } = G;
  tower.style.width = G.W + 'px';
  tower.style.height = (G.floors.at(-1).bottom + G.slab) + 'px';
  let h = roofHtml();
  G.floors.forEach((f, i) => {
    h += `<div class="slab" style="left:0;width:${G.W}px;top:${f.top - G.slab}px;height:${G.slab}px"><div class="snowcap" style="display:${i ? 'none' : 'block'}"></div></div>`;
    for (const key of f.keys) h += roomHtml(key);
    if (f.hall) h += `<div class="room hall" style="left:${f.hall.x}px;top:${f.top}px;width:${f.hall.w}px;height:${H}px" aria-hidden="true"></div>`;
  });
  h += `<div class="slab" style="left:0;width:${G.W}px;top:${G.floors.at(-1).bottom}px;height:${G.slab}px"></div>`;
  const dh = H * .72, wt = H * .07;
  for (const w of G.walls) {
    const f = G.floors[w.floor], top = G.walkY(w.floor) - dh;
    h += `<div class="wall" style="left:${w.x - wt / 2}px;top:${f.top}px;width:${wt}px;height:${top - f.top}px"></div>
          <div class="wall" style="left:${w.x - wt / 2}px;top:${G.walkY(w.floor)}px;width:${wt}px;height:${f.bottom - G.walkY(w.floor)}px"></div>
          <div class="lintel" style="left:${w.x - wt / 2 - 2}px;top:${top - 3}px;width:${wt + 4}px;height:4px"></div>`;
  }
  const top0 = G.floors[0].top, bot = G.floors.at(-1).bottom;
  for (const side of ['L', 'R']) {
    const x0 = side === 'L' ? 0 : G.W - G.sh;
    h += `<div class="shaft" style="left:${x0}px;top:${top0}px;width:${G.sh}px;height:${bot - top0}px;background-size:${G.sh}px ${H + G.slab}px"></div>
          <div class="cable" id="cable${side}" style="left:${x0 + G.sh / 2 - 1.5}px;top:${top0}px"></div>
          <div class="cab" id="cab${side}"><img alt="" src="${A('cab.webp')}"></div><div class="gate" id="gate${side}"></div>`;
    const ground = G.rooms.lobby.floor;
    G.floors.forEach((f, i) => { h += `<div class="floorno" style="left:${x0}px;width:${G.sh}px;top:${f.top + 2}px">${i === ground ? 'G' : i < ground ? 'F' + (ground - i) : 'B' + (i - ground)}</div>`; });
  }
  tower.innerHTML = h;
  for (const a of M.avatars) {
    const el = document.createElement('div');
    el.className = 'av'; el.innerHTML = `<span class="tag">${esc(a.label)}</span><div class="fig"></div>`;
    tower.appendChild(el); a.el = el; a.figKey = null;
  }
  // a fresh layout: everyone appears where their current state puts them
  for (const s of ['L', 'R']) { LIFTS[s] = makeLift(s, LIFTS[s] ? Math.min(LIFTS[s].floor, G.floors.length - 1) : (s === 'L' ? 0 : G.floors.length - 1)); LIFTS[s].y = cabY(LIFTS[s].floor); }
  for (const a of M.avatars) {
    a.riding = null; a.plan = [];
    const t = targetFor(a, a.want); a.slot = t; a.state = a.want;
    a.floor = t.floor; a.x = t.x; a.mode = 'pose'; a.pose = t.pose; a.flip = !!t.flip;
  }
  updateRoomAlerts(); tickClock(); draw(0);
}

function roofHtml() {
  const { H, W, roof } = G;
  let h = `<div class="roofband" style="height:${roof + G.slab}px">`;
  h += `<div class="parapet" style="height:${G.slab + H * .22}px"></div>`;
  // Roof art (tower/assets/roof-*.webp): the clock tower has a blank dial and date panel, the weather
  // station a blank screen; the hands, date and readings are drawn on top. Positions are % of each image.
  const CLOCK = { ar: 347 / 800, dial: { x: 49.6, y: 59.6, d: 58.8 }, panel: { x: 28, y: 77.3, w: 42.7, h: 7.1 } };
  const STATION = { ar: 600 / ROOF_WX.h, screen: ROOF_WX.screen };
  const towerH = roof - H * .08, towerW = towerH * CLOCK.ar, towerX = W * .45;
  const stH = H * 1.32, stW = stH * STATION.ar;
  if (M.roof.clock) {
    h += `<div class="roofart" style="left:${towerX - towerW / 2}px;bottom:${G.slab + H * .04}px;width:${towerW}px;height:${towerH}px">
      <img alt="" src="${A('roof-clock.webp')}">
      <div class="dial" style="left:${CLOCK.dial.x}%;top:${CLOCK.dial.y}%;width:${CLOCK.dial.d}%">
        <i id="hh" class="hand hour"></i><i id="mh" class="hand minute"></i><b class="pin"></b></div>
      <div class="lcd date" id="datemq" style="left:${CLOCK.panel.x}%;top:${CLOCK.panel.y}%;width:${CLOCK.panel.w}%;height:${CLOCK.panel.h}%;font-size:${Math.min(towerH * CLOCK.panel.h / 100 * .6, towerW * CLOCK.panel.w / 100 / 4.4)}px"></div></div>`;
  }
  if (M.roof.sky) {
    const sc = STATION.screen;
    h += `<div class="roofart" style="right:${G.sh + H * .12}px;bottom:${G.slab + H * .02}px;width:${stW}px;height:${stH}px">
      <img alt="" src="${A('roof-weather.webp')}">
      <div class="lcd wxscreen" style="left:${sc.x}%;top:${sc.y}%;width:${sc.w}%;height:${sc.h}%;font-size:${stH * sc.h / 100 * .18}px">
        <span class="wx-icon" id="wx-icon"></span><span class="wx-temp" id="thermo-t"></span><span class="wx-kind" id="wx-kind"></span></div></div>`;
  }
  // the sign sits between the clock tower and the weather station, shrinking to fit
  const signL = M.roof.clock ? towerX + towerW / 2 + H * .15 : W * .3;
  const signR = M.roof.sky ? W - G.sh - H * .12 - stW - H * .15 : W - G.sh - H * .3;
  const len = M.roof.sign.length, fs = Math.max(9, Math.min(H * .32, (signR - signL) / (len * .68)));
  h += `<div class="sign" style="left:${(signL + signR) / 2}px;bottom:${G.slab + H * .3}px;font-size:${fs}px">${esc(M.roof.sign)}</div>`;
  if (M.roof.billboard) h += `<div class="billboard" style="left:${G.sh + H * .3}px;bottom:${G.slab + H * .3}px;width:${H * 1.25}px;height:${H * .5}px;font-size:${Math.max(8, H * .09)}px"><div><b>${countdownDays()}</b>days to go</div></div>`;
  return h + `</div>`;
}

function roomHtml(key) {
  const room = M.rooms[key], R = room.R, g = G.rooms[key], H = G.H;
  const cls = ['room', R.art ? '' : R.agentwall ? 'agentwall' : 'ph', TILED.has(key) ? 'tile' : ''].join(' ');
  const bg = R.art ? `background-image:url('${A(`room-${R.art}.webp`)}');` : '';
  let inner = (R.props || []).map(p => `<div class="prop${p.z === 'front' ? ' front' : ''}" style="left:${p.x}%;bottom:${p.b}%;width:${p.w * (R.ar || 2) * H / g.w}%"><img alt="" src="${A(`props/${p.n}.webp`)}"></div>`).join('');
  if (key === 'cafe') inner += room.tableX.map(x => `<div class="prop" style="left:${x}%;bottom:5%;width:${.5 * H / g.w * 100}%"><img alt="" src="${A('props/cafetable.webp')}"></div>`).join('');
  if (key === 'dorm') inner += room.bedX.map(x => `<div class="prop" style="left:${x}%;bottom:6%;width:${.68 * H / g.w * 100}%"><img alt="" src="${A('props/bed.webp')}"></div>`).join('');
  if (!R.art && !R.agentwall) inner += room.stations.map((a, i) => { const s = stationSpotPct(room, i); return `<div class="desk" style="left:calc(${s}% + ${.3 * H}px);bottom:6%;width:${.42 * H}px;height:${.2 * H}px"></div>`; }).join('');
  inner += room.pieces.map((p, i) => pieceHtml(p, i, room, g)).join('');
  if (R.agentwall) inner += panelsHtml(g);
  const names = [...room.stations.map(a => a.label), ...room.pieces.map(p => p.c.label)];
  if (R.agentwall) names.push(`${M.panels.length} agents`);
  const sub = R.shared ? { sleep: 'idle for hours', gym: 'housekeeping', idle: 'breaks', alert: 'anything broken', lobby: 'welcome' }[R.shared] : names.join(' · ');
  return `<div class="${cls}" tabindex="0" role="button" data-room="${key}" data-icon="${R.icon || ''}" aria-label="${esc(R.name)}: ${esc(sub)}" style="left:${g.x}px;top:${g.top}px;width:${g.w}px;height:${H}px;${bg}">
    ${inner}<span class="plate">${esc(R.name)}${sub ? ` <i style="font:400 9px var(--f-body);color:var(--ink-soft);font-style:normal">· ${esc(sub)}</i>` : ''}</span>
    ${!R.art && !R.agentwall && !R.shared ? '<span class="phnote">art coming</span>' : ''}</div>`;
}
/* hand-placed spots first; extra stations fill the middle of an art room, or spread evenly in a placeholder */
function stationSpotPct(room, i) {
  const spots = room.R.spots || [];
  if (spots[i]) return spots[i].x;
  if (spots.length) { const k = i - spots.length, n = room.stations.length - spots.length; return 38 + (k + .5) * 30 / n; }
  return 14 + (i + .5) * 72 / room.stations.length;
}
function pieceHtml(p, i, room, g) {
  const H = G.H, n = room.pieces.length, x = room.R.pieceX ? room.R.pieceX[i % room.R.pieceX.length] : room.R.pieceSpread ? 50 + (i - (n - 1) / 2) * room.R.pieceSpread * 2.61 * H / g.w : room.stations.length ? 20 + (i + .5) * 60 / n : 12 + (i + .5) * 76 / n;
  const top = `top:${Math.max(H * .26, 22)}px;left:${x}%`;
  switch (p.c.piece) {
    case 'board': return `<div class="piece board" style="${top}">${esc(!demo && p.live && p.live.text ? p.live.text : p.c.text())}</div>`;
    case 'lamps': return `<div class="piece lamps" style="${top}" id="lamps-${p.w.id}"><i></i><i></i><i></i><i></i></div>`;
    case 'cork': return room.R.art   // pinned to the cork board drawn in the room
      ? `<div class="piece" style="top:${H * .3}px;left:${x}%;width:${H * .34}px"><span style="display:block;background:#fff8c4;color:#2b2620;padding:3px 4px;font:500 9px var(--f-body);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.3)">${esc(p.c.text())}</span></div>`
      : `<div class="piece cork" style="${top};width:${H * .5}px"><span>${esc(p.c.text())}</span></div>`;
    case 'chalk': return room.R.art
      ? `<div class="piece chalk" style="top:${H * .36}px;left:${x}%;width:${H * .4}px;font-size:${Math.max(7, H * .06)}px">${esc(p.c.text())}</div>`
      : `<div class="piece chalk" style="${top};width:${H * .75}px">${esc(p.c.text())}</div>`;
    case 'plaque': return `<div class="piece plaque${/update/.test(p.c.read()) ? ' glow' : ''}" style="top:${Math.max(H * .26, 22) + (i % 2) * H * .16}px;left:${x}%">${esc(p.c.text())}</div>`;
    case 'clocks': return `<div class="piece clocks" style="${top}">${['LON', 'TYO', 'NYC'].map((c, k) => `<div><span class="cf" style="width:${H * .17}px;height:${H * .17}px"><i data-tz="${[0, 9, -5][k]}" style="height:42%"></i></span>${c}</div>`).join('')}</div>`;
    case 'frame': {
      const hue = (i * 67 + 20) % 360;
      const fs = room.R.frameScale || 1;
      return `<div class="piece frame${p.c.spot ? ' spot' : ''}" data-rotate="${p.c.rotate ? 1 : ''}" style="top:${Math.max(H * .3, 22)}px;left:${x}%;width:${H * .36 * fs}px;height:${H * .27 * fs}px;background:linear-gradient(${hue}deg, hsl(${hue} 60% 60%), hsl(${(hue + 60) % 360} 55% 35%))"></div>`;
    }
  }
  return '';
}
function panelsHtml(g) {
  const H = G.H, n = M.panels.length, rows = 3, cols = Math.max(1, Math.ceil(n / rows));
  const pw = (g.w - H * .3) / cols - 4, ph = (H * .9 - Math.max(H * .24, 22)) / rows - 4;
  return M.panels.map((p, i) => {
    const c = Math.floor(i / rows), r = i % rows;
    return `<div class="panel ${p.state}" id="panel-${p.w.id}" title="${esc(p.c.label)}" style="left:${H * .15 + c * (pw + 4)}px;top:${Math.max(H * .24, 22) + r * (ph + 4)}px;width:${pw}px;height:${ph}px">
      <div class="nm">${esc(p.c.label)}</div><div class="bar s"><i style="width:${p.s}%"></i></div><div class="bar k"><i style="width:${p.wk}%"></i></div></div>`;
  }).join('');
}

/* placeholder figure for avatars whose art isn't made yet: a coloured pawn with the widget's icon */
function pawn(a, pose) {
  const lying = pose === 'sleeping';
  const body = `<circle cx="20" cy="12" r="9" fill="#f1c9a5"/><rect x="8" y="22" width="24" height="${pose === 'sitting' ? 22 : 30}" rx="9" fill="${a.color}"/>
    <text x="20" y="${pose === 'sitting' ? 37 : 41}" text-anchor="middle" font-size="12">${a.c.icon}</text>
    ${pose === 'sitting' ? '' : `<rect x="11" y="50" width="7" height="22" rx="3" fill="#3b3437"/><rect x="22" y="50" width="7" height="22" rx="3" fill="#3b3437"/>`}
    ${pose === 'alert' ? '<rect x="2" y="18" width="6" height="16" rx="3" fill="' + a.color + '" transform="rotate(-30 5 20)"/><rect x="32" y="18" width="6" height="16" rx="3" fill="' + a.color + '" transform="rotate(30 35 20)"/>' : ''}
    ${pose === 'gym' ? '<rect x="-4" y="14" width="48" height="3" fill="#555"/><rect x="-6" y="9" width="5" height="13" fill="#222"/><rect x="41" y="9" width="5" height="13" fill="#222"/>' : ''}`;
  return lying ? `<svg viewBox="0 0 80 40" aria-hidden="true"><g transform="translate(78 2) rotate(90)">${body}</g></svg>`
               : `<svg viewBox="0 0 40 ${pose === 'sitting' ? 50 : 74}" aria-hidden="true">${body}</svg>`;
}

/* ---------- per-frame drawing ---------- */
function figFor(a) {
  const st = a.mode === 'pose' ? a.pose : a.mode === 'ride' ? 'ride' : 'walk';
  if (a.c.frames) {
    if (st === 'walk') return SAB.walk[Math.floor((a.dist || 0) / (G.H * .1)) % 6];
    if (st === 'ride') return SAB.ride;
    if (st === 'working' && a.state === 'working') return SAB.work[Math.floor(a.frameT / .45) % 4];
    if (st === 'gym') return SAB.lift[Math.floor(a.frameT / .42) % 6];
  }
  if (a.c.cast && a.c.walk) {
    if (st === 'walk') return A(`cast/${a.c.cast}-walk-${Math.floor((a.dist || 0) / (G.H * .1)) % 6}.webp`);
    if (st === 'ride') return A(`cast/${a.c.cast}-walk-2.webp`);
  }
  if (a.c.cast) return A(`cast/${a.c.cast}-${st === 'walk' ? 'walking' : st === 'ride' ? 'working' : st}.webp`);
  return 'pawn:' + (st === 'walk' || st === 'ride' ? 'working' : st);
}
function draw() {
  for (const s of ['L', 'R']) {
    const L = LIFTS[s], x = G.shaftX(s) - cabW() / 2;
    const cab = document.getElementById('cab' + s), gate = document.getElementById('gate' + s);
    Object.assign(cab.style, { left: x + 'px', top: L.y + 'px', width: cabW() + 'px', height: cabH() + 'px' });
    Object.assign(gate.style, { left: x + cabW() * .07 + 'px', top: L.y + cabH() * .1 + 'px', width: cabW() * .86 + 'px', height: cabH() * .86 + 'px' });
    gate.classList.toggle('open', L.door === 'open');
    document.getElementById('cable' + s).style.height = Math.max(0, L.y - G.floors[0].top) + 'px';
  }
  const H = G.H;
  for (const a of M.avatars) {
    const el = a.el, posed = a.mode === 'pose';
    const pose = posed ? a.pose : 'stand';
    let hgt = H * .58, lift = 0;
    if (posed && a.slot) {
      if (pose === 'sitting') hgt = H * (a.slot.h || .42);
      if (a.slot.h && pose !== 'sitting') hgt = H * a.slot.h;
      if (a.slot.b) lift = H * a.slot.b - H * .06;
      if (pose === 'sleeping') { hgt = H * .19; lift = a.slot.bed ? H * .17 : H * .02; }
    }
    const feet = a.mode === 'ride' ? LIFTS[a.riding].y + cabH() * .955 : G.walkY(a.floor) - lift;
    const bob = a.mode === 'walk' && !a.c.frames && !a.c.walk ? Math.abs(Math.sin((a.dist || 0) / (H * .09))) * H * .03 : 0;
    el.style.left = a.x + 'px'; el.style.top = (feet - hgt - bob) + 'px'; el.style.height = hgt + 'px';
    el.className = `av ${a.state}${a.flip ? ' flip' : ''}${a.mode === 'ride' ? ' riding' : ''}`;
    const tag = a.slot && a.slot.dozing && posed ? `${a.label} · z z z` : a.state === 'alert' && posed ? `${a.label} · down` : a.label;
    if (el.firstChild.textContent !== tag) el.firstChild.textContent = tag;
    const key = figFor(a), fig = el.querySelector('.fig');
    if (key !== a.figKey) {
      a.figKey = key;
      fig.innerHTML = key.startsWith('pawn:') ? pawn(a, key.slice(5)) : `<img alt="" src="${key}">`;
      fig.style.height = '100%';
    }
    const bagEl = el.querySelector('.bag');
    if (posed && a.slot && a.slot.bag && pose === 'sleeping') {
      if (!bagEl) { const b = document.createElement('div'); b.className = 'bag'; el.appendChild(b); }
      Object.assign(el.querySelector('.bag').style, { width: H * .62 + 'px', height: H * .12 + 'px', left: 0, bottom: -H * .03 + 'px', zIndex: -1 });
    } else if (bagEl) bagEl.remove();
  }
}

/* ---------- SABnzbd's conveyor ---------- */
let beltT = 0;
function beltTick(dt) {
  const sab = M.avatars.find(a => a.c.frames && a.mode === 'pose' && a.state === 'working');
  if (!sab) return;
  beltT -= dt;
  if (beltT > 0) return;
  beltT = 1.8;
  const g = G.rooms.dock, conv = ROOMS.dock.props[0];
  const convW = conv.w / 100 * ROOMS.dock.ar * G.H;                      // the prop's width in px (see roomHtml)
  const beltTop = G.floors[g.floor].bottom - G.H * conv.b / 100 - convW / (1400 / 267) * .97;
  const x0 = g.x + g.w * .76, x1 = g.x + g.w * .46, w = G.H * .17;
  const el = document.createElement('div');
  el.className = 'belt-box'; el.innerHTML = `<img alt="" src="${A('props/box.webp')}">`;
  Object.assign(el.style, { width: w + 'px', left: x0 - w / 2 + 'px', top: beltTop - w * 1.04 + 'px' });
  tower.appendChild(el);
  const ride = x1 - x0, dur = Math.abs(ride) / (G.H * .45) * 1000 / .82;
  el.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${ride}px)`, opacity: 1, offset: .82 },
    { transform: `translateX(${ride - G.H * .05}px) translateY(-${G.H * .05}px) scale(.62)`, opacity: 0 }], { duration: dur, fill: 'forwards' }).onfinish = () => el.remove();
}

/* ---------- rooms flash while one of their avatars is down ---------- */
function updateRoomAlerts() {
  for (const key in M.rooms) {
    const el = tower.querySelector(`[data-room="${key}"]`); if (!el) continue;
    const down = M.rooms[key].stations.some(a => a.state === 'alert');
    el.classList.toggle('alerting', down && !ROOMS[key].shared);
  }
  const c = Object.fromEntries(STATES.map(s => [s, 0]));
  for (const a of M.avatars) c[a.want]++;
  document.getElementById('counts').innerHTML = STATES.map(s => `<span><i class="dot" style="background:${STATE_COLOR[s]}"></i>${STATE_LABEL[s]} <b>${c[s]}</b></span>`).join('') +
    (M.panels.length ? `<span><i class="dot" style="background:#7aa2ff"></i>Agents <b>${M.panels.filter(p => p.state === 'working').length}/${M.panels.length}</b></span>` : '');
}

/* ============================================================
   OUTSIDE: sky follows the time of day, weather on top
   ============================================================ */
const WX = { kind: 'clear', temp: 14, t: 0 };
const sky = document.getElementById('sky'), wcv = document.getElementById('weather'), wctx = wcv.getContext('2d');
let drops = [];
function hourNow() { const v = document.getElementById('tod').value; if (v !== 'live') return +v; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
function skyColors(h) {
  const stops = [[0, '#0b0d24', '#1a1838'], [5.5, '#1d1d45', '#4a3a6a'], [7, '#f0a97a', '#8fb3e0'], [10, '#6fb2ec', '#cfe6f7'], [16.5, '#6aa6e0', '#d9e8f2'],
                 [18.5, '#3b3270', '#e88a5a'], [20, '#1d1a45', '#5a3d6a'], [24, '#0b0d24', '#1a1838']];
  let i = stops.findIndex(s => s[0] > h) - 1; if (i < 0) i = 0;
  const [h0, t0, b0] = stops[i], [h1, t1, b1] = stops[i + 1], k = (h - h0) / (h1 - h0);
  const mix = (c0, c1) => { const p = x => [1, 3, 5].map(j => parseInt(x.slice(j, j + 2), 16)); const a = p(c0), b = p(c1); return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`; };
  return [mix(t0, t1), mix(b0, b1)];
}
function paintSky() {
  const h = hourNow(), [top, low] = skyColors(h);
  const grey = { clouds: .35, rain: .55, storm: .7, snow: .4, fog: .5 }[WX.kind] || 0;
  const night = h < 6 || h > 20;
  sky.style.background = `linear-gradient(180deg, ${top}, ${low})` + (grey ? `, linear-gradient(rgba(90,95,110,${grey}), rgba(90,95,110,${grey}))` : '');
  sky.style.backgroundBlendMode = grey ? 'multiply' : 'normal';
  sky.dataset.night = night ? '1' : '';
  document.body.classList.toggle('snow', WX.kind === 'snow');
}
function setWeather(kind, temp) {
  WX.kind = kind; WX.temp = temp != null ? temp : { clear: 22, clouds: 15, rain: 11, snow: -3, storm: 13, fog: 8 }[kind];
  window.TOWER_WX = WX;
  drops = [];
  const n = { rain: 260, storm: 380, snow: 180, clouds: 7, fog: 0, clear: 0 }[kind] || 0;
  for (let i = 0; i < n; i++) drops.push({ x: Math.random(), y: Math.random(), s: .5 + Math.random(), w: Math.random() });
  const t = document.getElementById('thermo-t');
  if (t) {
    t.textContent = WX.temp + '°' + (WX.unit || '');
    document.getElementById('wx-icon').textContent = { clear: '☀️', clouds: '☁️', rain: '🌧️', snow: '❄️', storm: '⛈️', fog: '🌫️' }[kind] || '';
    document.getElementById('wx-kind').textContent = (WX.place ? WX.place + ' · ' : '') + kind.toUpperCase();
  }
  paintSky();
}
function weatherTick(dt) {
  if (wcv.width !== innerWidth || wcv.height !== innerHeight) { wcv.width = innerWidth; wcv.height = innerHeight; }
  const W = wcv.width, Hh = wcv.height;
  wctx.clearRect(0, 0, W, Hh);
  const h = hourNow();
  if ((h < 6 || h > 20) && !['rain', 'storm', 'fog', 'clouds'].includes(WX.kind)) {     // stars
    wctx.fillStyle = 'rgba(255,255,240,.8)';
    for (let i = 0; i < 90; i++) { const x = (i * 9301 + 49297) % 233280 / 233280 * W, y = (i * 4253 + 1931) % 10007 / 10007 * Hh * .6; wctx.fillRect(x, y, 1.5, 1.5); }
  }
  if (h >= 6.5 && h <= 18.5 && WX.kind === 'clear') {                                  // the sun crosses the sky
    const k = (h - 6.5) / 12, x = W * (.1 + .8 * k), y = Hh * (.55 - .45 * Math.sin(Math.PI * k));
    const gr = wctx.createRadialGradient(x, y, 0, x, y, 70); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(.3, 'rgba(255,220,120,.8)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    wctx.fillStyle = gr; wctx.beginPath(); wctx.arc(x, y, 70, 0, 7); wctx.fill();
  }
  if (WX.kind === 'clouds' || WX.kind === 'rain' || WX.kind === 'storm' || WX.kind === 'snow') {
    WX.t += dt * (reduce ? 0 : 1);
    const dark = WX.kind === 'clouds' ? 'rgba(235,238,245,.85)' : 'rgba(120,125,140,.9)';
    for (let i = 0; i < 7; i++) {
      const x = ((i * .17 + WX.t * .006 * (1 + i % 3 * .3)) % 1.3 - .15) * W, y = Hh * (.05 + (i % 3) * .07);
      wctx.fillStyle = dark;
      for (let j = 0; j < 4; j++) { wctx.beginPath(); wctx.ellipse(x + j * 34, y + (j % 2) * 8, 46, 22, 0, 0, 7); wctx.fill(); }
    }
  }
  if (WX.kind === 'rain' || WX.kind === 'storm') {
    wctx.strokeStyle = 'rgba(190,210,255,.55)'; wctx.lineWidth = 1.2; wctx.beginPath();
    for (const d of drops) { if (!reduce) d.y += dt * (1.1 + d.s * .6); if (d.y > 1) { d.y = 0; d.x = Math.random(); }
      const x = d.x * W, y = d.y * Hh; wctx.moveTo(x, y); wctx.lineTo(x - 4, y + 14 * d.s); }
    wctx.stroke();
    if (WX.kind === 'storm' && !reduce && Math.random() < dt * .25) { const f = document.getElementById('flash'); f.animate([{ opacity: .55 }, { opacity: 0 }], 260); }
  }
  if (WX.kind === 'snow') {
    wctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const d of drops) { if (!reduce) { d.y += dt * (.06 + d.s * .05); d.x += Math.sin((d.y + d.w) * 12) * dt * .01; } if (d.y > 1) { d.y = 0; d.x = Math.random(); }
      wctx.beginPath(); wctx.arc(d.x * W, d.y * Hh, 1.2 + d.s * 1.4, 0, 7); wctx.fill(); }
  }
  if (WX.kind === 'fog') { const gr = wctx.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgba(220,220,230,.15)'); gr.addColorStop(1, 'rgba(220,220,230,.55)'); wctx.fillStyle = gr; wctx.fillRect(0, 0, W, Hh); }
}
function tickClock() {
  const d = new Date(), h = hourNow(), m = document.getElementById('tod').value === 'live' ? d.getMinutes() : (h % 1) * 60;
  const hh = document.getElementById('hh'), mh = document.getElementById('mh');
  if (hh) { hh.style.transform = `translateX(-50%) rotate(${(h % 12) * 30 + m / 2}deg)`; mh.style.transform = `translateX(-50%) rotate(${m * 6}deg)`; }
  const mq = document.getElementById('datemq');
  if (mq) mq.textContent = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();   // fits the small brass panel
  for (const i of tower.querySelectorAll('[data-tz]')) {
    const utc = d.getUTCHours() + d.getUTCMinutes() / 60 + +i.dataset.tz;
    i.style.transform = `translateX(-50%) rotate(${(utc % 12) * 30}deg)`;
  }
}

/* ============================================================
   CARDS: clicking a room opens its widgets' cards
   ============================================================ */
const dlg = document.getElementById('dlg');
function openRoom(key) {
  const room = M.rooms[key]; if (!room) return;
  document.getElementById('dlg-title').textContent = room.R.name;
  let h = '';
  if (room.R.shared) {
    const who = M.avatars.filter(a => a.want === room.R.shared);
    h += `<p class="hint">${{ idle: 'Avatars on a break: nothing to do right now.', sleep: 'Avatars asleep: no activity for 2 hours or more. When the beds are full, extras use sleeping bags, then a cafeteria table.', gym: 'Avatars doing housekeeping: scans, syncs, backups, repairs.', alert: 'Anything unreachable or failing ends up here.', lobby: 'The lobby holds the world clocks and the quote board.' }[room.R.shared]}</p>`;
    h += who.map(cardHtml).join('') || '<p class="hint">Nobody here right now.</p>';
  }
  h += room.stations.map(cardHtml).join('');
  h += room.pieces.map(p => `<div class="card"><h3>${p.c.icon} ${esc(p.c.label)}</h3><div class="read">${esc(demo || !p.live ? p.c.read() : p.live.read)}</div></div>`).join('');
  if (room.R.agentwall) h += M.panels.map(p => `<div class="card"><h3>${esc(p.c.label)} <span class="chip">${p.state}</span></h3><div class="read">${esc(p.live || `session ${p.s}% · week ${p.wk}%`)}</div></div>`).join('');
  if (HIDEABLE(key)) h += `<div><button data-hide="${key}">Hide this room</button> <span class="hint">Bring it back from Rooms in the top bar.</span></div>`;
  h += `<p class="hint">${demo ? 'Demo data: these readouts are made up.' : 'Live from your dashboard, refreshed every 30 seconds.'} <a href="/" style="color:var(--warn)">Open the dashboard</a></p>`;
  document.getElementById('dlg-body').innerHTML = h;
  dlg.showModal();
}
function cardHtml(a) {
  return `<div class="card"><h3>${a.c.icon} ${esc(a.label)} <span class="chip" style="color:${STATE_COLOR[a.want]}">${STATE_LABEL[a.want]}</span></h3>
    <div class="read">${esc(demo ? a.c.read() : a.live || 'Waiting for data…')}</div>
    <div class="states"${demo ? '' : ' hidden'} role="group" aria-label="Demo: set ${esc(a.label)}'s state">${STATES.filter(s => (s !== 'gym' || a.c.gym !== false) && (s !== 'alert' || a.c.alert !== false)).map(s =>
      `<button data-av="${a.id}" data-st="${s}" aria-pressed="${a.want === s}">${STATE_LABEL[s]}</button>`).join('')}</div></div>`;
}
document.getElementById('dlg-body').addEventListener('click', e => {
  const b = e.target.closest('[data-av]'); if (!b) return;
  const a = M.avatars.find(x => x.id === b.dataset.av);
  setState(a, b.dataset.st); a.timer = 60;                                 // hold the chosen state for a minute
  b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  updateRoomAlerts();
});
document.getElementById('dlg-body').addEventListener('click', e => {
  const b = e.target.closest('[data-hide]'); if (!b) return;
  HIDDEN.add(b.dataset.hide); saveHidden(); dlg.close(); start(document.getElementById('preset').value);
});
document.getElementById('dlg-close').addEventListener('click', () => dlg.close());
/* the Rooms list: a switch per room the current dashboard uses */
document.getElementById('rooms-btn').addEventListener('click', () => {
  const used = [...new Set(dashboardFor(document.getElementById('preset').value).map(w => CATALOG[w.type] && CATALOG[w.type].room))]
    .filter(k => k && ROOMS[k] && HIDEABLE(k));
  document.getElementById('dlg-title').textContent = 'Rooms in the tower';
  document.getElementById('dlg-body').innerHTML = `<p class="hint">Switch a room off to leave it out of the tower. Its widgets stay on your dashboard.</p>` +
    used.map(k => `<label class="card" style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" data-room-toggle="${k}" ${isHidden(k) ? '' : 'checked'} ${SETTINGS.hidden.includes(k) ? 'disabled title="Hidden in the Tower widget\'s settings"' : ''}>
      <span><b>${esc(ROOMS[k].name)}</b><br><span class="hint">${esc(Object.keys(CATALOG).filter(t => CATALOG[t].room === k && dashboardFor(document.getElementById('preset').value).some(w => w.type === t)).map(t => CATALOG[t].label).join(' · '))}</span></span></label>`).join('') +
    `<p class="hint">The cafeteria, dormitory, gym, lobby and basement always stay: avatars need them.${SETTINGS.hidden.length ? ' Greyed-out rooms are hidden in the Tower widget’s settings on your dashboard.' : ''}</p>`;
  dlg.showModal();
});
document.getElementById('dlg-body').addEventListener('change', e => {
  const t = e.target.closest('[data-room-toggle]'); if (!t) return;
  t.checked ? HIDDEN.delete(t.dataset.roomToggle) : HIDDEN.add(t.dataset.roomToggle);
  saveHidden(); start(document.getElementById('preset').value);
});
tower.addEventListener('click', e => { const r = e.target.closest('[data-room]'); if (r && !r.classList.contains('hall')) openRoom(r.dataset.room); });
tower.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.room) { e.preventDefault(); openRoom(e.target.dataset.room); } });

/* ---------- controls ---------- */
const demoBtn = document.getElementById('demo');
demoBtn.addEventListener('click', () => {
  if (!MINE || document.getElementById('preset').value !== 'mine') return;   // sample dashboards are always demo
  demo = !demo; demoBtn.setAttribute('aria-pressed', String(demo)); start('mine');
});
let wxAuto = true, wxT = 0;
document.getElementById('wx').addEventListener('change', e => {
  wxAuto = e.target.value === 'auto';
  if (e.target.value === 'live') liveWeather(); else if (!wxAuto) setWeather(e.target.value);
});
document.getElementById('tod').addEventListener('change', () => { paintSky(); tickClock(); });

/* ---------- main loop ---------- */
let last = performance.now(), acc = 0, clockT = 0;
function loop(now) {
  const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
  if (!M) { requestAnimationFrame(loop); return; }   // still loading the dashboard   // rAF time can predate the last reading
  if (demo) demoTick(dt);
  for (const s of ['L', 'R']) liftTick(LIFTS[s], dt);
  for (const a of M.avatars) avatarTick(a, dt);
  beltTick(dt);
  draw();
  weatherTick(dt);
  acc += dt; if (acc > .5) { acc = 0; updateRoomAlerts(); }
  clockT += dt; if (clockT > 1) { clockT = 0; tickClock(); paintSky(); }
  if (wxAuto) { wxT -= dt; if (wxT <= 0) { wxT = 25; setWeather(pick(['clear', 'clouds', 'rain', 'snow', 'storm', 'fog', 'clear'])); } }
  requestAnimationFrame(loop);
}

function start(preset) {
  if (stopLive) { stopLive(); stopLive = null; }
  if (preset !== 'mine') demo = true;
  demoBtn.setAttribute('aria-pressed', String(demo));
  M = buildModel(dashboardFor(preset));
  for (const a of M.avatars) {
    if (demo) { a.want = a.state = pick(['working', 'working', 'working', 'idle', 'gym']); if (a.want === 'gym' && a.c.gym === false) a.want = a.state = 'working'; a.timer = rnd(3, 25); }
    else a.want = a.state = 'working';
  }
  for (const s of ['L', 'R']) delete LIFTS[s];
  render();
  if (WX) setWeather(WX.kind);
  if (!demo) startLive();
}
document.getElementById('preset').addEventListener('change', e => start(e.target.value));

/* Boot: the owner's dashboard from /config, unless it has no widgets (or ?demo=1). */
async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    const cfg = await fetch('/config', { credentials: 'same-origin' }).then(r => r.json());
    const widgets = (cfg.widgets || []).filter(w => w && w.type);
    const tower = widgets.find(w => w.type === 'lobster-tower');
    if (tower && tower.properties) {
      const p = tower.properties;
      SETTINGS.sleepHours = Math.max(.25, Number(p.sleepHours) || 2);
      SETTINGS.hidden = String(p.hiddenRooms || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        .map(x => Object.keys(ROOMS).find(k => k === x || ROOMS[k].name.toLowerCase() === x)).filter(Boolean);
    }
    if (widgets.some(w => CATALOG[w.type])) MINE = widgets.map(w => ({ id: w.id, type: w.type, properties: w.properties || {} }));
  } catch (e) { /* not running inside LobsterBoard: demo only */ }
  const sel = document.getElementById('preset');
  if (MINE) { sel.insertAdjacentHTML('afterbegin', '<option value="mine">My dashboard</option>'); sel.value = 'mine'; demo = params.get('demo') === '1'; }
  start(MINE ? 'mine' : 'all');
}
setWeather('clear');
boot();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 150); });
requestAnimationFrame(loop);

/**
 * Lobster Tower: where every widget lives in the tower.
 *
 * Every LobsterBoard widget type must appear either in TOWER_CATALOG (it gets a room, an avatar
 * or a wall piece) or in TOWER_NONE (it is left out on purpose). tests/tower-catalog.test.js fails
 * when a widget type is in neither, so a new widget is not finished until it has a tower entry.
 *
 * Entry fields
 *   label   name shown on the avatar's tag (the service name, never a character name)
 *   room    key in TOWER_ROOMS, or 'roof' for the outside of the building
 *   avatar  true: an avatar works here · otherwise `piece` says how the wall piece is drawn
 *   cast    character art in tower/assets/cast/<cast>-<pose>.webp · walk: has a 6-frame walk cycle
 *   gym / alert: false when that state never applies · alertStays: panics in place
 *   read    demo readout for the card (live data replaces it inside LobsterBoard)
 */
(function (root) {
'use strict';
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
function countdownDays() { const t = new Date(new Date().getFullYear(), 11, 25); if (t < new Date()) t.setFullYear(t.getFullYear() + 1); return Math.ceil((t - new Date()) / 864e5); }

const CATALOG = {
  // media server
  'media-plex':      { label: 'Plex',     room: 'cinema',  avatar: true, cast: 'plex', walk: true,     icon: '▶️', read: () => `${rnd(0, 3)} streams · ${rnd(0, 1)} transcoding` },
  'media-radarr':    { label: 'Radarr',   room: 'library', avatar: true, cast: 'radarr', walk: true,   icon: '🎬', read: () => `${rnd(300, 420)} movies · ${rnd(0, 4)} queued` },
  'media-sonarr':    { label: 'Sonarr',   room: 'library', avatar: true, cast: 'sonarr', walk: true,   icon: '📺', read: () => `${rnd(1300, 1500)} episodes · ${rnd(0, 6)} queued` },
  'media-seerr':     { label: 'Seerr',    room: 'desk',    avatar: true, cast: 'seerr', walk: true,    icon: '🙋', read: () => `${rnd(0, 5)} pending · ${rnd(5, 20)} approved` },
  'media-prowlarr':  { label: 'Prowlarr', room: 'radio',   avatar: true, cast: 'prowlarr', walk: true, icon: '🔎', read: () => `${rnd(3, 6)} indexers · ${rnd(200, 900)} grabs` },
  'media-sabnzbd':   { label: 'SABnzbd',  room: 'dock',    avatar: true, cast: 'sab', frames: true, icon: '⬇️', read: () => `${(Math.random() * 40).toFixed(1)} MB/s · ${rnd(0, 7)} in queue` },
  // system
  'cpu-memory':        { label: 'CPU',      room: 'servers',  avatar: true, cast: 'servers', walk: true, gym: false, icon: '💻', read: () => `CPU ${rnd(2, 70)}% · RAM ${rnd(30, 80)}%` },
  'disk-usage':        { label: 'Disk',     room: 'servers',  avatar: true, cast: 'disk', walk: true, gym: false, icon: '💾', read: () => `${rnd(40, 93)}% used` },
  'uptime-monitor':    { label: 'Uptime',   room: 'servers',  piece: 'board', icon: '📡', text: () => `UP ${rnd(1, 40)}d`, read: () => `up ${rnd(1, 40)}d ${rnd(0, 23)}h` },
  'api-status':        { label: 'API Status', room: 'servers', piece: 'lamps', icon: '🔄', read: () => '4 of 4 endpoints answering' },
  'docker-containers': { label: 'Docker',   room: 'yard',     avatar: true, cast: 'docker', walk: true, icon: '🐳', read: () => `${rnd(8, 16)} running · ${rnd(0, 1)} stopped` },
  'network-speed':     { label: 'Network',  room: 'network',  avatar: true, cast: 'network', walk: true, gym: false, icon: '🌐', read: () => `↓ ${rnd(1, 90)} Mb/s · ↑ ${rnd(1, 20)} Mb/s` },
  // OpenClaw
  'auth-status':   { label: 'Auth',     room: 'control', avatar: true, cast: 'auth', walk: true, gym: false, icon: '🔐', read: () => 'Max subscription' },
  'session-count': { label: 'Sessions', room: 'control', avatar: true, cast: 'sessions', walk: true, gym: false, icon: '💬', read: () => `${rnd(0, 4)} active sessions` },
  'token-gauge':   { label: 'Tokens',   room: 'control', avatar: true, cast: 'tokens', walk: true, gym: false, icon: '📊', read: () => `${rnd(10, 90)}% of limit` },
  'cron-jobs':     { label: 'Cron',     room: 'control', avatar: true, cast: 'cron', walk: true, icon: '⏰', read: () => `${rnd(3, 9)} jobs · next in ${rnd(1, 50)} min` },
  'activity-list': { label: 'Activity', room: 'control', avatar: true, cast: 'activity', walk: true, gym: false, icon: '📋', read: () => `${rnd(1, 30)} events today` },
  'system-log':    { label: 'Log',      room: 'control', avatar: true, cast: 'log', walk: true, gym: false, icon: '🔧', read: () => `${rnd(0, 3)} warnings in the last hour` },
  // time and planning
  'clock':       { label: 'Clock',       room: 'roof',  piece: 'clocktower', icon: '🕐', read: () => new Date().toLocaleTimeString() },
  'world-clock': { label: 'World Clock', room: 'lobby', piece: 'clocks', icon: '🌍', read: () => 'London · Tokyo · New York' },
  'countdown':   { label: 'Countdown',   room: 'roof',  piece: 'billboard', icon: '⏳', read: () => `${countdownDays()} days to go` },
  'calendar':    { label: 'Calendar',    room: 'planning', avatar: true, cast: 'calendar', walk: true, gym: false, icon: '📅', read: () => `Next: standup in ${rnd(5, 90)} min` },
  // productivity
  'todo-list':    { label: 'Todo',      room: 'office',   avatar: true, cast: 'todo', walk: true, gym: false, icon: '✅', read: () => `${rnd(1, 9)} open tasks` },
  'email-count':  { label: 'Email',     room: 'mail',     avatar: true, cast: 'email', walk: true, gym: false, icon: '📧', read: () => `${rnd(0, 60)} unread` },
  'pomodoro':     { label: 'Pomodoro',  room: 'office',   avatar: true, cast: 'pomodoro', walk: true, gym: false, alert: false, pomodoro: true, icon: '🎯', read: () => 'Focus 25:00 / break 5:00' },
  'github-stats': { label: 'GitHub',    room: 'workshop', avatar: true, cast: 'github', walk: true, gym: false, icon: '🐙', read: () => `${rnd(100, 900)} stars · ${rnd(0, 12)} open PRs` },
  'notes':        { label: 'Notes',     room: 'office',   piece: 'cork', icon: '📝', text: () => 'Buy milk · call Sam', read: () => 'Buy milk · call Sam' },
  // finance
  'stock-ticker': { label: 'Stocks', room: 'trading', avatar: true, cast: 'stocks', walk: true, gym: false, icon: '📈', read: () => `AAPL ${(180 + Math.random() * 20).toFixed(2)} · ${Math.random() > .5 ? '▲' : '▼'}${(Math.random() * 2).toFixed(1)}%` },
  'crypto-price': { label: 'Crypto', room: 'trading', avatar: true, cast: 'crypto', walk: true, gym: false, icon: '₿', read: () => `BTC ${rnd(60, 110)}k · ${Math.random() > .5 ? '▲' : '▼'}${(Math.random() * 5).toFixed(1)}%` },
  // content
  'rss-ticker':   { label: 'RSS',         room: 'newsroom', avatar: true, cast: 'rss', walk: true, gym: false, icon: '📡', read: () => 'Understanding positional embeddings…' },
  'now-playing':  { label: 'Now Playing', room: 'music',    avatar: true, cast: 'dj', walk: true, gym: false, icon: '🎵', read: () => 'Lo-fi beats · 2:14 / 3:40' },
  'quote-of-day': { label: 'Quote',       room: 'lobby',    piece: 'chalk', icon: '💭', text: () => '“Ship it, then polish it.”', read: () => '“Ship it, then polish it.”' },
  'image-local':  { label: 'Image',        room: 'gallery', piece: 'frame', icon: '🖼️', read: () => 'beach.jpg' },
  'image-random': { label: 'Random Image', room: 'gallery', piece: 'frame', rotate: true, icon: '🎲', read: () => '12 images in rotation' },
  'image-latest': { label: 'Latest Image', room: 'gallery', piece: 'frame', spot: true, icon: '🆕', read: () => 'Newest: IMG_2041.jpg' },
  'image-embed':  { label: 'Web Image',    room: 'gallery', piece: 'frame', icon: '🖼️', read: () => 'from a web URL' },
  // releases
  'lobsterboard-release': { label: 'LobsterBoard', room: 'headoffice', avatar: true, cast: 'lb', walk: true, gym: false, alertStays: true, icon: '🦞', read: () => 'v0.9.1 · up to date' },
  'openclaw-release':     { label: 'OpenClaw',     room: 'headoffice', piece: 'plaque', icon: '📦', text: () => 'OpenClaw 2026.3', read: () => '2026.3.23 · up to date' },
  'release':              { label: 'Release',      room: 'headoffice', piece: 'plaque', icon: '📦', text: () => 'Jellyfin 10.9', read: () => '10.9.2 · update available' },
  // the outside of the building
  'weather':     { label: 'Weather', room: 'roof', piece: 'sky', icon: '🌡️', read: () => (typeof window !== 'undefined' && window.TOWER_WX ? `${window.TOWER_WX.temp}° · ${window.TOWER_WX.kind}` : '') },
  'text-header': { label: 'Header',  room: 'roof', piece: 'sign', icon: '🔤', read: () => 'Shown on the roof sign' },
};
// AI tools are panels on the Agent Wall, not avatars.
const AI_TOOLS = ['claude-code', 'codex-cli', 'github-copilot', 'cursor', 'gemini-cli', 'amp-code', 'factory', 'kimi-code', 'jetbrains-ai', 'minimax', 'zai', 'antigravity-local', 'claude-usage', 'ai-usage-claude', 'ai-cost-tracker', 'ai-usage'];
const AI_LABEL = { 'claude-code': 'Claude Code', 'codex-cli': 'Codex', 'github-copilot': 'Copilot', 'cursor': 'Cursor', 'gemini-cli': 'Gemini', 'amp-code': 'Amp', 'factory': 'Factory', 'kimi-code': 'Kimi', 'jetbrains-ai': 'JetBrains AI', 'minimax': 'MiniMax', 'zai': 'Z.ai', 'antigravity-local': 'Antigravity', 'claude-usage': 'Claude Usage', 'ai-usage-claude': 'Claude API', 'ai-cost-tracker': 'AI Cost', 'ai-usage': 'AI Usage' };
for (const t of AI_TOOLS) CATALOG[t] = { label: AI_LABEL[t], room: 'agentwall', piece: 'panel', icon: '🤖', read: () => `session ${rnd(5, 95)}% · week ${rnd(5, 80)}%` };

/* Rooms. art: existing artwork (else a labelled placeholder); ar: art aspect ratio = base width in floor heights.
   spots: hand-placed stations on the artwork, used in order before spreading the rest. */
const ROOMS = {
  headoffice: { name: 'Head Office', group: 'top', art: 'office', ar: 1.64, props: [{ n: 'officedesk', x: 53, w: 60, b: 5, z: 'front' }], spots: [{ x: 53, pose: 'sitting', h: .48, b: .16 }] },
  control:    { name: 'Control Room', group: 'top', art: 'control', ar: 2.68, spots: [{ x: 21 }, { x: 31 }, { x: 45 }, { x: 58 }, { x: 72 }, { x: 84 }] },
  planning:   { name: 'Planning Office', group: 'top', art: 'planning', ar: 2.06, spots: [{ x: 64 }] },
  cinema:     { name: 'Cinema', group: 'media', art: 'cinema', ar: 1.61, props: [{ n: 'couch', x: 37, w: 44, b: 6 }], spots: [{ x: 37, pose: 'sitting', h: .4, b: .15 }] },
  library:    { name: 'Media Library', group: 'media', art: 'library', ar: 2.33, spots: [{ x: 27 }, { x: 66 }] },
  desk:       { name: 'Front Desk', group: 'media', art: 'desk', ar: 1.61, props: [{ n: 'counter', x: 50, w: 74, b: 5, z: 'front' }], spots: [{ x: 46, b: .13, h: .56 }] },
  radio:      { name: 'Radio Room', group: 'media', art: 'radio', ar: 2.33, spots: [{ x: 63 }] },
  newsroom:   { name: 'Newsroom', group: 'content', art: 'newsroom', ar: 1.63, props: [{ n: 'newsdesk', x: 50, w: 62, b: 5, z: 'front' }], spots: [{ x: 50, pose: 'sitting', h: .46, b: .15 }] },
  music:      { name: 'Music Booth', group: 'content', art: 'music', ar: 2.08, spots: [{ x: 54, flip: true }] },
  gallery:    { name: 'Gallery', group: 'content', art: 'gallery', ar: 2.61, pieceSpread: 17, frameScale: 1.1 },
  office:     { name: 'Office', group: 'work', art: 'office', ar: 2.71, spots: [{ x: 33, flip: true }, { x: 66 }], pieceX: [49] },
  mail:       { name: 'Mail Room', group: 'work', art: 'mail', ar: 1.87, spots: [{ x: 50 }] },
  workshop:   { name: 'Workshop', group: 'work', art: 'workshop', ar: 1.88, spots: [{ x: 68 }] },
  trading:    { name: 'Trading Floor', group: 'work', art: 'trading', ar: 2.79, spots: [{ x: 40, flip: true }, { x: 60 }] },
  dorm:       { name: 'Dormitory', group: 'rest', art: 'dorm', ar: 2.33, shared: 'sleep' },
  gym:        { name: 'Gym', group: 'rest', art: 'gym', ar: 2.33, shared: 'gym' },
  lobby:      { name: 'Lobby', group: 'ground', art: 'lobby', ar: 2.72, shared: 'lobby', pieceX: [30, 49.5] },
  cafe:       { name: 'Cafeteria', group: 'ground', art: 'cafe', ar: 2.33, shared: 'idle' },
  dock:       { name: 'Loading Dock', group: 'ground', art: 'dock', ar: 2.33, props: [{ n: 'conveyor', x: 52, w: 52, b: 5 }, { n: 'box', x: 91, w: 6.8, b: 6 }, { n: 'box', x: 97.6, w: 6.8, b: 6 }], spots: [{ x: 84 }] },
  servers:    { name: 'Server Room', group: 'system', art: 'servers', ar: 2.33, spots: [{ x: 85 }, { x: 22 }] },
  network:    { name: 'Network Closet', group: 'system', art: 'network', ar: 1.92, spots: [{ x: 60 }] },
  yard:       { name: 'Container Yard', group: 'system', art: 'yard', ar: 2.54, spots: [{ x: 74, flip: true }] },
  agentwall:  { name: 'Agent Wall', group: 'base', agentwall: true },
  basement:   { name: 'Basement', group: 'base', art: 'basement', ar: 2.33, shared: 'alert' },
};
const GROUP_ORDER = ['work*', 'rest', 'ground', 'system', 'base'];   // work* = the offices first, then media, content, work, packed together
const WORK_GROUPS = ['top', 'media', 'content', 'work'];


/* Widgets deliberately left out of the tower (layout, navigation, and the ones the owner dropped). */
const TOWER_NONE = ['horizontal-line', 'vertical-line', 'search', 'quick-links', 'pages-menu', 'iframe-embed', 'weather-multi',
  'indoor-climate', 'power-usage', 'camera-feed', 'sleep-ring', 'lobster-tower'];

const api = { TOWER_CATALOG: CATALOG, TOWER_ROOMS: ROOMS, TOWER_NONE, TOWER_AI: AI_TOOLS, TOWER_GROUPS: { order: GROUP_ORDER, work: WORK_GROUPS }, countdownDays };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);

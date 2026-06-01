import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'pages/teddy-house/index.html',
  'pages/teddy-house/logs/index.html',
  'pages/teddy-house/logs.js',
  'pages/teddy-house/style.css',
  'pages/teddy-house/script.js',
  'pages/teddy-house/manifest.webmanifest',
  'pages.json',
  'server/config.cjs',
  'server.cjs',
  'scripts/homebase-capture-incident.mjs'
];

const failures = [];

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const file of files) {
  const text = read(file);
  expect(!/\t/.test(text), `${file}: contains tab indentation`);
  expect(!/[ \t]+$/m.test(text), `${file}: contains trailing whitespace`);
}

const html = read('pages/teddy-house/index.html');
const logsHtml = read('pages/teddy-house/logs/index.html');
const logsScript = read('pages/teddy-house/logs.js');
const css = read('pages/teddy-house/style.css');
const script = read('pages/teddy-house/script.js');
const serverConfig = read('server/config.cjs');
const server = read('server.cjs');
const manifest = JSON.parse(read('pages/teddy-house/manifest.webmanifest'));
const pagesConfig = JSON.parse(read('pages.json'));
const focusPageConfig = JSON.parse(read('pages/focus-room/page.json'));
const packageConfig = JSON.parse(read('package.json'));
const incidentCaptureScript = read('scripts/homebase-capture-incident.mjs');

expect(html.includes('name="apple-mobile-web-app-title" content="Teddy Homebase"'), 'missing iPad/iPhone app title');
expect(html.includes('window.location.protocol === "file:"'), 'file-open guard must redirect to served Homebase route');
expect(html.includes('http://127.0.0.1:8080/pages/teddy-house/'), 'file-open guard must target local Homebase server');
expect(html.includes('rel="apple-touch-icon" href="/pages/teddy-house/apple-touch-icon.png"'), 'missing Apple touch icon');
expect(html.includes('rel="manifest" href="/pages/teddy-house/manifest.webmanifest"'), 'missing web app manifest');
expect(html.includes('id="ask-teddy"'), 'missing Ask Teddy command bar');
expect(html.includes('id="house-state"'), 'missing house-state daily surface');
expect(html.includes('id="incident-meta"'), 'missing active incident metadata surface');
expect(html.includes('https://openclaw-mac-mini.tail02a3b6.ts.net:3001/'), 'missing tailnet AdGuard operator link');
expect(html.includes('>AdGuard</a>'), 'missing AdGuard operator link label');
expect(html.includes('House State'), 'missing house-state shell copy');
expect(html.includes('Evidence'), 'missing evidence shell copy');
expect(logsHtml.includes('Homebase Logs'), 'missing hidden logs detail page');
expect(logsHtml.includes('/pages/teddy-house/logs.js'), 'logs detail page must load its client script');
expect(logsScript.includes('/api/pages/teddy-house/logs'), 'logs detail client must call page-local logs API');
expect(logsScript.includes('currentFocus'), 'logs detail client must support focused evidence links');
expect(!logsScript.match(/password|token|access_token|refresh_token|id_token|cloud_token/i), 'logs detail client must not contain credential copy');
expect(!html.includes('href="/pages/focus-room/"'), 'Homebase should not link to orphaned Focus Room');
expect(pagesConfig.pages['focus-room']?.enabled === false, 'Focus Room must stay disabled in the app registry');
expect(focusPageConfig.enabled === false, 'Focus Room page metadata must stay disabled');
expect(focusPageConfig.nav === false, 'Focus Room page metadata must stay out of navigation');
expect(pagesConfig.pages['claude-usage']?.enabled === false, 'Claude Usage must stay disabled in the app registry');
expect(manifest.display === 'standalone', 'manifest display must be standalone');
expect(manifest.start_url === '/pages/teddy-house/', 'manifest start_url must stay on Teddy Homebase');
expect(manifest.scope === '/', 'manifest scope must include /login after auth redirects');
expect(manifest.icons.some(icon => icon.sizes === '192x192'), 'manifest missing 192 icon');
expect(manifest.icons.some(icon => icon.sizes === '512x512'), 'manifest missing 512 icon');

expect(css.includes('min-height: 100dvh'), 'CSS must support dynamic mobile viewport height');
expect(css.includes('@media (max-width: 1240px)'), 'CSS must include iPad/tablet breakpoint');
expect(css.includes('@media (max-width: 720px)'), 'CSS must include phone breakpoint');
expect(css.includes('.house-zone-grid'), 'CSS must include house-state zone grid');
expect(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'tablet layout must keep useful two-column grids');
expect(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), 'tablet layout must keep three-column vitals');
expect(!css.includes('letter-spacing: -'), 'negative letter spacing is banned for this UI');
expect(!html.includes('teddy-focus-room-preview.mp4'), 'Homebase must not embed the Focus Room video');

expect(script.includes('const REFRESH_MS = 420000'), 'manual/auto refresh interval must stay at 420 seconds');
expect(script.includes('async function askTeddy'), 'Ask Teddy client handler must stay wired');
expect(script.includes('/api/pages/teddy-house/ask'), 'Ask Teddy client must call page-local ask route');
expect(script.includes('function renderHouseState'), 'Homebase must render the house-state layer');
expect(script.includes('function renderIncidentMeta'), 'Homebase must render incident source, confidence, time, and next action');
expect(script.includes("Dan's house is steady."), 'summary copy should use house-state language');
expect(!script.match(/sparkline|SPARKS|trend/i), 'fake trend or sparkline language must stay out');
expect(!script.includes('Teddy House'), 'visible script copy should use Teddy Homebase');
expect(!script.match(/needs eyes|worth eyes|Everything important|Nothing to do|Live reads|Real data/i), 'dashboard copy should stay polished and direct');
expect(script.includes('to review'), 'dashboard copy should keep direct review language');
expect(!script.includes('All core systems are online.'), 'service-dashboard headline should stay out of the daily surface');

expect(server.includes('PUBLIC_INSTALL_ASSETS'), 'server must keep explicit public install asset allowlist');
expect(server.includes("'/pages/teddy-house/manifest.webmanifest'"), 'manifest must be in public install asset allowlist');
expect(server.includes("'/pages/teddy-house/apple-touch-icon.png'"), 'touch icon must be in public install asset allowlist');
expect(/['"]\.mp4['"]:\s*['"]video\/mp4['"]/.test(serverConfig), 'server must serve MP4 previews with the correct MIME type');
expect(!/process\.env\.DASHBOARD_PASSWORD\s*=/.test(server), 'server must not assign dashboard passwords in code');
expect(packageConfig.scripts['homebase:capture-incident'] === 'node scripts/homebase-capture-incident.mjs', 'missing incident capture npm script');
expect(incidentCaptureScript.includes("join(DATA_DIR, 'qa', 'incident-drafts')"), 'incident capture must write drafts outside committed fixture directory');
expect(incidentCaptureScript.includes("status: 'draft'"), 'incident capture output must be marked draft');
expect(incidentCaptureScript.includes('function redactText'), 'incident capture must redact persisted evidence');
expect(!incidentCaptureScript.includes('tests/fixtures/teddy-house/incidents'), 'incident capture must not write directly into permanent replay fixtures');

if (failures.length > 0) {
  console.error(failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`static lint passed (${files.length} files)`);

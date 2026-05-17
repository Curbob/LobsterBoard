import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'pages/teddy-house/index.html',
  'pages/teddy-house/style.css',
  'pages/teddy-house/script.js',
  'pages/teddy-house/manifest.webmanifest',
  'server.cjs'
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
const css = read('pages/teddy-house/style.css');
const script = read('pages/teddy-house/script.js');
const server = read('server.cjs');
const manifest = JSON.parse(read('pages/teddy-house/manifest.webmanifest'));

expect(html.includes('name="apple-mobile-web-app-title" content="Teddy Homebase"'), 'missing iPad/iPhone app title');
expect(html.includes('window.location.protocol === "file:"'), 'file-open guard must redirect to served Homebase route');
expect(html.includes('http://127.0.0.1:8080/pages/teddy-house/'), 'file-open guard must target local Homebase server');
expect(html.includes('rel="apple-touch-icon" href="/pages/teddy-house/apple-touch-icon.png"'), 'missing Apple touch icon');
expect(html.includes('rel="manifest" href="/pages/teddy-house/manifest.webmanifest"'), 'missing web app manifest');
expect(html.includes('id="ask-teddy"'), 'missing Ask Teddy command bar');
expect(manifest.display === 'standalone', 'manifest display must be standalone');
expect(manifest.start_url === '/pages/teddy-house/', 'manifest start_url must stay on Teddy Homebase');
expect(manifest.scope === '/', 'manifest scope must include /login after auth redirects');
expect(manifest.icons.some(icon => icon.sizes === '192x192'), 'manifest missing 192 icon');
expect(manifest.icons.some(icon => icon.sizes === '512x512'), 'manifest missing 512 icon');

expect(css.includes('min-height: 100dvh'), 'CSS must support dynamic mobile viewport height');
expect(css.includes('@media (max-width: 1240px)'), 'CSS must include iPad/tablet breakpoint');
expect(css.includes('@media (max-width: 720px)'), 'CSS must include phone breakpoint');
expect(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'tablet layout must keep useful two-column grids');
expect(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), 'tablet layout must keep three-column vitals');
expect(!css.includes('letter-spacing: -'), 'negative letter spacing is banned for this UI');

expect(script.includes('const REFRESH_MS = 420000'), 'manual/auto refresh interval must stay at 420 seconds');
expect(script.includes('async function askTeddy'), 'Ask Teddy client handler must stay wired');
expect(script.includes('/api/pages/teddy-house/ask'), 'Ask Teddy client must call page-local ask route');
expect(!script.match(/sparkline|SPARKS|trend/i), 'fake trend or sparkline language must stay out');
expect(!script.includes('Teddy House'), 'visible script copy should use Teddy Homebase');
expect(!script.match(/needs eyes|worth eyes|Everything important|Nothing to do|Live reads|Real data/i), 'dashboard copy should stay polished and direct');
expect(script.includes('to review'), 'dashboard copy should keep direct review language');
expect(script.includes('All core systems are online.'), 'summary copy should use polished status language');

expect(server.includes('PUBLIC_INSTALL_ASSETS'), 'server must keep explicit public install asset allowlist');
expect(server.includes("'/pages/teddy-house/manifest.webmanifest'"), 'manifest must be in public install asset allowlist');
expect(server.includes("'/pages/teddy-house/apple-touch-icon.png'"), 'touch icon must be in public install asset allowlist');
expect(!/process\.env\.DASHBOARD_PASSWORD\s*=/.test(server), 'server must not assign dashboard passwords in code');

if (failures.length > 0) {
  console.error(failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`static lint passed (${files.length} files)`);

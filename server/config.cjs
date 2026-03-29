const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const PKG_DIR = process.env.LOBSTERBOARD_PKG_DIR || path.resolve(__dirname, '..');
const USER_PAGES_DIR = path.join(CWD, 'pages');
const PKG_PAGES_DIR = path.join(PKG_DIR, 'pages');
const PAGES_DIRS = [PKG_PAGES_DIR];
if (CWD !== PKG_DIR && fs.existsSync(USER_PAGES_DIR)) {
  PAGES_DIRS.push(USER_PAGES_DIR);
}
const PAGES_DIR = fs.existsSync(USER_PAGES_DIR) ? USER_PAGES_DIR : PKG_PAGES_DIR;
const USER_PAGES_JSON = path.join(CWD, 'pages.json');
const PKG_PAGES_JSON = path.join(PKG_DIR, 'pages.json');
const PAGES_JSON = fs.existsSync(USER_PAGES_JSON) ? USER_PAGES_JSON : PKG_PAGES_JSON;
const DATA_DIR = path.join(CWD, 'data');

const CONFIG_FILE = path.join(CWD, 'config.json');
const AUTH_FILE = path.join(CWD, 'auth.json');
const SECRETS_FILE = path.join(CWD, 'secrets.json');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.map': 'application/json'
};

function readJsonFile(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); } catch (_) { return fallback; }
}

function writeJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function migrateUserData() {
  const filesToMigrate = ['config.json', 'auth.json', 'secrets.json', 'todos.json', 'notes.json'];
  const dirsToMigrate = ['data'];
  let migrated = [];

  for (const file of filesToMigrate) {
    const userPath = path.join(CWD, file);
    const pkgPath = path.join(PKG_DIR, file);
    if (!fs.existsSync(userPath) && fs.existsSync(pkgPath)) {
      try {
        fs.copyFileSync(pkgPath, userPath);
        migrated.push(file);
      } catch (e) { /* ignore */ }
    }
  }

  for (const dir of dirsToMigrate) {
    const userDir = path.join(CWD, dir);
    const pkgDir = path.join(PKG_DIR, dir);
    if (!fs.existsSync(userDir) && fs.existsSync(pkgDir)) {
      try {
        fs.cpSync(pkgDir, userDir, { recursive: true });
        migrated.push(dir + '/');
      } catch (e) { /* ignore */ }
    }
  }

  if (migrated.length > 0) {
    console.log(`📦 Migrated data to working directory: ${migrated.join(', ')}`);
  }
}

if (CWD !== PKG_DIR) {
  migrateUserData();
}

function scanTemplates(templatesDir) {
  const templates = [];
  try {
    const dirs = fs.readdirSync(templatesDir);
    for (const dir of dirs) {
      if (dir === 'templates.json' || dir === 'README.md' || dir.startsWith('.')) continue;
      const metaPath = path.join(templatesDir, dir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          templates.push(meta);
        } catch (_) {}
      }
    }
  } catch (_) {}
  return templates;
}

let _releaseCache = null;
let _releaseCacheTime = 0;
let _lbReleaseCache = null;
let _lbReleaseCacheTime = 0;

module.exports = {
  CWD,
  PKG_DIR,
  USER_PAGES_DIR,
  PKG_PAGES_DIR,
  PAGES_DIRS,
  PAGES_DIR,
  PAGES_JSON,
  DATA_DIR,
  CONFIG_FILE,
  AUTH_FILE,
  SECRETS_FILE,
  MIME_TYPES,
  readJsonFile,
  writeJsonFile,
  scanTemplates,
  get _releaseCache() { return _releaseCache; },
  set _releaseCache(v) { _releaseCache = v; },
  get _releaseCacheTime() { return _releaseCacheTime; },
  set _releaseCacheTime(v) { _releaseCacheTime = v; },
  get _lbReleaseCache() { return _lbReleaseCache; },
  set _lbReleaseCache(v) { _lbReleaseCache = v; },
  get _lbReleaseCacheTime() { return _lbReleaseCacheTime; },
  set _lbReleaseCacheTime(v) { _lbReleaseCacheTime = v; },
};

const fs = require('fs');
const path = require('path');
const config = require('./config.cjs');

const { PAGES_DIRS, PAGES_DIR, PAGES_JSON, DATA_DIR } = config;

function loadPages() {
  const pages = [];
  const seenIds = new Set();
  let overrides = { pages: {} };
  try { overrides = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf8')); } catch (_) {}

  for (const pagesDir of PAGES_DIRS) {
    let dirs;
    try { dirs = fs.readdirSync(pagesDir); } catch (_) { continue; }

    for (const dir of dirs) {
      if (dir.startsWith('_')) continue;
      const metaPath = path.join(pagesDir, dir, 'page.json');
      if (!fs.existsSync(metaPath)) continue;

      let meta;
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { continue; }

      const override = overrides.pages[meta.id] || {};
      meta.enabled = override.enabled ?? meta.enabled ?? true;
      meta.order = override.order ?? meta.order ?? 99;

      if (!meta.enabled) continue;

      if (seenIds.has(meta.id)) {
        const idx = pages.findIndex(p => p.id === meta.id);
        if (idx !== -1) pages.splice(idx, 1);
      }
      seenIds.add(meta.id);

      meta._pagesDir = pagesDir;

      const dataDir = path.join(DATA_DIR, meta.id);
      fs.mkdirSync(dataDir, { recursive: true });

      let apiPath = path.join(pagesDir, dir, 'api.cjs');
      if (!fs.existsSync(apiPath)) apiPath = path.join(pagesDir, dir, 'api.js');
      let routes = {};
      if (fs.existsSync(apiPath)) {
        try {
          const ctx = {
            dataDir,
            readData: (filename) => JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8')),
            writeData: (filename, obj) => {
              fs.mkdirSync(dataDir, { recursive: true });
              fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(obj, null, 2));
            }
          };
          const pageModule = require(apiPath)(ctx);
          routes = pageModule.routes || {};
        } catch (e) {
          console.error(`Error loading page API for ${meta.id}:`, e.message);
        }
      }

      pages.push({
        id: meta.id,
        title: meta.title,
        icon: meta.icon,
        description: meta.description,
        order: meta.order,
        nav: meta.nav !== false,
        _pagesDir: pagesDir,
        routes
      });
    }
  }

  return pages.sort((a, b) => a.order - b.order);
}

function compileRoute(pattern) {
  const [method, ...pathParts] = pattern.split(' ');
  const routePath = pathParts.join(' ');
  const paramNames = [];

  let regexStr = routePath.replace(/\*/g, '(.+)').replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  const hasWildcard = routePath.includes('*');
  if (hasWildcard && !paramNames.includes('*')) {
    const parts = routePath.split('/');
    let wildcardIdx = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '*') {
        paramNames.splice(wildcardIdx, 0, '*');
        break;
      }
      if (parts[i].startsWith(':')) wildcardIdx++;
      if (parts[i] === '*') break;
    }
  }

  return { method: method.toUpperCase(), regex: new RegExp('^' + regexStr + '$'), paramNames };
}

function matchPageRoute(pages, method, pathname, parsedUrl) {
  if (method === 'GET' && pathname === '/api/pages') {
    return { type: 'list' };
  }

  const pagesMatch = pathname.match(/^\/pages\/([^/]+)(\/.*)?$/);
  if (pagesMatch) {
    const pageId = pagesMatch[1];
    if (pageId === '_shared') {
      return { type: 'static', filePath: path.join(PAGES_DIR, '_shared', (pagesMatch[2] || '/').slice(1)) };
    }
    const page = pages.find(p => p.id === pageId);
    if (page) {
      const subPath = pagesMatch[2] || '';
      if (!subPath) {
        return { type: 'redirect', location: `/pages/${pageId}/` };
      }
      const pageDir = page._pagesDir || PAGES_DIR;
      if (subPath === '/') {
        return { type: 'static', filePath: path.join(pageDir, pageId, 'index.html') };
      }
      return { type: 'static', filePath: path.join(pageDir, pageId, subPath.slice(1)) };
    }
  }

  const apiMatch = pathname.match(/^\/api\/pages\/([^/]+)(\/.*)?$/);
  if (apiMatch) {
    const pageId = apiMatch[1];
    const page = pages.find(p => p.id === pageId);
    if (!page) return null;

    const subPath = apiMatch[2] || '/';
    const routeEntries = Object.entries(page.routes);

    routeEntries.sort((a, b) => {
      const aHasWild = a[0].includes('*');
      const bHasWild = b[0].includes('*');
      if (aHasWild !== bHasWild) return aHasWild ? 1 : -1;
      return b[0].length - a[0].length;
    });

    for (const [pattern, handler] of routeEntries) {
      const compiled = compileRoute(pattern);
      if (compiled.method !== method) continue;
      const match = subPath.match(compiled.regex);
      if (match) {
        const params = {};
        compiled.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        const query = {};
        parsedUrl.searchParams.forEach((v, k) => { query[k] = v; });
        return { type: 'api', handler, params, query, pageId };
      }
    }
  }

  return null;
}

module.exports = {
  loadPages,
  compileRoute,
  matchPageRoute,
};

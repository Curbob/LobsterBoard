const fs = require('fs');
const path = require('path');
const { sendResponse, sendJson, sendError } = require('../response.cjs');
const { CONFIG_FILE, MIME_TYPES, scanTemplates } = require('../config.cjs');

function handle(req, res, pathname, parsedUrl, ctx) {
  const TEMPLATES_DIR = path.join(ctx.__dirname, 'templates');

  if (req.method === 'GET' && pathname === '/api/templates') {
    try {
      const templates = scanTemplates(TEMPLATES_DIR);
      sendJson(res, 200, templates);
    } catch (e) {
      sendError(res, `Failed to list templates: ${e.message}`);
    }
    return true;
  }

  if (req.method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)$/) && !pathname.endsWith('/preview')) {
    const id = pathname.split('/')[3];
    const configPath = path.join(TEMPLATES_DIR, id, 'config.json');
    if (!fs.existsSync(configPath)) { sendJson(res, 404, { error: 'Template not found' }); return true; }
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      sendJson(res, 200, config);
    } catch (e) { sendError(res, e.message); }
    return true;
  }

  if (req.method === 'GET' && pathname.match(/^\/api\/templates\/([^/]+)\/preview$/)) {
    const id = pathname.split('/')[3];
    const metaPath = path.join(TEMPLATES_DIR, id, 'meta.json');
    let previewFile = 'preview.png';
    try { previewFile = JSON.parse(fs.readFileSync(metaPath, 'utf8')).preview || 'preview.png'; } catch (_) {}
    const previewPath = path.join(TEMPLATES_DIR, id, previewFile);
    if (!fs.existsSync(previewPath)) { sendResponse(res, 404, 'text/plain', 'No preview'); return true; }
    const ext = path.extname(previewPath).toLowerCase();
    const ct = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(previewPath, (err, data) => {
      if (err) { sendResponse(res, 404, 'text/plain', 'Not found'); return; }
      sendResponse(res, 200, ct, data);
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/templates/import') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { id, mode } = JSON.parse(body);
        if (!id) { sendJson(res, 400, { error: 'Missing template id' }); return; }
        if (!mode) { sendJson(res, 400, { error: 'Missing import mode' }); return; }

        const tplConfigPath = path.join(TEMPLATES_DIR, id, 'config.json');
        if (!fs.existsSync(tplConfigPath)) { sendJson(res, 404, { error: `Template "${id}" not found` }); return; }

        let tplConfig;
        try {
          tplConfig = JSON.parse(fs.readFileSync(tplConfigPath, 'utf8'));
        } catch (parseErr) {
          sendJson(res, 500, { error: `Template config is invalid JSON: ${parseErr.message}` }); return;
        }

        if (mode === 'replace') {
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(tplConfig, null, 2));
          } catch (writeErr) {
            sendJson(res, 500, { error: `Failed to write config: ${writeErr.message}` }); return;
          }
          sendJson(res, 200, { status: 'success', message: 'Template imported (replace)' });
        } else if (mode === 'merge') {
          let currentConfig = { canvas: { width: 1920, height: 1080 }, widgets: [] };
          try { currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}
          let maxY = 0;
          for (const w of (currentConfig.widgets || [])) {
            const bottom = (w.y || 0) + (w.height || 100);
            if (bottom > maxY) maxY = bottom;
          }
          const offset = maxY + 100;
          const newWidgets = (tplConfig.widgets || []).map(w => ({
            ...w,
            id: w.id + '-tpl-' + Date.now(),
            y: (w.y || 0) + offset
          }));
          currentConfig.widgets = [...(currentConfig.widgets || []), ...newWidgets];
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
          } catch (writeErr) {
            sendJson(res, 500, { error: `Failed to write config: ${writeErr.message}` }); return;
          }
          sendJson(res, 200, { status: 'success', message: `Merged ${newWidgets.length} widgets` });
        } else {
          sendJson(res, 400, { error: 'Invalid mode. Use "replace" or "merge"' });
        }
      } catch (e) { sendJson(res, 500, { error: `Import error: ${e.message}` }); }
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/templates/export') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, description, author, tags, widgetTypes } = JSON.parse(body);
        if (!name) { sendJson(res, 400, { error: 'Name is required' }); return; }
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const tplDir = path.join(TEMPLATES_DIR, id);
        fs.mkdirSync(tplDir, { recursive: true });

        let config = { canvas: { width: 1920, height: 1080 }, widgets: [] };
        try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}

        const sensitiveKeys = ['apiKey', 'api_key', 'token', 'secret', 'password'];
        const privateIpRegex = /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|localhost|127\.0\.0\.1)/i;
        const privateUrlKeys = ['icalUrl'];
        const privateUrlPatterns = [/[?&/]private[-_]?[a-f0-9]/i, /caldav\.icloud\.com/i, /\/private\//i];

        function stripSensitive(props) {
          if (!props || typeof props !== 'object') return props;
          let stripped = false;
          const result = Array.isArray(props) ? [...props] : { ...props };
          for (const key of Object.keys(result)) {
            if (sensitiveKeys.includes(key)) {
              result[key] = 'YOUR_API_KEY_HERE';
              stripped = true;
            } else if ((key === 'url' || key === 'endpoint') && typeof result[key] === 'string' && privateIpRegex.test(result[key])) {
              result[key] = 'http://your-server:port/path';
              stripped = true;
            } else if (privateUrlKeys.includes(key) && typeof result[key] === 'string') {
              if (result[key] && (result[key].length > 0)) {
                const hasPrivateToken = privateUrlPatterns.some(p => p.test(result[key]));
                if (hasPrivateToken) {
                  result[key] = '';
                  stripped = true;
                }
              }
            } else if (typeof result[key] === 'object' && result[key] !== null) {
              const inner = stripSensitive(result[key]);
              result[key] = inner.result;
              if (inner.stripped) stripped = true;
            }
          }
          return { result, stripped };
        }

        const cleanWidgets = (config.widgets || []).map(w => {
          const cleaned = { ...w };
          if (cleaned.properties) {
            const { result, stripped } = stripSensitive(cleaned.properties);
            cleaned.properties = result;
            if (stripped) cleaned._templateNote = '⚠��� Configure this widget\'s settings after import';
          }
          return cleaned;
        });

        const cleanConfig = { canvas: config.canvas, widgets: cleanWidgets };
        fs.writeFileSync(path.join(tplDir, 'config.json'), JSON.stringify(cleanConfig, null, 2));

        const canvasSize = config.canvas ? `${config.canvas.width}x${config.canvas.height}` : '1920x1080';
        const meta = {
          id,
          name,
          description: description || '',
          author: author || 'anonymous',
          tags: tags || [],
          canvasSize,
          widgetCount: cleanWidgets.length,
          widgetTypes: widgetTypes || [],
          requiresSetup: [],
          preview: 'preview.png'
        };
        fs.writeFileSync(path.join(tplDir, 'meta.json'), JSON.stringify(meta, null, 2));

        const templates = scanTemplates(TEMPLATES_DIR);
        fs.writeFileSync(path.join(TEMPLATES_DIR, 'templates.json'), JSON.stringify(templates, null, 2));

        sendJson(res, 200, { status: 'success', id, message: `Template "${name}" exported` });
      } catch (e) { sendError(res, e.message); }
    });
    return true;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/templates\/[^/]+\/screenshot$/)) {
    const tplId = pathname.split('/')[3];
    const tplDir = path.join(TEMPLATES_DIR, tplId);
    if (!fs.existsSync(tplDir)) { sendJson(res, 404, { error: 'Template not found' }); return true; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { data } = JSON.parse(body);
        const match = data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) { sendJson(res, 400, { error: 'Invalid image data' }); return; }
        const buf = Buffer.from(match[2], 'base64');
        fs.writeFileSync(path.join(tplDir, 'preview.png'), buf);
        sendJson(res, 200, { status: 'ok' });
      } catch (e) { sendError(res, e.message); }
    });
    return true;
  }

  if (req.method === 'DELETE' && pathname.match(/^\/api\/templates\/[^/]+$/)) {
    const tplId = pathname.split('/')[3];
    const tplDir = path.join(TEMPLATES_DIR, tplId);
    if (!fs.existsSync(tplDir)) { sendJson(res, 404, { error: 'Template not found' }); return true; }
    try {
      fs.rmSync(tplDir, { recursive: true, force: true });
      sendJson(res, 200, { status: 'success', message: `Template "${tplId}" deleted` });
    } catch (e) { sendError(res, e.message); }
    return true;
  }

  return false;
}

module.exports = function(context) {
  return { handle: (req, res, pathname, parsedUrl) => handle(req, res, pathname, parsedUrl, context) };
};

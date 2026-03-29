const fs = require('fs');
const path = require('path');
const os = require('os');
const { sendResponse, sendJson, sendError } = require('../response.cjs');
const { CWD, MIME_TYPES } = require('../config.cjs');

function latestImageHandler(parsedUrl, res) {
  const dir = parsedUrl.searchParams.get('dir');
  if (!dir) return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Missing dir parameter' }));
  const resolved = path.resolve(dir.replace(/^~/, os.homedir()));
  const home = os.homedir();
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Directory must be under home' }));
  }
  try {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const files = fs.readdirSync(resolved)
      .filter(f => imageExts.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(resolved, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', image: null, message: 'No images found' }));
    const latest = files[0];
    const ext = path.extname(latest.name).toLowerCase().replace('.', '');
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const data = fs.readFileSync(path.join(resolved, latest.name));
    const b64 = data.toString('base64');
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', image: { name: latest.name, mtime: latest.mtime, dataUrl: `data:${mime};base64,${b64}` }, total: files.length }));
  } catch (error) {
    return sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: error.message }));
  }
}

function handle(req, res, pathname, parsedUrl, ctx) {
  if (req.method === 'GET' && pathname === '/api/latest-image') {
    latestImageHandler(parsedUrl, res);
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/browse-dirs') {
    const dir = parsedUrl.searchParams.get('dir') || os.homedir();
    const resolved = path.resolve(dir.replace(/^~/, os.homedir()));
    const home = os.homedir();
    if (!resolved.startsWith(home + path.sep) && resolved !== home) {
      sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: 'Must be under home directory' }));
      return true;
    }
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
      const imageCount = fs.readdirSync(resolved).filter(f => imageExts.includes(path.extname(f).toLowerCase())).length;
      sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'ok', path: resolved, dirs: entries, imageCount }));
    } catch (error) {
      sendResponse(res, 200, 'application/json', JSON.stringify({ status: 'error', message: error.message }));
    }
    return true;
  }

  return false;
}

module.exports = function(context) {
  return { handle: (req, res, pathname, parsedUrl) => handle(req, res, pathname, parsedUrl, context) };
};

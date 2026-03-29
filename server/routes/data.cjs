const fs = require('fs');
const path = require('path');
const { sendJson, sendError } = require('../response.cjs');
const { CWD } = require('../config.cjs');

function handle(req, res, pathname) {
  if (pathname === '/api/todos') {
    const todosFile = path.join(CWD, 'todos.json');
    if (req.method === 'GET') {
      fs.readFile(todosFile, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') return sendJson(res, 200, []);
          return sendError(res, err.message);
        }
        try { sendJson(res, 200, JSON.parse(data)); }
        catch (e) { sendJson(res, 200, []); }
      });
      return true;
    }
    if (req.method === 'POST') {
      const MAX_TODO_BODY = 256 * 1024;
      let body = '';
      let overflow = false;
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > MAX_TODO_BODY) { overflow = true; req.destroy(); }
      });
      req.on('end', () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        try {
          const todos = JSON.parse(body);
          fs.writeFile(todosFile, JSON.stringify(todos, null, 2), 'utf8', (err) => {
            if (err) return sendError(res, err.message);
            sendJson(res, 200, { status: 'ok' });
          });
        } catch (e) { sendError(res, 'Invalid JSON', 400); }
      });
      return true;
    }
  }

  if (pathname === '/api/notes') {
    const notesFile = path.join(CWD, 'notes.json');
    if (req.method === 'GET') {
      fs.readFile(notesFile, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') return sendJson(res, 200, {});
          return sendError(res, err.message);
        }
        try { sendJson(res, 200, JSON.parse(data)); }
        catch (e) { sendJson(res, 200, {}); }
      });
      return true;
    }
    if (req.method === 'POST') {
      const MAX_NOTES_BODY = 512 * 1024;
      let body = '';
      let overflow = false;
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > MAX_NOTES_BODY) { overflow = true; req.destroy(); }
      });
      req.on('end', () => {
        if (overflow) { sendError(res, 'Request body too large', 413); return; }
        try {
          const notes = JSON.parse(body);
          fs.writeFile(notesFile, JSON.stringify(notes, null, 2), 'utf8', (err) => {
            if (err) return sendError(res, err.message);
            sendJson(res, 200, { status: 'ok' });
          });
        } catch (e) { sendError(res, 'Invalid JSON', 400); }
      });
      return true;
    }
  }

  return false;
}

module.exports = function() {
  return { handle };
};

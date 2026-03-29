const fs = require('fs');
const path = require('path');
const { sendJson } = require('../response.cjs');
const { CWD } = require('../config.cjs');
const { generateEcdhKeyPair, deriveSharedSecret, decryptPayload } = require('../crypto.cjs');

const SERVERS_FILE = path.join(CWD, 'data', 'servers.json');

function loadServers() {
  try {
    if (fs.existsSync(SERVERS_FILE)) {
      return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return [{ id: 'local', name: 'Local', type: 'local' }];
}

function saveServers(servers) {
  fs.mkdirSync(path.dirname(SERVERS_FILE), { recursive: true });
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

function handle(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/servers') {
    const servers = loadServers();
    const masked = servers.map(s => ({
      ...s,
      apiKey: s.apiKey ? s.apiKey.slice(0, 10) + '...' : undefined,
      sharedSecret: s.sharedSecret ? '🔐' : undefined,
    }));
    sendJson(res, 200, { servers: masked });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/servers') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { name, url, apiKey } = JSON.parse(body);
        if (!name || !url || !apiKey) {
          return sendJson(res, 400, { error: 'name, url, and apiKey required' });
        }
        const servers = loadServers();
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (servers.find(s => s.id === id)) {
          return sendJson(res, 400, { error: 'Server with this name already exists' });
        }

        const keyPair = generateEcdhKeyPair();

        let sharedSecret = null;
        let encrypted = false;
        try {
          const handshakeRes = await fetch(url + '/handshake', {
            method: 'POST',
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clientId: id,
              publicKey: keyPair.publicKey,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (handshakeRes.ok) {
            const handshakeData = await handshakeRes.json();
            if (handshakeData.publicKey) {
              sharedSecret = deriveSharedSecret(keyPair.privateKey, handshakeData.publicKey);
              encrypted = true;
              console.log(`🔐 Encrypted connection established with server: ${name}`);
            }
          }
        } catch (e) {
          console.log(`⚠️ Handshake failed for ${name}, using unencrypted: ${e.message}`);
        }

        const serverEntry = {
          id,
          name,
          url,
          apiKey,
          type: 'remote',
          encrypted,
        };

        if (sharedSecret) {
          serverEntry.sharedSecret = sharedSecret.toString('base64');
          serverEntry.clientId = id;
        }

        servers.push(serverEntry);
        saveServers(servers);
        sendJson(res, 200, { status: 'success', id, encrypted });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return true;
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/servers/')) {
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const servers = loadServers();
        const idx = servers.findIndex(s => s.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Server not found' });
        if (id === 'local') return sendJson(res, 400, { error: 'Cannot modify local server' });
        servers[idx] = { ...servers[idx], ...updates, id };
        saveServers(servers);
        sendJson(res, 200, { status: 'success' });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return true;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/servers/')) {
    const id = pathname.split('/')[3];
    if (id === 'local') return (sendJson(res, 400, { error: 'Cannot delete local server' }), true);
    const servers = loadServers();
    const filtered = servers.filter(s => s.id !== id);
    if (filtered.length === servers.length) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }
    saveServers(filtered);
    sendJson(res, 200, { status: 'success' });
    return true;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/servers\/[^/]+\/test$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const server = servers.find(s => s.id === id);
    if (!server) return (sendJson(res, 404, { error: 'Server not found' }), true);
    if (server.type === 'local') {
      sendJson(res, 200, { status: 'ok', message: 'Local server' });
      return true;
    }
    fetch(server.url + '/health', {
      headers: { 'X-API-Key': server.apiKey },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => sendJson(res, 200, {
        status: 'ok',
        serverName: data.serverName,
        agentEncryption: data.encrypted || false,
        localEncryption: server.encrypted || false,
      }))
      .catch(e => sendJson(res, 200, { status: 'error', message: e.message }));
    return true;
  }

  if (req.method === 'POST' && pathname.match(/^\/api\/servers\/[^/]+\/handshake$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const serverIdx = servers.findIndex(s => s.id === id);
    if (serverIdx === -1) return (sendJson(res, 404, { error: 'Server not found' }), true);
    const server = servers[serverIdx];
    if (server.type === 'local') {
      sendJson(res, 400, { error: 'Local server does not need handshake' });
      return true;
    }

    (async () => {
      try {
        const keyPair = generateEcdhKeyPair();

        const handshakeRes = await fetch(server.url + '/handshake', {
          method: 'POST',
          headers: {
            'X-API-Key': server.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: id,
            publicKey: keyPair.publicKey,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!handshakeRes.ok) {
          const err = await handshakeRes.json().catch(() => ({ error: 'HTTP ' + handshakeRes.status }));
          return sendJson(res, 500, { error: err.error || 'Handshake failed' });
        }

        const handshakeData = await handshakeRes.json();
        if (!handshakeData.publicKey) {
          return sendJson(res, 500, { error: 'Agent did not return public key' });
        }

        const sharedSecret = deriveSharedSecret(keyPair.privateKey, handshakeData.publicKey);

        servers[serverIdx].encrypted = true;
        servers[serverIdx].sharedSecret = sharedSecret.toString('base64');
        servers[serverIdx].clientId = id;
        saveServers(servers);

        console.log(`🔐 Re-established encrypted connection with server: ${server.name}`);
        sendJson(res, 200, { status: 'ok', encrypted: true });
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
    })();
    return true;
  }

  if (req.method === 'GET' && pathname.match(/^\/api\/servers\/[^/]+\/stats$/)) {
    const id = pathname.split('/')[3];
    const servers = loadServers();
    const server = servers.find(s => s.id === id);
    if (!server) return (sendJson(res, 404, { error: 'Server not found' }), true);
    if (server.type === 'local') {
      sendJson(res, 400, { error: 'Use /api/stats/stream for local' });
      return true;
    }

    const headers = { 'X-API-Key': server.apiKey };
    if (server.encrypted && server.clientId) {
      headers['X-Client-ID'] = server.clientId;
    }

    fetch(server.url + '/stats', {
      headers,
      signal: AbortSignal.timeout(10000),
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        if (data.encrypted && server.sharedSecret) {
          try {
            const keyBuffer = Buffer.from(server.sharedSecret, 'base64');
            const decrypted = decryptPayload(data.encrypted, keyBuffer);
            decrypted._remote = true;
            decrypted._encrypted = true;
            return sendJson(res, 200, decrypted);
          } catch (e) {
            console.error('Decryption failed:', e.message);
            return sendJson(res, 500, { error: 'Decryption failed: ' + e.message });
          }
        }
        data._remote = true;
        sendJson(res, 200, data);
      })
      .catch(e => sendJson(res, 500, { error: e.message }));
    return true;
  }

  return false;
}

module.exports = function() {
  return { handle };
};

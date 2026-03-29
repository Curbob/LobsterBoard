/**
 * Editor Servers Module
 * Server management modal, add/test/delete servers, server dropdown
 */
(function() {
  var state = window.BuilderState;

  function _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window._escHtml = _escHtml;

  window.openServersModal = async function openServersModal() {
    document.getElementById('servers-modal').style.display = 'flex';
    await loadServersList();
  };

  window.loadServersList = async function loadServersList() {
    var container = document.getElementById('servers-list');
    try {
      var res = await fetch('/api/servers');
      var data = await res.json();
      if (!data.servers || data.servers.length === 0) {
        container.innerHTML = '<p style="color:#8b949e;font-size:13px;">No servers configured. Add one below.</p>';
        return;
      }
      container.innerHTML = data.servers.map(function(s) {
        return '\n      <div class="server-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);border-radius:6px;margin-bottom:8px;">\n        <div>\n          <strong style="font-size:13px;">' + _escHtml(s.name) + '</strong>\n          ' + (s.type === 'local' ? '<span style="color:#8b949e;font-size:11px;margin-left:8px;">(built-in)</span>' : '<span style="color:#8b949e;font-size:11px;margin-left:8px;">' + _escHtml(s.url || '') + ' ' + (s.encrypted ? '\uD83D\uDD10' : '') + '</span>') + '\n        </div>\n        <div style="display:flex;gap:6px;">\n          ' + (s.type !== 'local' ? '\n            <button class="btn btn-sm btn-secondary" onclick="testServer(\'' + s.id + '\')">Test</button>\n            <button class="btn btn-sm btn-danger" onclick="deleteServer(\'' + s.id + '\')">Delete</button>\n          ' : '<span style="color:#3fb950;font-size:12px;">\u2713 Local</span>') + '\n        </div>\n      </div>';
      }).join('');
    } catch (e) {
      container.innerHTML = '<p style="color:#f85149;">Failed to load servers</p>';
    }
  };

  window.addServer = async function addServer() {
    var name = document.getElementById('server-name').value.trim();
    var url = document.getElementById('server-url').value.trim();
    var apiKey = document.getElementById('server-apikey').value.trim();
    var resultEl = document.getElementById('server-add-result');

    if (!name || !url || !apiKey) {
      resultEl.innerHTML = '<span style="color:#f85149;">All fields are required</span>';
      return;
    }

    try {
      var res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, url: url, apiKey: apiKey })
      });
      var data = await res.json();
      if (data.status === 'success') {
        resultEl.innerHTML = '<span style="color:#3fb950;">\u2713 Server added</span>';
        document.getElementById('server-name').value = '';
        document.getElementById('server-url').value = '';
        document.getElementById('server-apikey').value = '';
        invalidateServerCache();
        await loadServersList();
      } else {
        resultEl.innerHTML = '<span style="color:#f85149;">' + _escHtml(data.error || 'Failed to add') + '</span>';
      }
    } catch (e) {
      resultEl.innerHTML = '<span style="color:#f85149;">Network error</span>';
    }
  };

  window.testServerConnection = async function testServerConnection() {
    var url = document.getElementById('server-url').value.trim();
    var apiKey = document.getElementById('server-apikey').value.trim();
    var resultEl = document.getElementById('server-add-result');

    if (!url || !apiKey) {
      resultEl.innerHTML = '<span style="color:#f85149;">URL and API Key required</span>';
      return;
    }

    resultEl.innerHTML = '<span style="color:#8b949e;">Testing...</span>';
    try {
      var res = await fetch(url + '/health', {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        var data = await res.json();
        var encStatus = data.encrypted ? ' \uD83D\uDD10' : ' \u26A0\uFE0F unencrypted';
        resultEl.innerHTML = '<span style="color:#3fb950;">\u2713 Connected to ' + _escHtml(data.serverName || 'server') + encStatus + '</span>';
      } else {
        resultEl.innerHTML = '<span style="color:#f85149;">HTTP ' + res.status + '</span>';
      }
    } catch (e) {
      resultEl.innerHTML = '<span style="color:#f85149;">Connection failed: ' + _escHtml(e.message) + '</span>';
    }
  };

  window.testServer = async function testServer(id) {
    try {
      var res = await fetch('/api/servers/' + id + '/test', { method: 'POST' });
      var data = await res.json();
      if (data.status === 'ok') {
        var encStatus = data.localEncryption ? '\uD83D\uDD10 Encrypted' : '\u26A0\uFE0F Not encrypted';
        alert('\u2713 Connected to ' + (data.serverName || 'server') + '\n' + encStatus);
      } else {
        alert('Connection failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Network error');
    }
  };

  window.deleteServer = async function deleteServer(id) {
    if (!confirm('Delete this server?')) return;
    try {
      var res = await fetch('/api/servers/' + id, { method: 'DELETE' });
      var data = await res.json();
      if (data.status === 'success') {
        invalidateServerCache();
        await loadServersList();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  // Server dropdown for system widgets
  var _cachedServers = null;

  window.populateServerDropdown = async function populateServerDropdown(selectedValue) {
    var select = document.getElementById('prop-server');
    if (!select) return;

    if (!_cachedServers) {
      try {
        var res = await fetch('/api/servers');
        var data = await res.json();
        _cachedServers = data.servers || [];
      } catch (e) {
        _cachedServers = [{ id: 'local', name: 'Local', type: 'local' }];
      }
    }

    select.innerHTML = _cachedServers.map(function(s) {
      return '<option value="' + _escHtml(s.id) + '"' + (s.id === selectedValue ? ' selected' : '') + '>' + _escHtml(s.name) + '</option>';
    }).join('');
  };

  window.invalidateServerCache = function invalidateServerCache() {
    _cachedServers = null;
  };
})();

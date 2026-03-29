/**
 * OpenClaw Dashboard Builder - Stats System
 * Shared SSE connection and remote polling for system stats widgets
 */

// ─────────────────────────────────────────────
// Shared SSE connection for system stats widgets
// ─────────────────────────────────────────────
let _statsSource = null;
let _statsCallbacks = [];
function onSystemStats(callback) {
  _statsCallbacks.push(callback);
  if (!_statsSource) {
    _statsSource = new EventSource('/api/stats/stream');
    _statsSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        _statsCallbacks.forEach(cb => cb(data));
      } catch (err) {
        console.warn('System stats: failed to parse SSE data', err);
      }
    };
    _statsSource.onerror = () => {
      // EventSource auto-reconnects; just log
      console.warn('System stats SSE connection error, reconnecting...');
    };
  }
}

// ─────────────────────────────────────────────
// Remote server polling for system stats
// ─────────────────────────────────────────────
const _remotePollers = {}; // serverId -> { interval, callbacks, lastData, errors, lastSuccess }

function onRemoteStats(serverId, callback, refreshMs = 10000) {
  if (!_remotePollers[serverId]) {
    _remotePollers[serverId] = {
      callbacks: [],
      interval: null,
      lastData: null,
      errors: 0,
      lastSuccess: null,
      offline: false
    };

    const poll = async () => {
      const poller = _remotePollers[serverId];
      try {
        const res = await fetch(`/api/servers/${serverId}/stats`, {
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        if (res.ok) {
          const data = await res.json();
          const normalized = _normalizeRemoteStats(data);
          poller.lastData = normalized;
          poller.errors = 0;
          poller.lastSuccess = Date.now();
          poller.offline = false;
          poller.callbacks.forEach(cb => cb(normalized));
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        poller.errors++;
        console.warn(`Remote stats error (${serverId}, attempt ${poller.errors}):`, e.message);

        // After 3 consecutive failures, mark as offline and notify widgets
        if (poller.errors >= 3 && !poller.offline) {
          poller.offline = true;
          const offlineData = {
            _offline: true,
            _error: e.message,
            _lastSuccess: poller.lastSuccess,
            _serverId: serverId
          };
          poller.callbacks.forEach(cb => cb(offlineData));
        }
      }
    };

    poll(); // Initial fetch
    _remotePollers[serverId].interval = setInterval(poll, refreshMs);
  }

  _remotePollers[serverId].callbacks.push(callback);

  // If we have cached data, call immediately
  if (_remotePollers[serverId].lastData) {
    callback(_remotePollers[serverId].lastData);
  }
}

// Normalize remote agent stats to match local SSE format
function _normalizeRemoteStats(data) {
  return {
    uptime: data.uptime,
    cpu: data.cpu ? {
      currentLoad: data.cpu.usage || 0,
      cores: data.cpu.cores || 0,
    } : null,
    memory: data.memory ? {
      total: data.memory.total || 0,
      active: data.memory.used || 0,
      available: data.memory.available || 0,
    } : null,
    disk: data.disk ? [{
      mount: data.disk.mount || '/',
      size: data.disk.total || 0,
      used: data.disk.used || 0,
    }] : null,
    network: data.network ? [{
      rx_sec: data.network.rxSec || 0,
      tx_sec: data.network.txSec || 0,
    }] : null,
    docker: data.docker,
    openclaw: data.openclaw,
    serverName: data.serverName,
    _remote: true,
  };
}

// Unified stats function: local or remote
function onStats(serverId, callback, refreshMs = 10000) {
  if (!serverId || serverId === 'local') {
    onSystemStats(callback);
  } else {
    onRemoteStats(serverId, callback, refreshMs);
  }
}

function _formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(decimals) + ' ' + sizes[i];
}

function _formatBytesPerSec(bytes) {
  if (bytes == null || bytes < 0) return '0 B/s';
  if (bytes < 1024) return bytes.toFixed(0) + ' B/s';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
}

function _formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// Expose helpers globally for executeWidgetScripts (new Function runs in global scope)
if (typeof window !== 'undefined') {
  window.onStats = onStats;
  window.onSystemStats = onSystemStats;
  window._formatBytes = _formatBytes;
  window._formatBytesPerSec = _formatBytesPerSec;
  window._formatUptime = _formatUptime;
}

// CommonJS export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    onSystemStats, onRemoteStats, _normalizeRemoteStats, onStats,
    _formatBytes, _formatBytesPerSec, _formatUptime,
    _statsSource, _statsCallbacks, _remotePollers
  };
}

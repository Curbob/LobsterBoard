/**
 * OpenClaw Dashboard Builder - Widget Definitions
 * Each widget defines its default size, properties, and generated code
 */

// ─────────────────────────────────────────────
// Security helpers (available to generated widget scripts via window)
// ─────────────────────────────────────────────

function _escHtmlGlobal(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
window._esc = _escHtmlGlobal;

function _isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (e) {
    return false;
  }
}
window._isSafeUrl = _isSafeUrl;

// ─────────────────────────────────────────────
// Icon System - Themeable widget icons
// ─────────────────────────────────────────────
const WIDGET_ICONS = {
  // Weather
  'weather': { emoji: '🌡️', phosphor: 'thermometer' },
  'weather-sunny': { emoji: '☀️', phosphor: 'sun' },
  'weather-cloudy': { emoji: '⛅', phosphor: 'cloud-sun' },
  'weather-rainy': { emoji: '🌧️', phosphor: 'cloud-rain' },
  'weather-snowy': { emoji: '❄️', phosphor: 'snowflake' },
  'world-weather': { emoji: '🌍', phosphor: 'globe' },
  
  // Time
  'clock': { emoji: '🕐', phosphor: 'clock' },
  'countdown': { emoji: '⏳', phosphor: 'hourglass' },
  'cron': { emoji: '⏰', phosphor: 'timer' },
  'pomodoro': { emoji: '🎯', phosphor: 'crosshair' },
  'world-clock': { emoji: '🌍', phosphor: 'globe' },
  
  // System
  'cpu': { emoji: '💻', phosphor: 'cpu' },
  'memory': { emoji: '🧠', phosphor: 'brain' },
  'disk': { emoji: '💾', phosphor: 'hard-drive' },
  'network': { emoji: '🌐', phosphor: 'wifi-high' },
  'docker': { emoji: '🐳', phosphor: 'cube' },
  'uptime': { emoji: '📡', phosphor: 'broadcast' },
  'system-log': { emoji: '🔧', phosphor: 'wrench' },
  
  // Auth / Security
  'auth': { emoji: '🔐', phosphor: 'lock-key' },
  'sleep': { emoji: '😴', phosphor: 'moon' },
  
  // Releases
  'lobster': { emoji: '🦞', phosphor: 'package' },
  'release': { emoji: '📦', phosphor: 'package' },
  
  // Lists / Activity
  'activity': { emoji: '📋', phosphor: 'list' },
  'calendar': { emoji: '📅', phosphor: 'calendar' },
  'notes': { emoji: '📝', phosphor: 'note' },
  'todo': { emoji: '✅', phosphor: 'check-square' },
  'pages': { emoji: '📑', phosphor: 'files' },
  
  // AI / Monitoring
  'ai-usage': { emoji: '🤖', phosphor: 'robot' },
  'claude-code': { emoji: '🟣', phosphor: 'circle' },
  'codex-cli': { emoji: '🟢', phosphor: 'circle' },
  'github-copilot': { emoji: '⚫', phosphor: 'circle' },
  'cursor': { emoji: '🔵', phosphor: 'circle' },
  'gemini-cli': { emoji: '🔷', phosphor: 'diamond' },
  'amp-code': { emoji: '⚡', phosphor: 'lightning' },
  'factory': { emoji: '🏭', phosphor: 'factory' },
  'kimi-code': { emoji: '🌙', phosphor: 'moon' },
  'jetbrains-ai': { emoji: '🧠', phosphor: 'brain' },
  'minimax': { emoji: '🔶', phosphor: 'diamond' },
  'zai': { emoji: '🇿', phosphor: 'sparkle' },
  'antigravity': { emoji: '🪐', phosphor: 'planet' },
  'ai-claude': { emoji: '🟣', phosphor: 'circle' },
  'ai-cost': { emoji: '💰', phosphor: 'currency-dollar' },
  'api-status': { emoji: '🔄', phosphor: 'arrows-clockwise' },
  'sessions': { emoji: '💬', phosphor: 'chat-dots' },
  'tokens': { emoji: '📊', phosphor: 'chart-bar' },
  
  // Finance
  'stock': { emoji: '📈', phosphor: 'chart-line-up' },
  'crypto': { emoji: '₿', phosphor: 'currency-btc' },
  
  // Productivity
  'email': { emoji: '📧', phosphor: 'envelope' },
  'github': { emoji: '🐙', phosphor: 'git-branch' },
  
  // Smart Home
  'home': { emoji: '🏠', phosphor: 'house' },
  'camera': { emoji: '📷', phosphor: 'camera' },
  'power': { emoji: '🔌', phosphor: 'plug' },
  
  // Media
  'music': { emoji: '🎵', phosphor: 'music-notes' },
  'quote': { emoji: '💭', phosphor: 'quotes' },
  
  // Images
  'image': { emoji: '🖼️', phosphor: 'image' },
  'image-random': { emoji: '🎲', phosphor: 'shuffle' },
  'image-new': { emoji: '🆕', phosphor: 'sparkle' },
  
  // Links / Embeds
  'links': { emoji: '🔗', phosphor: 'link' },
  'embed': { emoji: '🌐', phosphor: 'browser' },
  'rss': { emoji: '📡', phosphor: 'rss' },
  
  // Layout
  'header': { emoji: '🔤', phosphor: 'text-aa' },
  'line-h': { emoji: '➖', phosphor: 'minus' },
  'line-v': { emoji: '│', phosphor: 'line-vertical' },
};

/**
 * Renders a themeable icon span
 * @param {string} iconId - Key from WIDGET_ICONS
 * @returns {string} HTML span element with data-icon attribute
 */
function renderIcon(iconId) {
  const icon = WIDGET_ICONS[iconId];
  const emoji = icon ? icon.emoji : '●';
  return `<span class="lb-icon" data-icon="${iconId}">${emoji}</span> `;
}

// Expose for external use
window.renderIcon = renderIcon;
window.WIDGET_ICONS = WIDGET_ICONS;

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

window.onStats = onStats;

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
window.onSystemStats = onSystemStats;
window._formatBytes = _formatBytes;
window._formatBytesPerSec = _formatBytesPerSec;
window._formatUptime = _formatUptime;

const WIDGETS = {
  // ─────────────────────────────────────────────
  // SMALL CARDS (KPI style)
  // ─────────────────────────────────────────────
  
  'weather': {
    name: 'Local Weather',
    icon: '🌡️',
    category: 'small',
    description: 'Shows current weather for a single location using Open-Meteo (no API key needed).',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Local Weather',
      location: 'Atlanta',
      units: 'F',
      refreshInterval: 600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:24px;">72°F</div>
      <div style="font-size:11px;color:#8b949e;">Atlanta</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('weather')} ${props.title || 'Local Weather'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span id="${props.id}-icon" class="lb-icon lb-icon-lg" data-icon="weather">🌡️</span>
          <div>
            <div class="kpi-value blue" id="${props.id}-value">Loading...</div>
            <div class="kpi-label" id="${props.id}-label">${props.location || 'Location'}</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Weather Widget: ${props.id} (uses free Open-Meteo API - no key needed)
      const WMO_DESC = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',73:'Moderate snow',75:'Heavy snow',80:'Slight showers',81:'Moderate showers',82:'Violent showers',95:'Thunderstorm',96:'Hail thunderstorm',99:'Heavy hail'};
      function wmoIcon(code) {
        if (code <= 1) return 'weather-sunny';
        if (code <= 3) return 'weather-cloudy';
        if (code >= 51 && code <= 82) return 'weather-rainy';
        if (code >= 71 && code <= 77) return 'weather-snowy';
        if (code >= 95) return 'weather-rainy';
        return 'weather';
      }
      async function update_${props.id.replace(/-/g, '_')}() {
        const valEl = document.getElementById('${props.id}-value');
        const labelEl = document.getElementById('${props.id}-label');
        const iconEl = document.getElementById('${props.id}-icon');
        try {
          const loc = '${props.location || 'Atlanta'}';
          const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(loc) + '&count=1');
          const geoData = await geoRes.json();
          if (!geoData.results || !geoData.results.length) throw new Error('City not found');
          const {latitude, longitude} = geoData.results[0];
          const tempUnit = '${props.units}' === 'C' ? 'celsius' : 'fahrenheit';
          const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=' + tempUnit);
          const data = await res.json();
          const c = data.current;
          const unit = '${props.units}' === 'C' ? '°C' : '°F';
          valEl.textContent = Math.round(c.temperature_2m) + unit;
          labelEl.textContent = WMO_DESC[c.weathercode] || 'Unknown';
          const iconId = wmoIcon(c.weathercode);
          iconEl.setAttribute('data-icon', iconId);
          const icons = window.WIDGET_ICONS || {};
          iconEl.textContent = icons[iconId] ? icons[iconId].emoji : '🌡️';
        } catch (e) {
          console.error('Weather widget error:', e);
          if (!valEl.dataset.loaded) valEl.textContent = 'Unavailable';
        }
        valEl.dataset.loaded = '1';
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  },

  'weather-multi': {
    name: 'World Weather',
    icon: '🌍',
    category: 'large',
    description: 'Shows weather for multiple locations side-by-side. Separate cities with semicolons.',
    defaultWidth: 350,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'World Weather',
      locations: 'New York; London; Tokyo',
      units: 'F',
      refreshInterval: 600
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🌡️ New York: 72°F</div>
      <div>🌡️ London: 58°F</div>
      <div>🌡️ Tokyo: 68°F</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('world-weather')} ${props.title || 'World Weather'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list">
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-sunny">☀️</span><span class="weather-loc">New York</span><span class="weather-temp">72°F</span></div>
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-cloudy">⛅</span><span class="weather-loc">London</span><span class="weather-temp">58°F</span></div>
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-rainy">🌧️</span><span class="weather-loc">Tokyo</span><span class="weather-temp">65°F</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Multi Weather Widget: ${props.id} (uses free Open-Meteo API - no key needed)
      const WMO_DESC2 = {0:'Clear',1:'Clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Drizzle',53:'Drizzle',55:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Showers',82:'Showers',95:'Storm',96:'Hail',99:'Hail'};
      function wmoIcon2(code) {
        if (code <= 1) return 'weather-sunny';
        if (code <= 3) return 'weather-cloudy';
        if (code >= 51 && code <= 82) return 'weather-rainy';
        if (code >= 71 && code <= 77) return 'weather-snowy';
        if (code >= 95) return 'weather-rainy';
        return 'weather';
      }
      async function update_${props.id.replace(/-/g, '_')}() {
        const locations = '${props.locations || 'New York; London; Tokyo'}'.split(';').map(l => l.trim());
        const container = document.getElementById('${props.id}-list');
        const tempUnit = '${props.units}' === 'C' ? 'celsius' : 'fahrenheit';
        const unitSymbol = '${props.units}' === 'C' ? '°C' : '°F';
        
        const results = await Promise.all(locations.map(async (loc) => {
          try {
            const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(loc) + '&count=1');
            const geoData = await geoRes.json();
            if (!geoData.results || !geoData.results.length) return { loc, temp: 'N/A', iconId: 'weather', emoji: '❓' };
            const {latitude, longitude} = geoData.results[0];
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,weathercode&temperature_unit=' + tempUnit);
            const data = await res.json();
            const c = data.current;
            const iconId = wmoIcon2(c.weathercode);
            const icons = window.WIDGET_ICONS || {};
            const emoji = icons[iconId] ? icons[iconId].emoji : '🌡️';
            return { loc, temp: Math.round(c.temperature_2m), iconId, emoji };
          } catch (e) {
            return { loc, temp: 'N/A', iconId: 'weather', emoji: '❓' };
          }
        }));
        
        container.innerHTML = results.map(r =>
          '<div class="weather-row"><span class="weather-icon lb-icon" data-icon="' + _esc(r.iconId) + '">' + _esc(r.emoji) + '</span><span class="weather-loc">' + _esc(r.loc) + '</span><span class="weather-temp">' + _esc(String(r.temp)) + _esc(unitSymbol) + '</span></div>'
        ).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  },

  'auth-status': {
    name: 'Auth Status',
    icon: '🔐',
    category: 'small',
    description: 'Shows if OpenClaw is using Anthropic Max subscription (green) or API key fallback (yellow).',
    defaultWidth: 180,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Auth Type',
      server: 'local',
      endpoint: '/api/status',
      refreshInterval: 30
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="width:10px;height:10px;background:#3fb950;border-radius:50%;margin:0 auto 4px;"></div>
      <div style="font-size:13px;">OAuth</div>
      <div style="font-size:11px;color:#8b949e;">Auth</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('auth')} ${props.title || 'Auth Type'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-indicator" id="${props.id}-dot"></div>
          <div class="kpi-value" id="${props.id}-value">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Auth Status Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        const dot = document.getElementById('${props.id}-dot');
        const val = document.getElementById('${props.id}-value');
        try {
          let authData;
          if (serverId === 'local') {
            const res = await fetch('/api/auth');
            authData = await res.json();
          } else {
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (!data.openclaw?.auth) throw new Error('Auth data not available');
            authData = { status: 'ok', mode: data.openclaw.auth.mode };
          }
          if (authData.status === 'ok' || authData.mode) {
            const isMonthly = authData.mode === 'Monthly';
            val.textContent = isMonthly ? 'Max' : 'API';
            dot.className = 'kpi-indicator ' + (isMonthly ? 'green' : 'yellow');
          } else {
            val.textContent = '—';
          }
        } catch (e) {
          console.error('Auth status widget error:', e);
          val.textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
    `
  },

  'sleep-ring': {
    name: 'Sleep Score',
    icon: '😴',
    category: 'small',
    description: 'Displays sleep data from a configured health API endpoint.',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'GARMIN_TOKEN',
    properties: {
      title: 'Sleep Score',
      refreshInterval: 300
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;color:#3fb950;">85</div>
      <div style="font-size:11px;color:#8b949e;">Sleep Score</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('sleep')} ${props.title || 'Sleep Score'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-ring-wrap kpi-ring-sm">
            <svg class="kpi-ring" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>
              <circle id="${props.id}-ring" cx="24" cy="24" r="20" fill="none" stroke="var(--accent-green)" stroke-width="4"
                stroke-dasharray="125.66" stroke-dashoffset="125.66" stroke-linecap="round"
                transform="rotate(-90 24 24)" style="transition: stroke-dashoffset 0.6s ease;"/>
            </svg>
            <div class="kpi-ring-label" id="${props.id}-value">—</div>
          </div>
          <div class="kpi-data">
            <div class="kpi-label">Sleep</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Sleep Ring Widget: ${props.id}
      function setSleepScore_${props.id.replace(/-/g, '_')}(score) {
        const ring = document.getElementById('${props.id}-ring');
        const label = document.getElementById('${props.id}-value');
        const circumference = 125.66;
        const offset = circumference - (score / 100) * circumference;
        ring.style.strokeDashoffset = offset;
        label.textContent = score;
      }
      // Replace with your data source
      setSleepScore_${props.id.replace(/-/g, '_')}(85);
    `
  },

  'lobsterboard-release': {
    name: 'LobsterBoard Release',
    icon: '🦞',
    category: 'small',
    description: 'Auto-detects running LobsterBoard version and compares to latest GitHub release.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'LobsterBoard',
      refreshInterval: 3600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:13px;">v0.1.5</div>
      <div style="font-size:11px;color:#3fb950;">✓ Up to date</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('lobster')} ${props.title || 'LobsterBoard'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;gap:10px;padding:8px 12px;">
          <span class="lb-icon lb-icon-lg" data-icon="lobster">🦞</span>
          <div>
            <div id="${props.id}-versions" style="display:flex;align-items:center;gap:6px;font-size:calc(13px * var(--font-scale, 1));color:#c9d1d9;">
              <span id="${props.id}-current">—</span>
              <span id="${props.id}-arrow" style="color:#6e7681;display:none;">→</span>
              <span id="${props.id}-latest" style="display:none;"></span>
            </div>
            <div id="${props.id}-status" style="font-size:calc(11px * var(--font-scale, 1));margin-top:2px;">Checking...</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const currentEl = document.getElementById('${props.id}-current');
        const arrowEl = document.getElementById('${props.id}-arrow');
        const latestEl = document.getElementById('${props.id}-latest');
        const statusEl = document.getElementById('${props.id}-status');
        
        try {
          const res = await fetch('/api/lb-release');
          const data = await res.json();
          if (data.status !== 'ok') throw new Error(data.message);
          
          const cur = (data.current || '').replace(/^v/, '');
          const lat = (data.latest || '').replace(/^v/, '');
          // Strip -N suffixes for comparison (e.g. 2026.2.22-2 matches 2026.2.22)
          const curBase = cur.replace(/-\d+$/, '');
          const latBase = lat.replace(/-\d+$/, '');
          const isUpToDate = cur === lat || curBase === latBase || cur.startsWith(latBase + '-');
          
          if (!cur || cur === 'unknown') {
            currentEl.textContent = 'v' + lat;
            statusEl.textContent = 'Latest release';
            statusEl.style.color = '#8b949e';
          } else if (isUpToDate) {
            currentEl.textContent = 'v' + cur;
            currentEl.style.color = '#3fb950';
            statusEl.innerHTML = '✓ Up to date';
            statusEl.style.color = '#3fb950';
          } else {
            currentEl.textContent = cur;
            currentEl.style.color = '#c9d1d9';
            arrowEl.style.display = 'inline';
            latestEl.style.display = 'inline';
            latestEl.textContent = 'v' + lat;
            latestEl.style.color = '#58a6ff';
            statusEl.innerHTML = '<span style="color:#d29922;">Update available</span>';
          }
        } catch (e) {
          currentEl.textContent = '—';
          statusEl.textContent = 'Error';
          console.error('LobsterBoard Release widget error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  },

  'openclaw-release': {
    name: 'OpenClaw Release',
    icon: '🦞',
    category: 'small',
    description: 'Auto-detects running OpenClaw version and compares to latest GitHub release.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'OpenClaw',
      server: 'local',
      openclawUrl: '',
      refreshInterval: 3600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:13px;">v2026.2.3</div>
      <div style="font-size:11px;color:#3fb950;">✓ Up to date</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('release')} ${props.title || 'OpenClaw'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;gap:10px;padding:8px 12px;">
          <span class="lb-icon lb-icon-lg" data-icon="release">📦</span>
          <div>
            <div id="${props.id}-versions" style="display:flex;align-items:center;gap:6px;font-size:calc(13px * var(--font-scale, 1));color:#c9d1d9;">
              <span id="${props.id}-current">—</span>
              <span id="${props.id}-arrow" style="color:#6e7681;display:none;">→</span>
              <span id="${props.id}-latest" style="display:none;"></span>
            </div>
            <div id="${props.id}-status" style="font-size:calc(11px * var(--font-scale, 1));margin-top:2px;">Checking...</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        const currentEl = document.getElementById('${props.id}-current');
        const arrowEl = document.getElementById('${props.id}-arrow');
        const latestEl = document.getElementById('${props.id}-latest');
        const statusEl = document.getElementById('${props.id}-status');
        
        try {
          let cur, lat;
          
          if (serverId === 'local') {
            // Local: fetch from /api/releases
            const res = await fetch('/api/releases');
            const data = await res.json();
            if (data.status !== 'ok') throw new Error(data.message);
            cur = (data.current || '').replace(/^v/, '');
            lat = (data.latest || '').replace(/^v/, '');
          } else {
            // Remote: fetch from server stats and get openclaw.version
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (!data.openclaw) throw new Error('OpenClaw not installed on remote');
            cur = (data.openclaw.version || '').replace(/^v/, '');
            // Fetch latest from GitHub
            const ghRes = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest');
            const ghData = await ghRes.json();
            lat = (ghData.tag_name || '').replace(/^v/, '');
          }
          
          // Strip -N suffixes for comparison (e.g. 2026.2.22-2 matches 2026.2.22)
          const curBase = cur.replace(/-\\d+$/, '');
          const latBase = lat.replace(/-\\d+$/, '');
          const isUpToDate = cur === lat || curBase === latBase || cur.startsWith(latBase + '-');
          
          if (!cur || cur === 'unknown') {
            currentEl.textContent = 'v' + lat;
            statusEl.textContent = 'Latest release';
            statusEl.style.color = '#8b949e';
          } else if (isUpToDate) {
            currentEl.textContent = 'v' + cur;
            currentEl.style.color = '#3fb950';
            statusEl.innerHTML = '✓ Up to date';
            statusEl.style.color = '#3fb950';
          } else {
            currentEl.textContent = cur;
            currentEl.style.color = '#c9d1d9';
            arrowEl.style.display = 'inline';
            latestEl.style.display = 'inline';
            latestEl.textContent = 'v' + lat;
            latestEl.style.color = '#58a6ff';
            statusEl.innerHTML = '<span style="color:#d29922;">Update available</span>';
          }
        } catch (e) {
          currentEl.textContent = '—';
          statusEl.textContent = e.message || 'Error';
          console.error('OpenClaw Release widget error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  },

  'release': {
    name: 'Release',
    icon: '📦',
    category: 'small',
    description: 'Compares your current version of any software to its latest GitHub release.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Release',
      repo: 'openclaw/openclaw',
      currentVersion: '',
      refreshInterval: 3600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:13px;">v1.2.3</div>
      <div style="font-size:11px;color:#8b949e;">Up to date</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('release')} ${props.title || 'Release'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;gap:10px;padding:8px 12px;">
          <span class="lb-icon lb-icon-lg" data-icon="release">📦</span>
          <div>
            <div id="${props.id}-versions" style="display:flex;align-items:center;gap:6px;font-size:calc(13px * var(--font-scale, 1));color:#c9d1d9;">
              <span id="${props.id}-current">—</span>
              <span id="${props.id}-arrow" style="color:#6e7681;display:none;">→</span>
              <span id="${props.id}-latest" style="display:none;"></span>
            </div>
            <div id="${props.id}-status" style="font-size:calc(11px * var(--font-scale, 1));margin-top:2px;">Checking...</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Release Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const currentVersion = '${props.currentVersion || ''}'.replace(/^v/, '');
        const currentEl = document.getElementById('${props.id}-current');
        const arrowEl = document.getElementById('${props.id}-arrow');
        const latestEl = document.getElementById('${props.id}-latest');
        const statusEl = document.getElementById('${props.id}-status');
        
        try {
          const res = await fetch('https://api.github.com/repos/${props.repo || 'openclaw/openclaw'}/releases/latest');
          const data = await res.json();
          const lat = (data.tag_name || '').replace(/^v/, '');
          
          if (!currentVersion) {
            currentEl.textContent = 'v' + lat;
            statusEl.textContent = 'Latest release';
            statusEl.style.color = '#8b949e';
          } else if (currentVersion === lat) {
            currentEl.textContent = 'v' + currentVersion;
            currentEl.style.color = '#3fb950';
            statusEl.innerHTML = '✓ Up to date';
            statusEl.style.color = '#3fb950';
          } else {
            currentEl.textContent = currentVersion;
            currentEl.style.color = '#c9d1d9';
            arrowEl.style.display = 'inline';
            latestEl.style.display = 'inline';
            latestEl.textContent = 'v' + lat;
            latestEl.style.color = '#58a6ff';
            statusEl.innerHTML = '<span style="color:#d29922;">Update available</span>';
          }
        } catch (e) {
          console.error('Release widget error:', e);
          currentEl.textContent = '—';
          statusEl.textContent = 'Error';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  },

  'clock': {
    name: 'Clock',
    icon: '🕐',
    category: 'small',
    description: 'Simple digital clock. Supports 12h or 24h format.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Clock',
      timezone: 'local',
      format24h: false
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:24px;">3:45 PM</div>
      <div style="font-size:11px;color:#8b949e;">Wed, Feb 5</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('clock')} ${props.title || 'Clock'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-time">—</div>
          <div class="kpi-label" id="${props.id}-date">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Clock Widget: ${props.id}
      function updateClock_${props.id.replace(/-/g, '_')}() {
        const now = new Date();
        const timeEl = document.getElementById('${props.id}-time');
        const dateEl = document.getElementById('${props.id}-date');
        const opts = { hour: 'numeric', minute: '2-digit', hour12: ${!props.format24h} };
        timeEl.textContent = now.toLocaleTimeString('en-US', opts);
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
      updateClock_${props.id.replace(/-/g, '_')}();
      setInterval(updateClock_${props.id.replace(/-/g, '_')}, 1000);
    `
  },

  // ─────────────────────────────────────────────
  // LARGE CARDS (Content)
  // ─────────────────────────────────────────────

  'activity-list': {

    name: 'Activity List',
    icon: '📋',
    category: 'large',
    description: 'Shows recent OpenClaw activity from /api/activity endpoint.',
    defaultWidth: 400,
    defaultHeight: 300,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Today',
      server: 'local',
      endpoint: '/api/today',
      maxItems: 10,
      refreshInterval: 60
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>• Meeting at 2pm</div>
      <div>• Review PR #42</div>
      <div>• Deploy v1.2</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('activity')} ${props.title || 'Today'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list" id="${props.id}-list">
          <div class="list-item">• Team standup at 10am</div>
          <div class="list-item">• Review PR #42</div>
          <div class="list-item">• Deploy v1.2.3</div>
          <div class="list-item">• Update documentation</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Activity List Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        const list = document.getElementById('${props.id}-list');
        const badge = document.getElementById('${props.id}-badge');
        try {
          let data;
          if (serverId === 'local') {
            const res = await fetch('${props.endpoint || '/api/today'}');
            data = await res.json();
          } else {
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const stats = await res.json();
            if (stats.error) throw new Error(stats.error);
            data = stats.openclaw?.today || { date: new Date().toISOString().split('T')[0], activities: [] };
          }

          if (data.date && badge) {
            const d = new Date(data.date + 'T12:00:00');
            badge.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          }

          const activities = data.activities || [];
          if (!activities.length) {
            list.innerHTML = '<div style="padding:8px;color:#8b949e;font-size:calc(12px * var(--font-scale,1));">No activity yet today</div>';
            return;
          }

          const fs = 'calc(12px * var(--font-scale, 1))';
          list.innerHTML = activities.slice(0, ${props.maxItems || 10}).map(a => {
            const icon = a.status === 'ok' ? '✓' : a.status === 'error' ? '❌' : '';
            const text = _esc(a.text || '');
            const source = _esc(a.source || '');
            return '<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:4px 0;border-bottom:1px solid #30363d;font-size:' + fs + ';">' +
              '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(a.icon || '') + ' ' + text + '</div>' +
              '<div style="flex-shrink:0;font-size:0.85em;color:#8b949e;margin-left:8px;">' + _esc(icon) + ' ' + source + '</div>' +
            '</div>';
          }).join('');
        } catch (e) { 
          console.error('Today widget error:', e);
          list.innerHTML = '<div style="padding:8px;color:#f85149;font-size:calc(12px * var(--font-scale,1));">Error: ' + _esc(e.message) + '</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'ai-usage': {

    name: 'AI Usage',
    icon: '🤖',
    category: 'large',
    description: 'Track usage across AI coding tools. Some providers may show errors on first load — see individual provider widgets for setup instructions.',
    defaultWidth: 350,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'AI Usage',
      server: 'local',
      providers: 'all',
      hideUnauthenticated: true,
      showPlan: true,
      compactMode: false,
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>🟣 Claude — 25% session</div>
      <div>🟢 Codex — 12% weekly</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('tokens')} ${props.title || 'AI Usage'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;">
          <div style="color:var(--text-muted);font-size:11px;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // AI Usage Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const serverId = '${props.server || 'local'}';
          const providers = '${props.providers || 'all'}';
          let json;
          
          if (serverId === 'local') {
            // Local: fetch from /api/ai-usage
            const url = providers === 'all' ? '/api/ai-usage' : '/api/ai-usage/' + providers;
            const res = await fetch(url);
            json = await res.json();
          } else {
            // Remote: fetch from server stats endpoint
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) {
              json = { status: 'error', message: data.error };
            } else if (data.aiUsage && data.aiUsage.providers) {
              json = { status: 'ok', providers: data.aiUsage.providers };
            } else if (data.aiUsage === undefined) {
              json = { status: 'error', message: 'AI usage not enabled on remote agent (enableAiUsage: false)' };
            } else {
              json = { status: 'error', message: 'No AI providers found on remote server' };
            }
          }
          
          if (json.status !== 'ok') {
            content.innerHTML = '<div style="color:#f85149;font-size:12px;">' + _esc(json.message || 'Error') + '</div>';
            badge.textContent = '!';
            return;
          }
          
          let allProviders = json.providers || [json];
          const hideUnauth = ${props.hideUnauthenticated !== false};
          const providerFilter = '${props.providers || 'all'}'.split(',').map(s => s.trim()).filter(Boolean);
          
          // Filter by selected providers
          if (providerFilter.length && providerFilter[0] !== 'all') {
            allProviders = allProviders.filter(p => providerFilter.includes(p.provider));
          }
          
          // Hide unauthenticated/errored providers if option is set
          if (hideUnauth) {
            allProviders = allProviders.filter(p => !p.error);
          }
          
          const validProviders = allProviders.filter(p => !p.error);
          
          badge.textContent = validProviders.length + (allProviders.length > validProviders.length ? '/' + allProviders.length : '');
          
          let html = '';
          const compact = ${props.compactMode || false};
          const showPlan = ${props.showPlan !== false};
          
          // Map provider IDs to icon IDs for theming
          const providerIconMap = {
            claude: 'claude-code', codex: 'codex-cli', copilot: 'github-copilot',
            cursor: 'cursor', gemini: 'gemini-cli', amp: 'amp-code', factory: 'factory',
            kimi: 'kimi-code', jetbrains: 'jetbrains-ai', minimax: 'minimax', zai: 'zai',
            antigravity: 'antigravity'
          };
          
          for (const prov of allProviders) {
            const iconId = providerIconMap[prov.provider] || 'ai-usage';
            const iconEmoji = _esc(prov.icon || '⚪');
            const name = _esc(prov.name || prov.provider || 'Unknown');
            
            if (prov.error) {
              html += '<div style="padding:6px 0;border-bottom:1px solid var(--border,#30363d);">';
              html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
              html += '<span class="lb-icon" data-icon="' + iconId + '" style="font-size:16px;">' + iconEmoji + '</span>';
              html += '<span style="font-weight:500;font-size:13px;">' + name + '</span>';
              html += '</div>';
              html += '<div style="color:#f85149;font-size:11px;padding-left:22px;">' + _esc(prov.error) + '</div>';
              html += '</div>';
              continue;
            }
            
            html += '<div style="padding:6px 0;border-bottom:1px solid var(--border,#30363d);">';
            html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:' + (compact ? '2px' : '6px') + ';">';
            html += '<span class="lb-icon" data-icon="' + iconId + '" style="font-size:16px;">' + iconEmoji + '</span>';
            html += '<span style="font-weight:500;font-size:13px;">' + name + '</span>';
            if (showPlan && prov.plan) {
              html += '<span style="font-size:10px;color:var(--text-muted);background:var(--bg-secondary);padding:1px 6px;border-radius:4px;margin-left:auto;">' + _esc(prov.plan) + '</span>';
            }
            html += '</div>';
            
            if (prov.metrics && prov.metrics.length) {
              for (const m of prov.metrics) {
                const label = _esc(m.label);
                const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
                const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
                
                if (m.format === 'dollars') {
                  const val = m.remaining != null ? '$' + m.remaining.toFixed(2) : (m.used != null ? '$' + m.used.toFixed(2) + ' used' : '—');
                  html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0 2px 22px;">';
                  html += '<span style="color:var(--text-secondary);">' + label + '</span>';
                  html += '<span style="color:' + (m.remaining != null ? '#3fb950' : 'var(--text-primary)') + ';">' + _esc(val) + '</span>';
                  html += '</div>';
                } else {
                  // Percentage progress bar
                  html += '<div style="padding:2px 0 2px 22px;">';
                  if (!compact) {
                    html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">';
                    html += '<span style="color:var(--text-secondary);">' + label + '</span>';
                    html += '<span style="color:' + color + ';">' + pct.toFixed(0) + '%</span>';
                    html += '</div>';
                  }
                  html += '<div style="height:' + (compact ? '4px' : '6px') + ';background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;">';
                  html += '<div style="width:' + pct + '%;height:100%;background:' + color + ';transition:width 0.3s;"></div>';
                  html += '</div>';
                  if (compact) {
                    html += '<div style="font-size:9px;color:var(--text-muted);margin-top:1px;">' + label + ' ' + pct.toFixed(0) + '%</div>';
                  }
                  html += '</div>';
                }
              }
            }
            html += '</div>';
          }
          
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No providers configured</div>';
        } catch (e) {
          console.error('AI Usage widget error:', e);
          content.innerHTML = '<div style="color:#f85149;font-size:12px;">Error loading usage data</div>';
          badge.textContent = '!';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'claude-code': {

    name: 'Claude Code',
    icon: '🟣',
    category: 'small',
    description: 'Track Claude Code usage (session, weekly, Opus limits). Setup: run `claude` once to authenticate. May show 429 on first load — cached after success.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: {
      title: 'Claude',
      showPlan: true,
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>Session: 25%</div>
      <div>Weekly: 12%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🟣 ${props.title || 'Claude'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;">
          <div style="color:var(--text-muted);font-size:11px;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/claude');
          const data = await res.json();
          if (data.error) {
            content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>';
            badge.textContent = '!';
            return;
          }
          let html = '';
          const showPlan = ${props.showPlan !== false};
          if (showPlan && data.plan) {
            badge.textContent = _esc(data.plan);
          }
          for (const m of (data.metrics || [])) {
            const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
            const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
            if (m.format === 'dollars') {
              const val = m.used != null ? '$' + m.used.toFixed(2) : '—';
              html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">';
              html += '<span>' + _esc(m.label) + '</span><span style="color:#3fb950;">' + _esc(val) + '</span></div>';
            } else {
              html += '<div style="margin-bottom:4px;">';
              html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">';
              html += '<span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div>';
              html += '<div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;">';
              html += '<div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
            }
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) {
          content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>';
          badge.textContent = '!';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'codex-cli': {

    name: 'Codex CLI',
    icon: '🟢',
    category: 'small',
    description: 'Track Codex CLI usage (session, weekly, code reviews). Setup: run `codex` once to authenticate.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: {
      title: 'Codex',
      showPlan: true,
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>Session: 5%</div>
      <div>Weekly: 10%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🟢 ${props.title || 'Codex'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;">
          <div style="color:var(--text-muted);font-size:11px;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/codex');
          const data = await res.json();
          if (data.error) {
            content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>';
            badge.textContent = '!';
            return;
          }
          let html = '';
          const showPlan = ${props.showPlan !== false};
          if (showPlan && data.plan) {
            badge.textContent = _esc(data.plan);
          }
          for (const m of (data.metrics || [])) {
            const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
            const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
            if (m.format === 'dollars') {
              const val = m.remaining != null ? '$' + m.remaining.toFixed(2) : '—';
              html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">';
              html += '<span>' + _esc(m.label) + '</span><span style="color:#3fb950;">' + _esc(val) + '</span></div>';
            } else {
              html += '<div style="margin-bottom:4px;">';
              html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">';
              html += '<span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div>';
              html += '<div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;">';
              html += '<div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
            }
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) {
          content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>';
          badge.textContent = '!';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'github-copilot': {
    name: 'GitHub Copilot',
    icon: '⚫',
    category: 'small',
    description: 'Track GitHub Copilot usage. Setup: run `gh auth login` first.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: { title: 'Copilot', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Premium: 20%</div><div>Chat: 5%</div></div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head"><span class="dash-card-title">⚫ ${props.title || 'Copilot'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/copilot');
          const data = await res.json();
          if (data.error) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>'; badge.textContent = '!'; return; }
          let html = '';
          if (${props.showPlan !== false} && data.plan) badge.textContent = _esc(data.plan);
          for (const m of (data.metrics || [])) {
            const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
            const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
            html += '<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>'; badge.textContent = '!'; }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'cursor': {
    name: 'Cursor',
    icon: '🔵',
    category: 'small',
    description: 'Track Cursor IDE usage. Setup: just use Cursor normally — reads from IDE database.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: { title: 'Cursor', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Total: 15%</div><div>API: 46%</div></div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head"><span class="dash-card-title">🔵 ${props.title || 'Cursor'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/cursor');
          const data = await res.json();
          if (data.error) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>'; badge.textContent = '!'; return; }
          let html = '';
          if (${props.showPlan !== false} && data.plan) badge.textContent = _esc(data.plan);
          for (const m of (data.metrics || [])) {
            const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
            const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
            html += '<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>'; badge.textContent = '!'; }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'gemini-cli': {
    name: 'Gemini CLI',
    icon: '🔷',
    category: 'small',
    description: 'Track Gemini CLI usage. Setup: run `gemini` once to authenticate via browser.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: { title: 'Gemini', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Pro: 10%</div><div>Flash: 5%</div></div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head"><span class="dash-card-title">🔷 ${props.title || 'Gemini'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/gemini');
          const data = await res.json();
          if (data.error) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>'; badge.textContent = '!'; return; }
          let html = '';
          if (${props.showPlan !== false} && data.plan) badge.textContent = _esc(data.plan);
          for (const m of (data.metrics || [])) {
            const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
            const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
            html += '<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>'; badge.textContent = '!'; }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'amp-code': {
    name: 'Amp Code',
    icon: '⚡',
    category: 'small',
    description: 'Track Amp Code usage. Setup: run `amp` once to authenticate.',
    defaultWidth: 280,
    defaultHeight: 180,
    hasApiKey: false,
    properties: { title: 'Amp', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Free: 30%</div><div>Credits: $5.00</div></div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head"><span class="dash-card-title">⚡ ${props.title || 'Amp'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div>
        <div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const content = document.getElementById('${props.id}-content');
        const badge = document.getElementById('${props.id}-badge');
        try {
          const res = await fetch('/api/ai-usage/amp');
          const data = await res.json();
          if (data.error) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">' + _esc(data.error) + '</div>'; badge.textContent = '!'; return; }
          let html = '';
          if (${props.showPlan !== false} && data.plan) badge.textContent = _esc(data.plan);
          for (const m of (data.metrics || [])) {
            if (m.format === 'dollars') {
              const val = m.remaining != null ? '$' + m.remaining.toFixed(2) : '—';
              html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span>' + _esc(m.label) + '</span><span style="color:#3fb950;">' + _esc(val) + '</span></div>';
            } else {
              const pct = m.used != null ? Math.min(100, Math.max(0, m.used)) : 0;
              const color = pct > 80 ? '#f85149' : pct > 50 ? '#d29922' : '#3fb950';
              html += '<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>' + _esc(m.label) + '</span><span style="color:' + color + ';">' + pct.toFixed(0) + '%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + color + ';"></div></div></div>';
            }
          }
          content.innerHTML = html || '<div style="color:var(--text-muted);font-size:11px;">No data</div>';
        } catch (e) { content.innerHTML = '<div style="color:#f85149;font-size:11px;">Error</div>'; badge.textContent = '!'; }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'factory': {
    name: 'Factory',
    icon: '🏭',
    category: 'small',
    description: 'Track Factory (Droid) usage. Setup: run `factory` once to authenticate.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Factory', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Standard: 25%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🏭 ${props.title || 'Factory'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/factory');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'kimi-code': {
    name: 'Kimi Code',
    icon: '🌙',
    category: 'small',
    description: 'Track Kimi Code usage. Setup: run `kimi` once to authenticate.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Kimi', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 26%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🌙 ${props.title || 'Kimi'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/kimi');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'jetbrains-ai': {
    name: 'JetBrains AI',
    icon: '🧠',
    category: 'small',
    description: 'Track JetBrains AI Assistant usage. Setup: sign into AI Assistant in any JetBrains IDE.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'JetBrains', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Quota: 15%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🧠 ${props.title || 'JetBrains'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/jetbrains');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'minimax': {
    name: 'MiniMax',
    icon: '🔶',
    category: 'small',
    description: 'Track MiniMax Coding usage. Requires MINIMAX_API_KEY env var.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'MiniMax', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 30%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🔶 ${props.title || 'MiniMax'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/minimax');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'zai': {
    name: 'Z.ai',
    icon: '🇿',
    category: 'small',
    description: 'Track Z.ai (GLM Coding) usage. Requires ZAI_API_KEY env var.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Z.ai', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 15%</div><div>Weekly: 45%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🇿 ${props.title || 'Z.ai'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/zai');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'antigravity-local': {
    name: 'Antigravity',
    icon: '🪐',
    category: 'small',
    description: 'Track Google Antigravity usage (Gemini 3, Claude via Google). Requires antigravity-usage login.',
    defaultWidth: 280, defaultHeight: 200, hasApiKey: false,
    properties: { title: 'Antigravity', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Gemini 3 Pro: 25%</div><div>Claude Sonnet: 40%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🪐 ${props.title || 'Antigravity'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/antigravity');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  },

  'cron-jobs': {

    name: 'Cron Jobs',
    icon: '⏰',
    category: 'large',
    description: 'Lists scheduled cron jobs from OpenClaw /api/cron endpoint.',
    defaultWidth: 400,
    defaultHeight: 250,
    hasApiKey: false,
    properties: {
      title: 'Cron',
      server: 'local',
      endpoint: '/api/cron',
      columns: 1,
      refreshInterval: 30
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>⏰ Daily backup - 2am</div>
      <div>⏰ Sync data - */5 *</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('cron')} ${props.title || 'Cron'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list" style="display:grid;grid-template-columns:repeat(${props.columns || 1}, 1fr);gap:0 12px;align-content:start;">
          <div class="cron-item"><span class="cron-name">Daily backup</span><span class="cron-next">2:00 AM</span></div>
          <div class="cron-item"><span class="cron-name">Sync data</span><span class="cron-next">*/5 min</span></div>
          <div class="cron-item"><span class="cron-name">Health check</span><span class="cron-next">*/15 min</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Cron Jobs Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        const list = document.getElementById('${props.id}-list');
        const badge = document.getElementById('${props.id}-badge');
        try {
          let jobs;
          if (serverId === 'local') {
            const res = await fetch('${props.endpoint || '/api/cron'}');
            const json = await res.json();
            jobs = json.jobs || [];
          } else {
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (!data.openclaw?.cron) throw new Error('Cron data not available');
            jobs = data.openclaw.cron.jobs || [];
          }
          if (!jobs.length) {
            list.innerHTML = '<div class="cron-item"><span class="cron-name" style="opacity:0.5;">No cron jobs found</span></div>';
            badge.textContent = '0';
            return;
          }
          const cols = ${props.columns || 1};
          list.style.display = 'grid';
          list.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
          list.style.gap = '0 12px';
          list.style.alignContent = 'start';
          list.innerHTML = jobs.map(job => {
            const statusDot = job.enabled ? '🟢' : '🔴';
            const lastRun = job.lastRun ? new Date(job.lastRun).toLocaleTimeString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
            const statusBadge = job.lastStatus ? (job.lastStatus === 'ok' ? '✓' : '✗') : '';
            return '<div class="cron-item" style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border,#30363d);font-size:calc(13px * var(--font-scale, 1));">' +
              '<span style="flex-shrink:0;">' + _esc(statusDot) + '</span>' +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:500;">' + _esc(job.name) + '</div>' +
              '</div>' +
              '<div style="text-align:right;font-size:0.8em;opacity:0.6;flex-shrink:0;">' +
                '<div>' + _esc(statusBadge) + ' ' + _esc(lastRun) + '</div>' +
              '</div>' +
            '</div>';
          }).join('');
          badge.textContent = jobs.length + ' jobs';
        } catch (e) {
          console.error('Cron jobs widget error:', e);
          list.innerHTML = '<div class="cron-item"><span class="cron-name">Error: ' + _esc(e.message) + '</span></div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
    `
  },

  'system-log': {

    name: 'System Log',
    icon: '🔧',
    category: 'large',
    description: 'Shows recent system logs from OpenClaw /api/system-log endpoint.',
    defaultWidth: 500,
    defaultHeight: 400,
    hasApiKey: false,
    properties: {
      title: 'System Log',
      server: 'local',
      endpoint: '/api/system-log',
      maxLines: 50,
      refreshInterval: 10
    },
    preview: `<div style="padding:4px;font-size:10px;font-family:monospace;color:#8b949e;">
      <div>[INFO] System started</div>
      <div>[DEBUG] Loading config</div>
      <div>[INFO] Ready</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('system-log')} ${props.title || 'System Log'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list syslog-scroll" id="${props.id}-log">
          <div class="syslog-entry info"><span class="syslog-icon">●</span><span class="syslog-time">9:00am</span><span class="syslog-msg">System started</span><span class="syslog-cat">gateway</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      function getLogIcon(level) {
        if (level === 'ERROR') return '❌';
        if (level === 'WARN') return '⚠️';
        if (level === 'OK') return '✅';
        return '●';
      }
      function getLogClass(level) {
        if (level === 'ERROR') return 'error';
        if (level === 'WARN') return 'warn';
        if (level === 'OK') return 'ok';
        return 'info';
      }
      // System Log Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        try {
          let entries = [];
          if (serverId === 'local') {
            const res = await fetch('${props.endpoint || '/api/system-log'}?max=${props.maxLines || 50}');
            const json = await res.json();
            entries = json.entries || [];
            if (!entries.length && json.lines && json.lines.length) {
              entries = json.lines.map(line => {
                let level = 'INFO';
                if (/\\b(error|fatal)\\b/i.test(line)) level = 'ERROR';
                else if (/\\bwarn/i.test(line)) level = 'WARN';
                else if (/\\b(ok|success|ready|started)\\b/i.test(line)) level = 'OK';
                return { time: new Date().toISOString(), level, category: 'system', message: line };
              });
            }
          } else {
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            entries = data.openclaw?.systemLog?.entries || [];
          }
          const log = document.getElementById('${props.id}-log');
          const badge = document.getElementById('${props.id}-badge');
          const wasAtBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
          const errorCount = entries.filter(e => e.level === 'ERROR').length;
          badge.textContent = errorCount > 0 ? errorCount + ' error' + (errorCount > 1 ? 's' : '') : entries.length + ' events';
          badge.style.color = errorCount > 0 ? '#f85149' : '';
          const fs = 'calc(11px * var(--font-scale, 1))';
          log.innerHTML = entries.slice(0, ${props.maxLines || 50}).map(entry => {
            const cls = getLogClass(entry.level);
            const icon = getLogIcon(entry.level);
            const time = entry.time ? new Date(entry.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase() : '';
            const msg = (entry.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const cat = (entry.category || '').replace(/</g, '&lt;');
            return '<div class="syslog-entry ' + cls + '" style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid #30363d;font-size:' + fs + ';line-height:1.3;" title="' + msg + '">' +
              '<span class="syslog-icon" style="flex-shrink:0;width:14px;text-align:center;font-size:calc(10px * var(--font-scale, 1));">' + icon + '</span>' +
              '<span class="syslog-time" style="flex-shrink:0;color:#8b949e;font-size:calc(10px * var(--font-scale, 1));font-family:monospace;min-width:55px;">' + time + '</span>' +
              '<span class="syslog-msg" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (cls === 'error' ? '#f85149' : cls === 'warn' ? '#d29922' : cls === 'ok' ? '#3fb950' : '#c9d1d9') + ';">' + msg + '</span>' +
              '<span class="syslog-cat" style="flex-shrink:0;font-size:calc(9px * var(--font-scale, 1));padding:1px 4px;border-radius:3px;background:#161b22;color:#8b949e;font-family:monospace;">' + cat + '</span>' +
            '</div>';
          }).join('');
          if (wasAtBottom) log.scrollTop = log.scrollHeight;
        } catch (e) {
          console.error('System log widget error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${Math.max((props.refreshInterval || 10), 30) * 1000});
    `
  },

  'calendar': {

    name: 'Calendar',
    icon: '📅',
    category: 'large',
    description: 'Displays upcoming events from an iCal (.ics) feed URL. Works with Google Calendar, Outlook, and Apple Calendar.',
    defaultWidth: 400,
    defaultHeight: 300,
    properties: {
      title: 'Calendar',
      icalUrl: '',
      maxEvents: 5,
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>📅 Team standup - 10am</div>
      <div>📅 1:1 with Bob - 2pm</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('calendar')} ${props.title || 'Calendar'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-events" style="overflow-y:auto;">
          <div style="color:#8b949e;font-size:calc(13px * var(--font-scale, 1));">Loading events…</div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-events');
        const icalUrl = ${JSON.stringify(props.icalUrl || '')};
        if (!icalUrl) {
          container.innerHTML = '<div style="color:#8b949e;font-size:calc(13px * var(--font-scale, 1));">Set an iCal feed URL in widget settings</div>';
          return;
        }
        try {
          const resp = await fetch('/api/calendar?url=' + encodeURIComponent(icalUrl) + '&max=${props.maxEvents || 5}');
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const events = await resp.json();
          if (!events.length) {
            container.innerHTML = '<div style="color:#8b949e;font-size:calc(13px * var(--font-scale, 1));">No upcoming events</div>';
            return;
          }
          function _escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
          function _linkify(s) { return _escHtml(s).replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#58a6ff;text-decoration:underline;">$1</a>'); }
          container.innerHTML = events.map(function(ev) {
            var timeStr = ev.allDay ? 'All Day' : new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return '<div style="padding:4px 0;border-bottom:1px solid #21262d;font-size:calc(13px * var(--font-scale, 1));">' +
              '<span style="color:#58a6ff;">' + timeStr + '</span> ' +
              '<span style="color:#e6edf3;">' + _linkify(ev.summary || 'Untitled') + '</span>' +
              (ev.location ? '<div style="color:#8b949e;font-size:calc(11px * var(--font-scale, 1));margin-top:2px;">📍 ' + _linkify(ev.location) + '</div>' : '') +
              '</div>';
          }).join('');
        } catch (e) {
          console.error('Calendar widget error:', e);
          container.innerHTML = '<div style="color:#f85149;font-size:calc(13px * var(--font-scale, 1));">Failed to load calendar</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${Math.max((props.refreshInterval || 300), 60) * 1000});
    `
  },

  'notes': {
    name: 'Notes',
    icon: '📝',
    category: 'large',
    description: 'Simple note-taking widget with persistent storage.',
    defaultWidth: 350,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: 'Notes'
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>📝 Remember to check logs</div>
      <div>📝 Update docs</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('notes')} ${props.title || 'Notes'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">0</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
          <div style="display:flex;gap:6px;padding:0 0 8px 0;flex-shrink:0;">
            <textarea id="${props.id}-input" placeholder="Add a note..." rows="2" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;color:var(--text-primary);font-size:calc(12px * var(--font-scale, 1));resize:none;font-family:inherit;"></textarea>
            <button id="${props.id}-add-btn" style="background:var(--accent-blue);color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:calc(12px * var(--font-scale, 1));align-self:flex-end;">Add</button>
          </div>
          <div id="${props.id}-list" style="flex:1;overflow-y:auto;"></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Notes Widget: ${props.id}
      (function() {
        let notes = [];
        const container = document.getElementById('${props.id}-list');
        const input = document.getElementById('${props.id}-input');
        const addBtn = document.getElementById('${props.id}-add-btn');
        const badge = document.getElementById('${props.id}-badge');

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\n/g,'<br>'); }

        function render() {
          badge.textContent = notes.length;
          container.innerHTML = notes.map((n, i) =>
            '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:calc(13px * var(--font-scale, 1));">' +
              '<span style="flex:1;white-space:pre-wrap;word-break:break-word;">' + esc(n.text) + '</span>' +
              '<button data-del="' + i + '" style="background:none;border:none;color:var(--accent-red,#f85149);cursor:pointer;font-size:calc(14px * var(--font-scale, 1));padding:0 4px;flex-shrink:0;">✕</button>' +
            '</div>'
          ).join('');
        }

        function save() {
          fetch('/api/notes').then(r => r.json()).then(all => {
            all['${props.id}'] = notes;
            return fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all) });
          }).catch(() => {});
        }

        container.addEventListener('click', function(e) {
          if (e.target.dataset.del != null) {
            notes.splice(parseInt(e.target.dataset.del), 1);
            save(); render();
          }
        });

        addBtn.addEventListener('click', function() {
          const text = input.value.trim();
          if (!text) return;
          notes.push({ text: text, ts: Date.now() });
          input.value = '';
          save(); render();
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addBtn.click(); }
        });

        fetch('/api/notes').then(r => r.json()).then(all => {
          notes = Array.isArray(all['${props.id}']) ? all['${props.id}'] : [];
          render();
        }).catch(() => render());
      })();
    `
  },

  // ─────────────────────────────────────────────
  // BARS
  // ─────────────────────────────────────────────

  'text-header': {
    name: 'Header / Text',
    icon: '🔤',
    category: 'layout',
    description: 'Custom text or heading. Adjustable font size, color, and alignment.',
    defaultWidth: 400,
    defaultHeight: 50,
    hasApiKey: false,
    properties: {
      title: 'My Dashboard',
      showHeader: false,
      showBorder: false,
      fontSize: 24,
      fontColor: '#e6edf3',
      textAlign: 'left',
      fontWeight: 'bold'
    },
    preview: `<div style="padding:8px;font-size:18px;font-weight:bold;">My Dashboard</div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="height:100%;display:flex;align-items:center;padding:0 12px;
        font-size:${props.fontSize || 24}px;
        color:${props.fontColor || '#e6edf3'};
        text-align:${props.textAlign || 'left'};
        font-weight:${props.fontWeight || 'bold'};
        justify-content:${props.textAlign === 'center' ? 'center' : props.textAlign === 'right' ? 'flex-end' : 'flex-start'};${props.showBorder ? 'border:1px solid #3a4150;border-radius:8px;' : ''}">
        ${props.title || 'Header'}
      </div>`,
    generateJs: () => ''
  },

  'horizontal-line': {
    name: 'Horizontal Line',
    icon: '➖',
    category: 'layout',
    description: 'A horizontal divider line. Resize width to fit.',
    defaultWidth: 600,
    defaultHeight: 10,
    hasApiKey: false,
    properties: {
      title: '',
      showHeader: false,
      lineColor: '#30363d',
      lineThickness: 2
    },
    preview: `<div style="padding:4px 0;"><hr style="border:none;border-top:2px solid #30363d;"></div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="width:100%;height:100%;display:flex;align-items:center;padding:0;">
        <hr style="width:100%;border:none;border-top:${props.lineThickness || 2}px solid ${props.lineColor || '#30363d'};margin:0;flex-shrink:0;">
      </div>`,
    generateJs: () => ''
  },

  'vertical-line': {
    name: 'Vertical Line',
    icon: '│',
    category: 'layout',
    description: 'A vertical divider line. Resize height to fit.',
    defaultWidth: 10,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: '',
      showHeader: false,
      lineColor: '#30363d',
      lineThickness: 2
    },
    preview: `<div style="display:flex;justify-content:center;height:40px;"><div style="border-left:2px solid #30363d;height:100%;"></div></div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="width:100%;height:100%;display:flex;justify-content:center;padding:0;">
        <div style="border-left:${props.lineThickness || 2}px solid ${props.lineColor || '#30363d'};height:100%;flex-shrink:0;"></div>
      </div>`,
    generateJs: () => ''
  },

  // ─────────────────────────────────────────────
  // AI / LLM MONITORING
  // ─────────────────────────────────────────────

  'ai-usage-claude': {
    name: 'Claude Usage',
    icon: '🟣',
    category: 'small',
    description: 'Shows Anthropic Claude API usage and costs. Requires an Admin API key.',
    defaultWidth: 220,
    defaultHeight: 160,
    hasApiKey: true,
    apiKeyName: 'ANTHROPIC_ADMIN_KEY',
    hideApiKeyVar: true,
    properties: {
      title: 'Claude',
      refreshInterval: 300,
      apiKeyNote: ''
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#a371f7;">Claude</div>
      <div style="font-size:18px;">125K tokens</div>
      <div style="font-size:11px;color:#8b949e;">$4.20 today</div>
      <div style="font-size:10px;color:#6e7681;margin-top:4px;">Week $28.50 · Month $95.00</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('ai-claude')} ${props.title || 'Claude'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <div class="kpi-value" id="${props.id}-tokens" style="color:#a371f7;font-size:calc(22px * var(--font-scale, 1));">—</div>
          <div class="kpi-label" id="${props.id}-cost" style="font-size:calc(12px * var(--font-scale, 1));">today</div>
          <div id="${props.id}-period" style="font-size:calc(10px * var(--font-scale, 1));color:#6e7681;margin-top:4px;text-align:center;"></div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/usage/claude');
          const data = await res.json();
          const tokensEl = document.getElementById('${props.id}-tokens');
          const costEl = document.getElementById('${props.id}-cost');
          const periodEl = document.getElementById('${props.id}-period');
          if (data.error) {
            tokensEl.textContent = '⚠️';
            tokensEl.style.fontSize = '18px';
            costEl.textContent = data.error.includes('API key') ? 'No API Key' : data.error;
            periodEl.textContent = '';
            return;
          }
          const fmt = (n) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toString();
          const tokens = data.tokens || 0;
          tokensEl.textContent = fmt(tokens) + ' tokens';
          costEl.textContent = '$' + (data.cost || 0).toFixed(2) + ' today';
          const parts = [];
          if (data.week) parts.push('Week $' + data.week.cost.toFixed(2));
          if (data.month) parts.push('Month $' + data.month.cost.toFixed(2));
          periodEl.textContent = parts.join(' · ');
        } catch (e) {
          document.getElementById('${props.id}-tokens').textContent = '—';
          document.getElementById('${props.id}-cost').textContent = 'Error';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  /* DROPPED: OpenAI Usage - requires Admin API key which is not available on all plans
  'ai-usage-openai': { ... },
  */

  /* DROPPED: Gemini - no public usage API available
  'ai-usage-gemini': {
    name: 'Gemini Usage',
    icon: '🔵',
    category: 'small',
    description: 'Shows Google Gemini API usage stats. Requires usage API proxy.',
    defaultWidth: 220,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'GEMINI_API_KEY',
    properties: {
      title: 'Gemini',
      refreshInterval: 300
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#58a6ff;">Gemini</div>
      <div style="font-size:20px;">45K</div>
      <div style="font-size:10px;color:#8b949e;">tokens today</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🔵 ${props.title || 'Gemini'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-tokens">—</div>
          <div class="kpi-label" id="${props.id}-cost">tokens today</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Gemini Usage Widget: ${props.id}
      // Requires a backend proxy - Google API doesn't support browser CORS
      // Set up a proxy endpoint for your usage data
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/usage/gemini');
          const json = await res.json();
          const data = json.data || json;
          document.getElementById('${props.id}-tokens').textContent = ((data.tokens || 0) / 1000).toFixed(1) + 'K';
          if (data.cost) {
            document.getElementById('${props.id}-cost').textContent = '$' + data.cost.toFixed(2) + ' today';
          }
        } catch (e) {
          document.getElementById('${props.id}-tokens').textContent = '—';
          document.getElementById('${props.id}-cost').textContent = 'Configure endpoint';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'ai-usage-multi': {
    name: 'AI Usage (All)',
    icon: '🤖',
    category: 'large',
    description: 'Combined view of Claude, GPT, and Gemini usage in one widget.',
    defaultWidth: 400,
    defaultHeight: 280,
    hasApiKey: true,
    apiKeyName: 'Multiple (see below)',
    properties: {
      title: 'AI Usage',
      showClaude: true,
      showOpenAI: true,
      showGemini: true,
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div style="margin:4px 0;"><span style="color:#a371f7;">🟣 Claude</span> 125K tokens</div>
      <div style="margin:4px 0;"><span style="color:#3fb950;">🟢 GPT</span> 89K tokens</div>
      <div style="margin:4px 0;"><span style="color:#58a6ff;">🔵 Gemini</span> 45K tokens</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🤖 ${props.title || 'AI Usage'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-usage">
          <div class="usage-row"><span style="color:#a371f7">🟣 Claude</span><span class="usage-tokens">125K · $4.20</span></div>
          <div class="usage-row"><span style="color:#3fb950">🟢 GPT</span><span class="usage-tokens">89K · $2.85</span></div>
          <div class="usage-row"><span style="color:#58a6ff">🔵 Gemini</span><span class="usage-tokens">45K · $0.90</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // AI Usage Multi Widget: ${props.id}
      // Requires backend endpoints for each service
      // API Keys needed: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
      async function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-usage');
        const services = [];
        ${props.showClaude !== false ? "services.push({ name: 'Claude', icon: '🟣', color: '#a371f7', endpoint: '/api/usage/claude' });" : ''}
        ${props.showOpenAI !== false ? "services.push({ name: 'GPT', icon: '🟢', color: '#3fb950', endpoint: '/api/usage/openai' });" : ''}
        ${props.showGemini !== false ? "services.push({ name: 'Gemini', icon: '🔵', color: '#58a6ff', endpoint: '/api/usage/gemini' });" : ''}
        
        const results = await Promise.all(services.map(async (svc) => {
          try {
            const res = await fetch(svc.endpoint);
            const json = await res.json();
            const data = json.data || json;
            return { ...svc, tokens: data.tokens || 0, cost: data.cost || 0 };
          } catch (e) {
            return { ...svc, tokens: 0, cost: 0, error: true };
          }
        }));
        
        container.innerHTML = results.map(r => {
          const tokensStr = r.error ? '—' : ((r.tokens / 1000).toFixed(1) + 'K');
          const costStr = r.cost ? ' · $' + r.cost.toFixed(2) : '';
          return '<div class="usage-row"><span style="color:' + r.color + '">' + r.icon + ' ' + r.name + '</span><span class="usage-tokens">' + tokensStr + costStr + '</span></div>';
        }).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },
  END DROPPED: Gemini + Multi */

  'ai-cost-tracker': {
    name: 'AI Cost Tracker',
    icon: '💰',
    category: 'small',
    description: 'Tracks total AI API spending across providers.',
    defaultWidth: 200,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'AI Costs',
      period: 'today',
      endpoint: '/api/costs',
      refreshInterval: 300
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;color:#3fb950;">$4.27</div>
      <div style="font-size:11px;color:#8b949e;">Today</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('ai-cost')} ${props.title || 'AI Costs'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-value green" id="${props.id}-cost">—</div>
          <div class="kpi-label">${props.period || 'Today'}</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // AI Cost Tracker Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/costs'}?period=${props.period || 'today'}');
          const json = await res.json();
          const data = json.data || json;
          document.getElementById('${props.id}-cost').textContent = '$' + (data.cost || 0).toFixed(2);
        } catch (e) {
          document.getElementById('${props.id}-cost').textContent = '$—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'api-status': {
    name: 'API Status',
    icon: '🔄',
    category: 'large',
    description: 'Shows health status of multiple API endpoints with colored indicators.',
    defaultWidth: 350,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'API Status',
      services: 'OpenAI,Anthropic,Google,OpenClaw',
      refreshInterval: 60
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🟢 OpenAI</div>
      <div>🟢 Anthropic</div>
      <div>🟡 Google</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('api-status')} ${props.title || 'API Status'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-status">
          <div class="status-row">🟢 OpenAI</div>
          <div class="status-row">🟢 Anthropic</div>
          <div class="status-row">🟢 Google</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // API Status Widget: ${props.id}
      const services_${props.id.replace(/-/g, '_')} = '${props.services || 'OpenAI,Anthropic'}'.split(',');
      const endpoints_${props.id.replace(/-/g, '_')} = {
        'OpenAI': 'https://status.openai.com/api/v2/status.json',
        'Anthropic': 'https://status.anthropic.com/api/v2/status.json',
        'Google': 'https://status.cloud.google.com/',
        'OpenClaw': '/api/status'
      };
      async function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-status');
        const results = await Promise.all(services_${props.id.replace(/-/g, '_')}.map(async (svc) => {
          const name = svc.trim();
          try {
            const endpoint = endpoints_${props.id.replace(/-/g, '_')}[name] || '/api/health/' + name.toLowerCase();
            const res = await fetch(endpoint, { mode: 'no-cors' });
            return { name, status: 'ok' };
          } catch (e) {
            return { name, status: 'unknown' };
          }
        }));
        container.innerHTML = results.map(r => {
          const icon = r.status === 'ok' ? '🟢' : r.status === 'error' ? '🔴' : '🟡';
          return '<div class="status-row">' + icon + ' ' + r.name + '</div>';
        }).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'session-count': {
    name: 'Active Sessions',
    icon: '💬',
    category: 'small',
    description: 'Shows count of active OpenClaw sessions.',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Sessions',
      server: 'local',
      endpoint: '/api/sessions',
      refreshInterval: 30
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:28px;color:#58a6ff;">3</div>
      <div style="font-size:11px;color:#8b949e;">Active</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('sessions')} ${props.title || 'Sessions'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-value blue" id="${props.id}-count">—</div>
          <div class="kpi-label">Active</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Session Count Widget: ${props.id} — ${props.server === 'local' ? 'local' : 'remote: ' + props.server}
      async function update_${props.id.replace(/-/g, '_')}() {
        const serverId = '${props.server || 'local'}';
        try {
          let count;
          if (serverId === 'local') {
            const res = await fetch('${props.endpoint || '/api/sessions'}');
            const json = await res.json();
            const data = json.data || json;
            count = data.active || data.length || 0;
          } else {
            const res = await fetch('/api/servers/' + serverId + '/stats');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            count = data.openclaw?.sessions?.active || data.openclaw?.sessions?.recent24h || 0;
          }
          document.getElementById('${props.id}-count').textContent = count;
        } catch (e) {
          document.getElementById('${props.id}-count').textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
    `
  },

  'token-gauge': {
    name: 'Token Gauge',
    icon: '📊',
    category: 'small',
    description: 'Visual gauge showing token usage from OpenClaw.',
    defaultWidth: 180,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Tokens',
      maxTokens: 1000000,
      endpoint: '/api/usage/tokens',
      refreshInterval: 60
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:18px;">425K</div>
      <div style="height:6px;background:#21262d;border-radius:3px;margin:6px 0;"><div style="width:42%;height:100%;background:#58a6ff;border-radius:3px;"></div></div>
      <div style="font-size:10px;color:#8b949e;">of 1M limit</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('tokens')} ${props.title || 'Tokens'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-value">—</div>
          <div class="gauge-bar"><div class="gauge-fill" id="${props.id}-fill"></div></div>
          <div class="kpi-label">of ${((props.maxTokens || 1000000) / 1000000).toFixed(1)}M limit</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Token Gauge Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/usage/tokens'}');
          const json = await res.json();
          const data = json.data || json;
          const tokens = data.tokens || 0;
          const max = ${props.maxTokens || 1000000};
          const pct = Math.min(100, (tokens / max) * 100);
          document.getElementById('${props.id}-value').textContent = (tokens / 1000).toFixed(0) + 'K';
          document.getElementById('${props.id}-fill').style.width = pct + '%';
        } catch (e) {
          document.getElementById('${props.id}-value').textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // SYSTEM MONITORING
  // ─────────────────────────────────────────────

  'cpu-memory': {
    name: 'CPU / Memory',
    icon: '💻',
    category: 'small',
    description: 'Shows CPU and memory usage. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'System',
      server: 'local',
      refreshInterval: 5
    },
    preview: `<div style="padding:8px;font-size:11px;">
      <div>CPU: <span style="color:#58a6ff;">23%</span></div>
      <div>MEM: <span style="color:#3fb950;">4.2GB</span></div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('cpu')} ${props.title || 'System'}</span>
        </div>
        <div class="dash-card-body">
        <div class="sys-row"><span>CPU</span><span class="blue" id="${props.id}-cpu">—</span></div>
        <div class="sys-row"><span>MEM</span><span class="green" id="${props.id}-mem">—</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // CPU/Memory Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      onStats('${props.server || 'local'}', function(data) {
        // Handle offline state
        if (data._offline) {
          document.getElementById('${props.id}-cpu').textContent = '⚠️';
          document.getElementById('${props.id}-mem').textContent = 'offline';
          return;
        }
        if (data.cpu) {
          document.getElementById('${props.id}-cpu').textContent = data.cpu.currentLoad.toFixed(0) + '%';
        }
        if (data.memory) {
          const used = (data.memory.active / (1024*1024*1024)).toFixed(1);
          const total = (data.memory.total / (1024*1024*1024)).toFixed(1);
          document.getElementById('${props.id}-mem').textContent = used + ' / ' + total + ' GB';
        }
      }, ${(props.refreshInterval || 5) * 1000});
    `
  },

  'system-graphical': {
    name: 'System (Graphical)',
    icon: '💻',
    category: 'system',
    description: 'Graphical CPU and Memory usage with circular progress rings. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 320,
    defaultHeight: 160,
    hasApiKey: false,
    properties: {
      title: 'System',
      server: 'local',
      refreshInterval: 5,
      showPercentages: true,
      showLabels: true,
      showLegend: true
    },
    preview: `<div style="display:flex;padding:12px;">
      <div style="flex:1;display:flex;align-items:center;justify-content:space-around;">
        <div style="text-align:center;">
          <div style="position:relative;width:70px;height:70px;margin:0 auto 6px;">
            <svg viewBox="0 0 42 42" style="width:100%;height:100%;transform:rotate(-90deg);">
              <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#e8eaed" stroke-width="6"/>
              <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#4285f4" stroke-width="6"
                stroke-dasharray="25 75"/>
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;font-weight:700;color:#202124;">25%</div>
          </div>
          <div style="font-size:10px;color:#5f6368;font-weight:500;">CPU</div>
        </div>
        <div style="text-align:center;">
          <div style="position:relative;width:70px;height:70px;margin:0 auto 6px;">
            <svg viewBox="0 0 42 42" style="width:100%;height:100%;transform:rotate(-90deg);">
              <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#e8eaed" stroke-width="6"/>
              <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#34a853" stroke-width="6"
                stroke-dasharray="40 60"/>
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;font-weight:700;color:#202124;">40%</div>
          </div>
          <div style="font-size:10px;color:#5f6368;font-weight:500;">MEM</div>
        </div>
      </div>
      <div style="padding-left:16px;display:flex;flex-direction:column;justify-content:center;font-size:11px;">
        <div style="display:flex;align-items:center;margin-bottom:4px;">
          <div style="width:12px;height:12px;background:#34a853;border-radius:2px;margin-right:8px;"></div>
          <span style="color:#5f6368;">Good (&lt;50%)</span>
        </div>
        <div style="display:flex;align-items:center;margin-bottom:4px;">
          <div style="width:12px;height:12px;background:#ff9800;border-radius:2px;margin-right:8px;"></div>
          <span style="color:#5f6368;">Warning (75%+)</span>
        </div>
        <div style="display:flex;align-items:center;">
          <div style="width:12px;height:12px;background:#ea4335;border-radius:2px;margin-right:8px;"></div>
          <span style="color:#5f6368;">Critical (90%+)</span>
        </div>
      </div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('cpu')} ${props.title || 'System'}</span>
          ${props.server && props.server !== 'local' ? `<span class="dash-card-badge" style="font-size:10px;">🌐</span>` : ''}
        </div>
        <div class="dash-card-body" style="display:flex;padding:16px 12px;">
          <div style="flex:1;display:flex;align-items:center;justify-content:space-around;">
            <div class="system-metric" style="text-align:center;">
              <div style="position:relative;width:90px;height:90px;margin:0 auto;">
                <svg viewBox="0 0 42 42" style="width:100%;height:100%;transform:rotate(-90deg);">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#e8eaed" stroke-width="6"/>
                  <circle id="${props.id}-cpu-ring" cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#4285f4" stroke-width="6"
                    stroke-dasharray="0 100" style="transition: stroke-dasharray 0.6s ease, stroke 0.3s ease;"/>
                </svg>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:18px;font-weight:700;color:var(--text-primary) !important;">
                  <span id="${props.id}-cpu-pct" style="color:var(--text-primary) !important;">—</span>
                </div>
              </div>
              ${props.showLabels ? '<div style="font-size:12px;color:#5f6368;font-weight:500;margin-top:8px;">CPU</div>' : ''}
            </div>
            <div class="system-metric" style="text-align:center;">
              <div style="position:relative;width:90px;height:90px;margin:0 auto;">
                <svg viewBox="0 0 42 42" style="width:100%;height:100%;transform:rotate(-90deg);">
                  <circle cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#e8eaed" stroke-width="6"/>
                  <circle id="${props.id}-mem-ring" cx="21" cy="21" r="15.91549430918954" fill="none" stroke="#34a853" stroke-width="6"
                    stroke-dasharray="0 100" style="transition: stroke-dasharray 0.6s ease, stroke 0.3s ease;"/>
                </svg>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:18px;font-weight:700;color:var(--text-primary) !important;">
                  <span id="${props.id}-mem-pct" style="color:var(--text-primary) !important;">—</span>
                </div>
              </div>
              ${props.showLabels ? '<div style="font-size:12px;color:#5f6368;font-weight:500;margin-top:8px;">MEM</div>' : ''}
            </div>
          </div>
          <div id="${props.id}-legend" style="padding-left:20px;display:flex !important;flex-direction:column;justify-content:center;font-size:11px;min-width:120px;visibility:visible !important;">
            <div style="display:flex;align-items:center;margin-bottom:8px;">
              <div style="width:12px;height:12px;background:#34a853 !important;border-radius:2px;margin-right:8px;flex-shrink:0;"></div>
              <span style="color:var(--text-secondary) !important;">Good (&lt;50%)</span>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:8px;">
              <div style="width:12px;height:12px;background:#4285f4 !important;border-radius:2px;margin-right:8px;flex-shrink:0;"></div>
              <span style="color:var(--text-secondary) !important;">Moderate (50%+)</span>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:8px;">
              <div style="width:12px;height:12px;background:#ff9800 !important;border-radius:2px;margin-right:8px;flex-shrink:0;"></div>
              <span style="color:var(--text-secondary) !important;">Warning (75%+)</span>
            </div>
            <div style="display:flex;align-items:center;">
              <div style="width:12px;height:12px;background:#ea4335 !important;border-radius:2px;margin-right:8px;flex-shrink:0;"></div>
              <span style="color:var(--text-secondary) !important;">Critical (90%+)</span>
            </div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // System (Graphical) Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      
      function getUsageColor_${props.id.replace(/-/g, '_')}(percentage, metric) {
        // Different colors for CPU vs Memory like in the reference image
        if (metric === 'cpu') {
          if (percentage >= 90) return '#ea4335'; // Red for critical
          if (percentage >= 75) return '#ff9800'; // Orange for warning  
          return '#4285f4'; // Google blue for normal
        } else {
          if (percentage >= 90) return '#ea4335'; // Red for critical
          if (percentage >= 75) return '#ff9800'; // Orange for warning
          return '#34a853'; // Google green for normal
        }
      }
      
      function updateProgressRing_${props.id.replace(/-/g, '_')}(ringId, percentage, textId, metric) {
        const ring = document.getElementById(ringId);
        const text = document.getElementById(textId);
        if (!ring || !text) return;
        
        const normalizedPct = Math.max(0, Math.min(100, percentage || 0));
        const color = getUsageColor_${props.id.replace(/-/g, '_')}(normalizedPct, metric);
        
        // Use stroke-dasharray instead of stroke-dashoffset for cleaner animation
        ring.style.strokeDasharray = normalizedPct + ' ' + (100 - normalizedPct);
        ring.style.stroke = color;
        text.textContent = Math.round(normalizedPct) + '%';
        text.style.color = 'var(--text-primary)';
        text.style.setProperty('color', 'var(--text-primary)', 'important');
      }
      
      // Handle legend visibility
      const legendEl = document.getElementById('${props.id}-legend');
      if (legendEl) {
        legendEl.style.display = ${props.showLegend !== false ? "'flex'" : "'none'"};
        legendEl.style.visibility = 'visible';
      }
      
      onStats('${props.server || 'local'}', function(data) {
        // Handle offline state
        if (data._offline) {
          document.getElementById('${props.id}-cpu-pct').textContent = '⚠️';
          document.getElementById('${props.id}-mem-pct').textContent = '⚠️';
          document.getElementById('${props.id}-cpu-ring').style.strokeDasharray = '0 100';
          document.getElementById('${props.id}-mem-ring').style.strokeDasharray = '0 100';
          return;
        }
        
        // Update CPU ring
        if (data.cpu && data.cpu.currentLoad != null) {
          updateProgressRing_${props.id.replace(/-/g, '_')}('${props.id}-cpu-ring', data.cpu.currentLoad, '${props.id}-cpu-pct', 'cpu');
        }
        
        // Update Memory ring  
        if (data.memory && data.memory.total && data.memory.active != null) {
          const memoryPct = (data.memory.active / data.memory.total) * 100;
          updateProgressRing_${props.id.replace(/-/g, '_')}('${props.id}-mem-ring', memoryPct, '${props.id}-mem-pct', 'mem');
        }
      }, ${(props.refreshInterval || 5) * 1000});
    `
  },

  'disk-usage': {
    name: 'Disk Usage',
    icon: '💾',
    category: 'small',
    description: 'Shows disk space usage. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Disk',
      server: 'local',
      path: '/',
      refreshInterval: 60
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;color:#d29922;">68%</div>
      <div style="font-size:11px;color:#8b949e;">256GB used</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('disk')} ${props.title || 'Disk Usage'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-ring-wrap kpi-ring-sm">
            <svg class="kpi-ring" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>
              <circle id="${props.id}-ring" cx="24" cy="24" r="20" fill="none" stroke="var(--accent-orange)" stroke-width="4"
                stroke-dasharray="125.66" stroke-dashoffset="125.66" stroke-linecap="round"
                transform="rotate(-90 24 24)" style="transition: stroke-dashoffset 0.6s ease;"/>
            </svg>
            <div class="kpi-ring-label" id="${props.id}-pct">—</div>
          </div>
          <div class="kpi-data">
            <div class="kpi-label" id="${props.id}-size">Disk</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Disk Usage Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      onStats('${props.server || 'local'}', function(data) {
        // Handle offline state
        if (data._offline) {
          document.getElementById('${props.id}-pct').textContent = '⚠️';
          document.getElementById('${props.id}-size').textContent = 'offline';
          document.getElementById('${props.id}-ring').style.strokeDashoffset = 125.66;
          return;
        }
        
        // Handle both local (array) and remote (object) disk data
        let d;
        if (Array.isArray(data.disk)) {
          if (data.disk.length === 0) return;
          const targetMount = '${props.path || '/'}';
          d = data.disk.find(x => x.mount === targetMount) || data.disk[0];
        } else if (data.disk) {
          d = data.disk;
        } else {
          return;
        }
        const pct = d.use || d.percent || 0;
        const circumference = 125.66;
        document.getElementById('${props.id}-ring').style.strokeDashoffset = circumference - (pct / 100) * circumference;
        document.getElementById('${props.id}-pct').textContent = Math.round(pct) + '%';
        const usedGB = ((d.used || 0) / (1024*1024*1024)).toFixed(1);
        const totalGB = ((d.size || d.total || 0) / (1024*1024*1024)).toFixed(0);
        document.getElementById('${props.id}-size').textContent = usedGB + ' / ' + totalGB + ' GB';
      }, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'uptime-monitor': {
    name: 'Uptime Monitor',
    icon: '📡',
    category: 'large',
    description: 'Shows system uptime, CPU, and memory. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 350,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Uptime',
      server: 'local',
      refreshInterval: 30
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🟢 System — 5d 12h</div>
      <div>🟢 CPU — 12.5%</div>
      <div>🟢 Memory — 45.2%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('uptime')} ${props.title || 'Uptime'}</span>
          ${props.server && props.server !== 'local' ? `<span class="dash-card-badge" style="font-size:10px;">🌐</span>` : ''}
        </div>
        <div class="dash-card-body" id="${props.id}-services">
          <div class="uptime-row" style="color:var(--text-muted);justify-content:center;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Uptime Monitor Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      onStats('${props.server || 'local'}', function(data) {
        const container = document.getElementById('${props.id}-services');
        
        // Handle offline state
        if (data._offline) {
          const lastSeen = data._lastSuccess ? new Date(data._lastSuccess).toLocaleTimeString() : 'never';
          container.innerHTML = '<div class="uptime-row" style="color:#f85149;justify-content:center;">⚠️ Connection lost</div>' +
            '<div class="uptime-row" style="opacity:0.6;font-size:11px;justify-content:center;">Last: ' + lastSeen + '</div>';
          return;
        }
        
        if (data.uptime == null) return;
        const secs = data.uptime;
        const d = Math.floor(secs / 86400);
        const h = Math.floor((secs % 86400) / 3600);
        const m = Math.floor((secs % 3600) / 60);
        let uptimeStr = '';
        if (d > 0) uptimeStr = d + 'd ' + h + 'h ' + m + 'm';
        else if (h > 0) uptimeStr = h + 'h ' + m + 'm';
        else uptimeStr = m + 'm';
        var html = '<div class="uptime-row"><span>' + window.renderIcon('uptime') + ' System</span><span class="uptime-pct">' + uptimeStr + '</span></div>';
        if (data.cpu) {
          html += '<div class="uptime-row"><span>' + window.renderIcon('cpu') + ' CPU Load</span><span class="uptime-pct">' + data.cpu.currentLoad.toFixed(1) + '%</span></div>';
        }
        if (data.memory) {
          const memPct = ((data.memory.active / data.memory.total) * 100).toFixed(1);
          html += '<div class="uptime-row"><span>' + window.renderIcon('memory') + ' Memory</span><span class="uptime-pct">' + memPct + '%</span></div>';
        }
        if (data.serverName && data._remote) {
          html += '<div class="uptime-row" style="opacity:0.6;font-size:11px;"><span>📡 ' + data.serverName + '</span></div>';
        }
        container.innerHTML = html;
      }, ${(props.refreshInterval || 30) * 1000});
    `
  },

  'docker-containers': {
    name: 'Docker Containers',
    icon: '🐳',
    category: 'large',
    description: 'Lists Docker containers with status. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 380,
    defaultHeight: 250,
    hasApiKey: false,
    properties: {
      title: 'Containers',
      server: 'local',
      refreshInterval: 10
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🟢 nginx — Up 3d</div>
      <div>🟢 postgres — Up 3d</div>
      <div>🔴 redis — Exited</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('docker')} ${props.title || 'Containers'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list" id="${props.id}-list">
          <div class="docker-row" style="color:var(--text-muted);justify-content:center;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Docker Containers Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      onStats('${props.server || 'local'}', function(data) {
        const list = document.getElementById('${props.id}-list');
        const badge = document.getElementById('${props.id}-badge');
        
        // Handle offline state
        if (data._offline) {
          list.innerHTML = '<div class="docker-row" style="color:#f85149;">⚠️ Connection lost</div>';
          badge.textContent = '—';
          return;
        }
        
        // Handle remote docker data structure
        const dockerData = data._remote && data.docker?.containers ? data.docker.containers : data.docker;
        if (!dockerData || dockerData.length === 0) {
          const msg = data._remote && data.docker?.available === false ? 'Docker not available' : 'No containers found';
          list.innerHTML = '<div class="docker-row" style="color:var(--text-muted);">' + msg + '</div>';
          badge.textContent = data._remote && data.docker ? (data.docker.running || 0) + '/' + (data.docker.total || 0) : '0';
          return;
        }
        const containers = dockerData;
        list.innerHTML = containers.map(function(c) {
          const running = c.state === 'running' || c.running === true;
          const icon = running ? '🟢' : '🔴';
          const name = (c.name || '').replace(/^\\//, '');
          return '<div class="docker-row">' + icon + ' ' + name + '<span class="docker-status">' + (c.state || c.status || '—') + '</span></div>';
        }).join('');
        badge.textContent = data._remote && data.docker ? (data.docker.running || 0) + '/' + (data.docker.total || 0) : containers.length;
      }, ${(props.refreshInterval || 10) * 1000});
    `
  },

  'network-speed': {
    name: 'Network Speed',
    icon: '🌐',
    category: 'small',
    description: 'Shows real-time network activity. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 200,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Network',
      server: 'local',
      refreshInterval: 5
    },
    preview: `<div style="padding:8px;font-size:11px;">
      <div>↓ <span style="color:#3fb950;">45 KB/s</span></div>
      <div>↑ <span style="color:#58a6ff;">12 KB/s</span></div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('network')} ${props.title || 'Network'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="net-row">↓ <span class="green" id="${props.id}-down">—</span></div>
          <div class="net-row">↑ <span class="blue" id="${props.id}-up">—</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Network Speed Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      function _fmtRate(bytes) {
        if (bytes == null || bytes < 0) return '0 B/s';
        if (bytes < 1024) return bytes.toFixed(0) + ' B/s';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
      }
      onStats('${props.server || 'local'}', function(data) {
        // Handle offline state
        if (data._offline) {
          document.getElementById('${props.id}-down').textContent = '⚠️';
          document.getElementById('${props.id}-up').textContent = 'offline';
          return;
        }
        
        if (!data.network || data.network.length === 0) return;
        // Handle both local (array) and remote (object) formats
        let rx = 0, tx = 0;
        if (Array.isArray(data.network)) {
          data.network.forEach(function(n) {
            if (n.iface !== 'lo' && n.iface !== 'lo0') {
              rx += (n.rx_sec || 0);
              tx += (n.tx_sec || 0);
            }
          });
        } else {
          rx = data.network.rx_sec || data.network.rxSec || 0;
          tx = data.network.tx_sec || data.network.txSec || 0;
        }
        document.getElementById('${props.id}-down').textContent = _fmtRate(rx);
        document.getElementById('${props.id}-up').textContent = _fmtRate(tx);
      }, ${(props.refreshInterval || 5) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // PRODUCTIVITY
  // ─────────────────────────────────────────────

  'todo-list': {

    name: 'Todo List',
    icon: '✅',
    category: 'large',
    description: 'Task list with checkboxes. Requires storage backend.',
    defaultWidth: 350,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: 'Todo'
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>☑️ Complete project</div>
      <div>⬜ Review PR</div>
      <div>⬜ Send email</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('todo')} ${props.title || 'Todo'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">0</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
          <div style="display:flex;gap:6px;padding:0 0 8px 0;flex-shrink:0;">
            <input type="text" id="${props.id}-input" placeholder="Add a task..." style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;color:var(--text-primary);font-size:calc(12px * var(--font-scale, 1));">
            <button id="${props.id}-add-btn" style="background:var(--accent-blue);color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:calc(12px * var(--font-scale, 1));">Add</button>
          </div>
          <div id="${props.id}-list" style="flex:1;overflow-y:auto;"></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Todo List Widget: ${props.id}
      (function() {
        let todos = [];
        const container = document.getElementById('${props.id}-list');
        const input = document.getElementById('${props.id}-input');
        const addBtn = document.getElementById('${props.id}-add-btn');
        const badge = document.getElementById('${props.id}-badge');

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

        function render() {
          badge.textContent = todos.filter(t => !t.done).length + '/' + todos.length;
          container.innerHTML = todos.map((t, i) =>
            '<div class="todo-item" style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:calc(13px * var(--font-scale, 1));">' +
              '<input type="checkbox" data-idx="' + i + '"' + (t.done ? ' checked' : '') + '>' +
              '<span style="flex:1;' + (t.done ? 'text-decoration:line-through;opacity:0.5;' : '') + '">' + esc(t.text) + '</span>' +
              '<button data-del="' + i + '" style="background:none;border:none;color:var(--accent-red,#f85149);cursor:pointer;font-size:calc(14px * var(--font-scale, 1));padding:0 4px;">✕</button>' +
            '</div>'
          ).join('');
        }

        function save() {
          fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todos) });
        }

        container.addEventListener('change', function(e) {
          if (e.target.dataset.idx != null) {
            todos[e.target.dataset.idx].done = e.target.checked;
            save(); render();
          }
        });

        container.addEventListener('click', function(e) {
          if (e.target.dataset.del != null) {
            todos.splice(parseInt(e.target.dataset.del), 1);
            save(); render();
          }
        });

        addBtn.addEventListener('click', function() {
          const text = input.value.trim();
          if (!text) return;
          todos.push({ text: text, done: false });
          input.value = '';
          save(); render();
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') addBtn.click();
        });

        fetch('/api/todos').then(r => r.json()).then(data => {
          todos = Array.isArray(data) ? data : [];
          render();
        }).catch(() => render());
      })();
    `
  },

  'email-count': {
    name: 'Unread Emails',
    icon: '📧',
    category: 'small',
    description: 'Shows unread email count. Requires email API proxy.',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'EMAIL_API',
    properties: {
      title: 'Email',
      endpoint: '/api/email/unread',
      refreshInterval: 120
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:28px;color:#f85149;">12</div>
      <div style="font-size:11px;color:#8b949e;">Unread</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('email')} ${props.title || 'Email'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-value red" id="${props.id}-count">—</div>
          <div class="kpi-label">Unread</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Email Count Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/email/unread'}');
          const data = await res.json();
          const el = document.getElementById('${props.id}-count');
          el.textContent = data.count || 0;
          el.className = 'kpi-value ' + (data.count > 0 ? 'red' : 'green');
        } catch (e) {
          document.getElementById('${props.id}-count').textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'pomodoro': {
    name: 'Pomodoro Timer',
    icon: '🎯',
    category: 'small',
    description: 'Focus timer with configurable work/break intervals. Plays sound when done.',
    defaultWidth: 200,
    defaultHeight: 140,
    hasApiKey: false,
    properties: {
      title: 'Focus',
      workMinutes: 25,
      breakMinutes: 5
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:24px;">25:00</div>
      <div style="font-size:11px;color:#8b949e;">▶️ Start</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('pomodoro')} ${props.title || 'Focus'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
          <div class="kpi-value" id="${props.id}-time">${props.workMinutes || 25}:00</div>
          <button class="pomo-btn" id="${props.id}-btn" onclick="togglePomo_${props.id.replace(/-/g, '_')}()">▶️ Start</button>
        </div>
      </div>`,
    generateJs: (props) => `
      // Pomodoro Widget: ${props.id}
      let pomoRunning_${props.id.replace(/-/g, '_')} = false;
      let pomoSeconds_${props.id.replace(/-/g, '_')} = ${(props.workMinutes || 25) * 60};
      let pomoInterval_${props.id.replace(/-/g, '_')};
      let pomoIsBreak_${props.id.replace(/-/g, '_')} = false;
      
      // Audio context created on first user interaction
      let pomoAudioCtx_${props.id.replace(/-/g, '_')} = null;
      
      function playPomoSound_${props.id.replace(/-/g, '_')}() {
        try {
          if (!pomoAudioCtx_${props.id.replace(/-/g, '_')}) {
            pomoAudioCtx_${props.id.replace(/-/g, '_')} = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = pomoAudioCtx_${props.id.replace(/-/g, '_')};
          if (ctx.state === 'suspended') ctx.resume();
          
          const now = ctx.currentTime;
          // Schedule 3 beeps
          [0, 0.4, 0.8].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = i === 2 ? 1000 : 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.3);
            osc.start(now + delay);
            osc.stop(now + delay + 0.3);
          });
        } catch (e) { console.log('Audio not supported:', e); }
      }
      
      // Initialize audio context on first click
      function initPomoAudio_${props.id.replace(/-/g, '_')}() {
        if (!pomoAudioCtx_${props.id.replace(/-/g, '_')}) {
          pomoAudioCtx_${props.id.replace(/-/g, '_')} = new (window.AudioContext || window.webkitAudioContext)();
        }
      }
      
      function togglePomo_${props.id.replace(/-/g, '_')}() {
        const btn = document.getElementById('${props.id}-btn');
        const timeEl = document.getElementById('${props.id}-time');
        
        // Initialize audio on user interaction
        initPomoAudio_${props.id.replace(/-/g, '_')}();
        
        if (pomoRunning_${props.id.replace(/-/g, '_')}) {
          clearInterval(pomoInterval_${props.id.replace(/-/g, '_')});
          btn.textContent = '▶️ Start';
        } else {
          // If showing Done, reset to work time
          if (timeEl.textContent === 'Done!' || timeEl.textContent === 'Break!') {
            pomoIsBreak_${props.id.replace(/-/g, '_')} = !pomoIsBreak_${props.id.replace(/-/g, '_')};
            pomoSeconds_${props.id.replace(/-/g, '_')} = pomoIsBreak_${props.id.replace(/-/g, '_')} 
              ? ${(props.breakMinutes || 5) * 60} 
              : ${(props.workMinutes || 25) * 60};
          }
          
          pomoInterval_${props.id.replace(/-/g, '_')} = setInterval(() => {
            pomoSeconds_${props.id.replace(/-/g, '_')}--;
            if (pomoSeconds_${props.id.replace(/-/g, '_')} <= 0) {
              clearInterval(pomoInterval_${props.id.replace(/-/g, '_')});
              playPomoSound_${props.id.replace(/-/g, '_')}();
              timeEl.textContent = pomoIsBreak_${props.id.replace(/-/g, '_')} ? 'Done!' : 'Break!';
              btn.textContent = pomoIsBreak_${props.id.replace(/-/g, '_')} ? '🔄 Reset' : '☕ Break';
              pomoRunning_${props.id.replace(/-/g, '_')} = false;
              return;
            }
            const m = Math.floor(pomoSeconds_${props.id.replace(/-/g, '_')} / 60);
            const s = pomoSeconds_${props.id.replace(/-/g, '_')} % 60;
            timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
          }, 1000);
          btn.textContent = '⏸️ Pause';
        }
        pomoRunning_${props.id.replace(/-/g, '_')} = !pomoRunning_${props.id.replace(/-/g, '_')};
      }
    `
  },

  'github-stats': {
    name: 'GitHub Stats',
    icon: '🐙',
    category: 'large',
    description: 'Shows GitHub user/repo stats. Optional token for higher rate limits.',
    defaultWidth: 380,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'GitHub',
      username: 'openclaw',
      repo: 'openclaw',
      apiKey: '',
      refreshInterval: 1800
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>⭐ 142 stars · 🍴 23 forks</div>
      <div>🐛 8 open issues</div>
      <div>📅 Last push: 2h ago</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('github')} ${props.title || 'GitHub'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-stats" style="font-size:calc(13px * var(--font-scale, 1));">
          <div style="color:var(--text-muted);">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // GitHub Stats Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const owner = '${props.username || 'openclaw'}';
        const repo = '${props.repo || 'openclaw'}';
        const headers = {};
        ${props.apiKey ? `headers['Authorization'] = 'token ${props.apiKey}';` : ''}
        try {
          const [repoRes, prRes] = await Promise.all([
            fetch('https://api.github.com/repos/' + owner + '/' + repo, { headers }),
            fetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls?state=open&per_page=1', { headers })
          ]);
          if (!repoRes.ok) throw new Error(repoRes.status);
          const d = await repoRes.json();
          // Get open PR count from Link header (total_count) or array length
          let openPRs = '?';
          if (prRes.ok) {
            const link = prRes.headers.get('Link') || '';
            const lastMatch = link.match(/page=(\\d+)>; rel="last"/);
            openPRs = lastMatch ? lastMatch[1] : (await prRes.json()).length;
          }
          function timeAgo(date) {
            const s = Math.floor((Date.now() - new Date(date)) / 1000);
            if (s < 60) return s + 's ago';
            if (s < 3600) return Math.floor(s/60) + 'm ago';
            if (s < 86400) return Math.floor(s/3600) + 'h ago';
            return Math.floor(s/86400) + 'd ago';
          }
          const el = document.getElementById('${props.id}-stats');
          el.innerHTML =
            '<div style="margin-bottom:6px;font-weight:600;color:var(--text-primary);">' + owner + '/' + repo + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">' +
              '<div>⭐ ' + d.stargazers_count.toLocaleString() + ' stars</div>' +
              '<div>🍴 ' + d.forks_count.toLocaleString() + ' forks</div>' +
              '<div>🐛 ' + d.open_issues_count + ' open issues</div>' +
              '<div>🔀 ' + openPRs + ' open PRs</div>' +
            '</div>' +
            '<div style="margin-top:6px;color:var(--text-secondary);font-size:calc(11px * var(--font-scale, 1));">' +
              '📅 Last push: ' + timeAgo(d.pushed_at) +
            '</div>';
        } catch (e) {
          console.error('GitHub stats widget error:', e);
          document.getElementById('${props.id}-stats').innerHTML = '<div style="color:var(--accent-red,#f85149);">Failed to load repo stats</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 1800) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // FINANCE
  // ─────────────────────────────────────────────

  'stock-ticker': {
    name: 'Stock Ticker',
    icon: '📈',
    category: 'bar',
    description: 'Scrolling stock ticker with multiple symbols. Free API key required — sign up at finnhub.io/register (60 calls/min free). Enter symbols separated by commas (e.g. AAPL, MSFT, GOOGL).',
    defaultWidth: 1920,
    defaultHeight: 40,
    hasApiKey: true,
    apiKeyName: 'FINNHUB_API_KEY',
    hideApiKeyVar: true,
    properties: {
      title: 'Stocks',
      symbol: 'AAPL, MSFT, GOOGL, AMZN, TSLA',
      apiKey: '',
      apiKeyNote: 'Get a free key at finnhub.io/register',
      refreshInterval: 60
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;overflow:hidden;">
      📈 AAPL $185.42 <span style="color:#3fb950;">+1.2%</span> •• MSFT $420.15 <span style="color:#f85149;">-0.3%</span> •• GOOGL $175.80 <span style="color:#3fb950;">+0.8%</span>
    </div>`,
    generateHtml: (props) => `
      <section class="news-ticker-wrap" id="widget-${props.id}">
        <span class="ticker-label lb-icon" data-icon="stock">📈</span>
        <div class="ticker-track">
          <div class="ticker-content" id="${props.id}-ticker">${props.apiKey ? 'Loading stocks...' : 'Set API key in Edit Mode (Ctrl+E) — free at finnhub.io/register'}</div>
        </div>
      </section>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        const el = document.getElementById('${props.id}-ticker');
        if (!el) return;
        const apiKey = '${props.apiKey || ''}';
        if (!apiKey) {
          el.innerHTML = 'Set API key in Edit Mode — <a href="https://finnhub.io/register" target="_blank" style="color:#58a6ff;">get free key →</a>';
          return;
        }
        const symbols = '${props.symbol || 'AAPL'}'.split(',').map(s => s.trim()).filter(Boolean);
        try {
          const results = await Promise.all(symbols.map(async (sym) => {
            try {
              const res = await fetch('https://finnhub.io/api/v1/quote?symbol=' + sym + '&token=' + apiKey);
              const data = await res.json();
              if (data.c === 0 && data.h === 0) return '<span class="ticker-link" style="color:#8b949e;">' + sym + ' —</span>';
              const change = ((data.c - data.pc) / data.pc * 100).toFixed(2);
              const color = change >= 0 ? '#3fb950' : '#f85149';
              const arrow = change >= 0 ? '▲' : '▼';
              return '<span class="ticker-link" style="cursor:default;">' +
                '<strong>' + sym + '</strong> $' + data.c.toFixed(2) +
                ' <span style="color:' + color + ';">' + arrow + ' ' + (change >= 0 ? '+' : '') + change + '%</span></span>';
            } catch (_) {
              return '<span class="ticker-link" style="color:#8b949e;">' + sym + ' —</span>';
            }
          }));
          el.innerHTML = results.join('<span class="ticker-sep"> \\u2022\\u2022\\u2022 </span>');
        } catch (e) {
          if (!el.dataset.loaded) el.textContent = 'Failed to load stocks';
        }
        el.dataset.loaded = '1';
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'crypto-price': {
    name: 'Crypto Price',
    icon: '₿',
    category: 'small',
    description: 'Shows cryptocurrency prices from public APIs.',
    defaultWidth: 200,
    defaultHeight: 130,
    hasApiKey: false,
    properties: {
      title: 'Crypto',
      coin: 'bitcoin',
      currency: 'usd',
      refreshInterval: 60
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:12px;color:#f7931a;">₿ BTC</div>
      <div style="font-size:18px;">$43,521</div>
      <div style="font-size:11px;color:#f85149;">-2.4%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('crypto')} ${props.coin?.toUpperCase() || 'BTC'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-price" style="position:relative;">
            <span id="${props.id}-price-text">Loading...</span>
            <span id="${props.id}-spinner" style="position:absolute;top:-2px;right:-14px;font-size:10px;opacity:0.5;display:none;">↻</span>
          </div>
          <div class="kpi-label" id="${props.id}-change">&nbsp;</div>
          <div id="${props.id}-stale" style="font-size:9px;color:#d29922;margin-top:2px;display:none;">⚠ stale</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Crypto Price Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const priceText = document.getElementById('${props.id}-price-text');
        const changeEl = document.getElementById('${props.id}-change');
        const spinner = document.getElementById('${props.id}-spinner');
        const staleEl = document.getElementById('${props.id}-stale');
        const hasData = priceText.dataset.loaded;
        if (hasData) spinner.style.display = 'inline';
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=${props.coin || 'bitcoin'}&vs_currencies=${props.currency || 'usd'}&include_24hr_change=true');
          const data = await res.json();
          const coin = data['${props.coin || 'bitcoin'}'];
          priceText.textContent = '$' + (coin['${props.currency || 'usd'}'] || 0).toLocaleString();
          priceText.dataset.loaded = '1';
          priceText.style.opacity = '1';
          staleEl.style.display = 'none';
          const change = coin['${props.currency || 'usd'}_24h_change']?.toFixed(2) || 0;
          changeEl.textContent = (change >= 0 ? '+' : '') + change + '%';
          changeEl.className = 'crypto-change ' + (change >= 0 ? 'green' : 'red');
        } catch (e) {
          if (!hasData) priceText.textContent = 'Unavailable';
          priceText.style.opacity = '0.5';
          staleEl.style.display = 'block';
        }
        spinner.style.display = 'none';
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // SMART HOME
  // ─────────────────────────────────────────────

  'indoor-climate': {
    name: 'Indoor Climate',
    icon: '🏠',
    category: 'small',
    description: 'Shows indoor temperature/humidity from smart home sensors.',
    defaultWidth: 200,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'HOME_API',
    properties: {
      title: 'Indoor',
      endpoint: '/api/home/climate',
      refreshInterval: 60
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;">72°F</div>
      <div style="font-size:11px;color:#8b949e;">💧 45%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('home')} ${props.title || 'Indoor'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-value" id="${props.id}-temp">—</div>
          <div class="kpi-label" id="${props.id}-humidity">💧 —%</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Indoor Climate Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/home/climate'}');
          const data = await res.json();
          document.getElementById('${props.id}-temp').textContent = (data.temp || 72) + '°F';
          document.getElementById('${props.id}-humidity').textContent = '💧 ' + (data.humidity || 50) + '%';
        } catch (e) {
          console.error('Climate error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'camera-feed': {
    name: 'Camera Feed',
    icon: '📷',
    category: 'large',
    description: 'Displays live camera stream from URL.',
    defaultWidth: 400,
    defaultHeight: 300,
    hasApiKey: true,
    apiKeyName: 'CAMERA_URL',
    properties: {
      title: 'Camera',
      streamUrl: 'http://your-camera/stream',
      refreshInterval: 0
    },
    preview: `<div style="background:#000;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      📷 Camera Feed
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('camera')} ${props.title || 'Camera'}</span>
        </div>
        <div class="dash-card-body camera-body">
          <img id="${props.id}-feed" src="${props.streamUrl || ''}" alt="Camera feed" style="width:100%;height:100%;object-fit:cover;">
        </div>
      </div>`,
    generateJs: (props) => `
      // Camera Feed Widget: ${props.id}
      // Set your camera stream URL in the widget properties
      // For MJPEG streams, the img src will auto-update
      // For other formats, you may need additional JS
    `
  },

  'power-usage': {
    name: 'Power Usage',
    icon: '🔌',
    category: 'small',
    description: 'Shows power consumption from smart home integration.',
    defaultWidth: 180,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'POWER_API',
    properties: {
      title: 'Power',
      endpoint: '/api/home/power',
      refreshInterval: 10
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;color:#d29922;">1.2kW</div>
      <div style="font-size:11px;color:#8b949e;">Current</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('power')} ${props.title || 'Power'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <div class="kpi-value orange" id="${props.id}-watts">—</div>
          <div class="kpi-label">Current</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Power Usage Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/home/power'}');
          const data = await res.json();
          const kw = ((data.watts || 0) / 1000).toFixed(1);
          document.getElementById('${props.id}-watts').textContent = kw + 'kW';
        } catch (e) {
          console.error('Power error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // ENTERTAINMENT
  // ─────────────────────────────────────────────

  'now-playing': {
    name: 'Now Playing',
    icon: '🎵',
    category: 'large',
    description: 'Shows currently playing music from Spotify/music service API.',
    defaultWidth: 350,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'SPOTIFY_TOKEN',
    properties: {
      title: 'Now Playing',
      endpoint: '/api/spotify/now-playing',
      refreshInterval: 10
    },
    preview: `<div style="display:flex;gap:12px;padding:8px;align-items:center;">
      <div style="width:50px;height:50px;background:#282828;border-radius:4px;"></div>
      <div style="font-size:11px;">
        <div style="color:#fff;">Song Title</div>
        <div style="color:#8b949e;">Artist Name</div>
      </div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('music')} ${props.title || 'Now Playing'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;gap:12px;">
          <div class="np-art" id="${props.id}-art"></div>
          <div class="np-info">
            <div class="np-title" id="${props.id}-title">Not Playing</div>
            <div class="np-artist" id="${props.id}-artist">—</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Now Playing Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/spotify/now-playing'}');
          const data = await res.json();
          if (data.is_playing) {
            document.getElementById('${props.id}-title').textContent = data.item?.name || 'Unknown';
            document.getElementById('${props.id}-artist').textContent = data.item?.artists?.map(a => a.name).join(', ') || '';
            if (data.item?.album?.images?.[0]?.url) {
              document.getElementById('${props.id}-art').style.backgroundImage = 'url(' + data.item.album.images[0].url + ')';
            }
          }
        } catch (e) {
          console.error('Spotify error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // MISCELLANEOUS
  // ─────────────────────────────────────────────

  'quote-of-day': {
    name: 'Quote of Day',
    icon: '💭',
    category: 'large',
    description: 'Displays daily inspirational quote from public API.',
    defaultWidth: 400,
    defaultHeight: 150,
    hasApiKey: false,
    properties: {
      title: 'Quote',
      maxLength: 0,
      refreshInterval: 3600
    },
    preview: `<div style="padding:8px;font-size:12px;font-style:italic;">
      "The only way to do great work is to love what you do."
      <div style="font-size:11px;color:#8b949e;margin-top:4px;">— Steve Jobs</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('quote')} ${props.title || 'Quote'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;justify-content:center;">
          <div class="quote-text" id="${props.id}-text" style="font-style:italic;">Loading quote...</div>
          <div class="quote-author" id="${props.id}-author" style="margin-top:8px;color:var(--text-muted);font-size:calc(11px * var(--font-scale, 1));">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Quote of Day Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const maxLen = ${props.maxLength || 0};
        const maxRetries = maxLen > 0 ? 5 : 1;
        try {
          for (let i = 0; i < maxRetries; i++) {
            const res = await fetch('/api/quote');
            const data = await res.json();
            const quote = data[0];
            if (!maxLen || quote.q.length <= maxLen) {
              document.getElementById('${props.id}-text').textContent = '\\u201c' + quote.q + '\\u201d';
              document.getElementById('${props.id}-author').textContent = '— ' + quote.a;
              return;
            }
          }
          // All retries exceeded maxLength, use last one anyway
          const res = await fetch('/api/quote');
          const data = await res.json();
          document.getElementById('${props.id}-text').textContent = '\\u201c' + data[0].q + '\\u201d';
          document.getElementById('${props.id}-author').textContent = '— ' + data[0].a;
        } catch (e) {
          document.getElementById('${props.id}-text').textContent = '\\u201cStay hungry, stay foolish.\\u201d';
          document.getElementById('${props.id}-author').textContent = '— Steve Jobs';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  },

  'countdown': {
    name: 'Countdown',
    icon: '⏳',
    category: 'small',
    description: 'Counts down days (and optionally hours/minutes) to a target date.',
    defaultWidth: 220,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Countdown',
      targetDate: '2025-12-31',
      showHours: false,
      showMinutes: false
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#8b949e;">Event Name</div>
      <div style="font-size:20px;">42 days</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('countdown')} ${props.title || 'Countdown'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-countdown">—</div>
          <div class="kpi-label" id="${props.id}-date">${props.targetDate || ''}</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Countdown Widget: ${props.id}
      function update_${props.id.replace(/-/g, '_')}() {
        const target = new Date('${props.targetDate || '2025-12-31'}T00:00:00');
        const now = new Date();
        const diff = target - now;
        const el = document.getElementById('${props.id}-countdown');
        
        if (diff <= 0) {
          el.textContent = 'Today!';
          return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        let parts = [];
        parts.push(days + 'd');
        ${props.showHours ? "parts.push(hours + 'h');" : ''}
        ${props.showMinutes ? "parts.push(minutes + 'm');" : ''}
        
        el.textContent = parts.join(' ');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${props.showMinutes ? '1000' : '60000'});
    `
  },

  'image-local': {
    name: 'Image',
    icon: '🖼️',
    category: 'large',
    description: 'Displays a local image file. Embedded as base64 for portable exports.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Image',
      imagePath: ''
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🖼️ Local Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image')} ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imagePath 
            ? `<img src="${props.imagePath}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('image')} No image path</span>`
          }
        </div>
      </div>`,
    generateJs: (props) => `
      // Local Image Widget: ${props.id}
      // Static image - no JS needed
    `
  },

  'image-random': {
    name: 'Random Image',
    icon: '🎲',
    category: 'large',
    description: 'Rotates through multiple images. Pick files to add to rotation.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Random Image',
      images: [],
      refreshInterval: 30
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🎲 Random Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image-random')} ${props.title || 'Random Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          <img id="${props.id}-img" src="" style="width:100%;height:100%;object-fit:contain;display:none;">
          <span id="${props.id}-placeholder" style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('image-random')} No images added</span>
        </div>
      </div>`,
    generateJs: (props) => {
      const images = (props.images || []).map(img => img.data);
      return `
      // Random Image Widget: ${props.id}
      (function() {
        const images = ${JSON.stringify(images)};
        
        const imgEl = document.getElementById('${props.id}-img');
        const placeholder = document.getElementById('${props.id}-placeholder');
        
        function showRandomImage() {
          if (images.length === 0) return;
          const randomIndex = Math.floor(Math.random() * images.length);
          imgEl.src = images[randomIndex];
          imgEl.style.display = 'block';
          placeholder.style.display = 'none';
        }
        
        if (images.length > 0) {
          showRandomImage();
          setInterval(showRandomImage, ${(props.refreshInterval || 30) * 1000});
        }
      })();
    `;
    }
  },

  'image-latest': {
    name: 'Latest Image',
    icon: '🆕',
    category: 'large',
    description: 'Shows the newest image from a directory. Auto-refreshes.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Latest Image',
      directoryPath: '',
      refreshInterval: 60
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🆕 Latest Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image-new')} ${props.title || 'Latest Image'}</span>
          <span id="${props.id}-filename" style="font-size:11px;color:var(--text-muted);margin-left:auto;"></span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          <img id="${props.id}-img" src="" style="width:100%;height:100%;object-fit:contain;display:none;">
          <span id="${props.id}-placeholder" style="color:var(--text-muted);font-size:12px;">${renderIcon('image-new')} ${props.directoryPath ? 'Loading...' : 'No directory set'}</span>
        </div>
      </div>`,
    generateJs: (props) => `
      // Latest Image Widget: ${props.id}
      (function() {
        const dir = ${JSON.stringify(props.directoryPath || '')};
        const imgEl = document.getElementById('${props.id}-img');
        const placeholder = document.getElementById('${props.id}-placeholder');
        const filenameEl = document.getElementById('${props.id}-filename');
        
        async function loadLatest() {
          if (!dir) return;
          try {
            const res = await fetch('/api/latest-image?dir=' + encodeURIComponent(dir));
            const data = await res.json();
            if (data.status === 'ok' && data.image) {
              imgEl.src = data.image.dataUrl;
              imgEl.style.display = 'block';
              placeholder.style.display = 'none';
              if (filenameEl) filenameEl.textContent = data.image.name;
            } else {
              placeholder.textContent = data.message || 'No images found';
            }
          } catch (e) {
            placeholder.textContent = 'Error loading image';
          }
        }
        
        loadLatest();
        setInterval(loadLatest, ${(props.refreshInterval || 60) * 1000});
      })();
    `
  },

  'image-embed': {
    name: 'Web Image',
    icon: '🌐',
    category: 'large',
    description: 'Displays an image from a web URL.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Image',
      imageUrl: ''
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🌐 Web Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('embed')} ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imageUrl 
            ? `<img src="${props.imageUrl}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('embed')} No image URL</span>`
          }
        </div>
      </div>`,
    generateJs: (props) => `
      // Web Image Widget: ${props.id}
      // Static image - no JS needed
    `
  },

  'quick-links': {
    name: 'Quick Links',
    icon: '🔗',
    category: 'large',
    description: 'Grid of clickable links with auto-fetched favicons.',
    defaultWidth: 300,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Quick Links',
      columns: 1,
      links: []
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div style="padding:4px 0;">🔗 Google</div>
      <div style="padding:4px 0;">🔗 GitHub</div>
      <div style="padding:4px 0;">🔗 Reddit</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('links')} ${props.title || 'Quick Links'}</span>
        </div>
        <div class="dash-card-body links-list" id="${props.id}-links">
          ${(props.links || []).length === 0 ? '<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">No links added</span>' : ''}
        </div>
      </div>`,
    generateJs: (props) => {
      const links = props.links || [];
      return `
      // Quick Links Widget: ${props.id}
      (function() {
        const links = ${JSON.stringify(links)};
        const container = document.getElementById('${props.id}-links');
        
        if (links.length === 0) {
          container.innerHTML = '<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">No links added</span>';
          return;
        }
        
        const cols = ${props.columns || 1};
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        container.style.gap = '4px';
        container.innerHTML = links.filter(link => _isSafeUrl(link.url)).map(link => {
          const domain = new URL(link.url).hostname;
          const favicon = 'https://www.google.com/s2/favicons?sz=32&domain=' + _esc(domain);
          return '<a href="' + _esc(link.url) + '" class="quick-link" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;padding:6px 4px;text-decoration:none;color:var(--text-primary);border-bottom:1px solid var(--border);overflow:hidden;">' +
            '<img src="' + favicon + '" style="width:16px;height:16px;flex-shrink:0;" onerror="this.style.display=\\'none\\'">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(link.name) + '</span>' +
          '</a>';
        }).join('');
      })();
    `;
    }
  },

  'iframe-embed': {
    name: 'Iframe Embed',
    icon: '🌐',
    category: 'large',
    description: 'Embeds any webpage in an iframe. Some sites may block embedding.',
    defaultWidth: 500,
    defaultHeight: 350,
    hasApiKey: false,
    properties: {
      title: 'Embed',
      embedUrl: 'https://example.com',
      allowFullscreen: true
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🌐 Embedded Content
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('embed')} ${props.title || 'Embed'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;">
          <iframe src="${_isSafeUrl(props.embedUrl) ? props.embedUrl : 'about:blank'}" style="width:100%;height:100%;border:none;" ${props.allowFullscreen ? 'allowfullscreen' : ''}></iframe>
        </div>
      </div>`,
    generateJs: (props) => `
      // Iframe Embed Widget: ${props.id}
      // Configure the embed URL in widget properties
    `
  },

  'rss-ticker': {
    name: 'RSS Ticker',
    icon: '📡',
    category: 'bar',
    description: 'Scrolling RSS feed headlines. Add any RSS feed URL.',
    defaultWidth: 1920,
    defaultHeight: 40,
    hasApiKey: false,
    properties: {
      title: 'RSS',
      feedUrl: 'https://example.com/feed.xml',
      maxItems: 10,
      refreshInterval: 600
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;overflow:hidden;">
      📡 Latest headlines scrolling by...
    </div>`,
    generateHtml: (props) => `
      <section class="news-ticker-wrap" id="widget-${props.id}">
        <span class="ticker-label lb-icon" data-icon="rss">📡</span>
        <div class="ticker-track">
          <div class="ticker-content" id="${props.id}-ticker">Loading feed...</div>
        </div>
      </section>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        var el = document.getElementById('${props.id}-ticker');
        if (!el) el = document.querySelector('.ticker-content');
        if (!el) return;
        try {
          var feedUrl = '${props.feedUrl || ''}';
          if (!feedUrl || feedUrl === 'https://example.com/feed.xml') {
            el.textContent = 'Set a Feed URL in Edit Mode (Ctrl+E)';
            return;
          }
          var res = await fetch('/api/rss?url=' + encodeURIComponent(feedUrl));
          if (!res.ok) { el.textContent = 'Feed error: ' + res.status; return; }
          var xml = await res.text();
          var parser = new DOMParser();
          var doc = parser.parseFromString(xml, 'text/xml');
          var items = Array.from(doc.querySelectorAll('item')).slice(0, ${props.maxItems || 10});
          if (!items.length) { el.textContent = 'No items found in feed'; return; }
          el.innerHTML = items.map(function(item) {
            var title = (item.querySelector('title') ? item.querySelector('title').textContent : '').replace(/</g,'&lt;');
            var link = item.querySelector('link') ? item.querySelector('link').textContent : '#';
            return '<a href="' + link + '" target="_blank" class="ticker-link">' + title + '</a>';
          }).join('<span class="ticker-sep"> \\u2022\\u2022\\u2022 </span>');
        } catch (e) {
          if (el) el.textContent = 'Failed to load feed';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  },

  'world-clock': {
    name: 'World Clock',
    icon: '🌍',
    category: 'large',
    description: 'Shows current time in multiple cities side-by-side.',
    defaultWidth: 300,
    defaultHeight: 180,
    hasApiKey: false,
    properties: {
      title: 'World Clock',
      locations: 'New York; London; Tokyo',
      format24h: false,
      refreshInterval: 60
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🕐 New York: 5:30 PM</div>
      <div>🕐 London: 10:30 PM</div>
      <div>🕐 Tokyo: 7:30 AM</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('world-clock')} ${props.title || 'World Clock'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-clocks">
          <div style="color:#8b949e;font-size:calc(12px * var(--font-scale, 1));">Loading times...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // World Clock Widget: ${props.id} (pure Intl.DateTimeFormat - no API needed)
      const CITY_TZ_MAP = {
        'New York': 'America/New_York', 'Los Angeles': 'America/Los_Angeles', 'Chicago': 'America/Chicago',
        'London': 'Europe/London', 'Paris': 'Europe/Paris', 'Berlin': 'Europe/Berlin',
        'Tokyo': 'Asia/Tokyo', 'Sydney': 'Australia/Sydney', 'Dubai': 'Asia/Dubai',
        'Singapore': 'Asia/Singapore', 'Hong Kong': 'Asia/Hong_Kong', 'Mumbai': 'Asia/Kolkata',
        'Shanghai': 'Asia/Shanghai', 'Seoul': 'Asia/Seoul', 'Moscow': 'Europe/Moscow',
        'Istanbul': 'Europe/Istanbul', 'Bangkok': 'Asia/Bangkok', 'Toronto': 'America/Toronto',
        'Heidenheim': 'Europe/Berlin', 'Vienna': 'Europe/Vienna', 'Zurich': 'Europe/Zurich',
        'Amsterdam': 'Europe/Amsterdam', 'Rome': 'Europe/Rome', 'Madrid': 'Europe/Madrid',
        'São Paulo': 'America/Sao_Paulo', 'Mexico City': 'America/Mexico_City',
        'Graz': 'Europe/Vienna', 'Munich': 'Europe/Berlin', 'Frankfurt': 'Europe/Berlin',
        'Santiago': 'America/Santiago', 'Lima': 'America/Lima'
      };
      const locs_${props.id.replace(/-/g, '_')} = '${props.locations || 'New York; London; Tokyo'}'.split(';').map(s => s.trim());
      const hour12_${props.id.replace(/-/g, '_')} = ${!props.format24h};
      
      function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-clocks');
        const now = new Date();
        const results = locs_${props.id.replace(/-/g, '_')}.map(loc => {
          const tz = CITY_TZ_MAP[loc] || CITY_TZ_MAP[Object.keys(CITY_TZ_MAP).find(k => k.toLowerCase() === loc.toLowerCase())] || null;
          if (!tz) return { city: loc, time: '(unknown tz)' };
          try {
            const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: hour12_${props.id.replace(/-/g, '_')} });
            return { city: loc, time: fmt.format(now) };
          } catch(e) { return { city: loc, time: '—' }; }
        });
        container.innerHTML = results.map(r => 
          '<div class="tz-row"><span class="tz-city">' + r.city + '</span><span class="tz-time">' + r.time + '</span></div>'
        ).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'pages-menu': {
    name: 'Pages Menu',
    icon: '📑',
    category: 'small',
    description: 'Navigation links to all discovered LobsterBoard pages. Supports vertical or horizontal layout.',
    defaultWidth: 220,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Pages',
      layout: 'vertical',
      showBorder: true,
      refreshInterval: 60
    },
    preview: `<div style="padding:6px;font-size:11px;color:#8b949e;">
      <div>📝 Notes</div>
      <div>📋 Board</div>
      <div>📅 Calendar</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('pages')} ${props.title || 'Pages'}</span>
        </div>
        <div class="dash-card-body pages-menu ${props.layout === 'horizontal' ? 'pages-menu-horizontal' : 'pages-menu-vertical'}" id="${props.id}-list">
          <span class="pages-menu-item">Loading…</span>
        </div>
      </div>
      <style>
        .pages-menu-vertical { display:flex; flex-direction:column; gap:4px; overflow-y:auto; }
        .pages-menu-horizontal { display:flex; flex-direction:row; flex-wrap:wrap; gap:6px; align-items:center; }
        .pages-menu-item {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border-radius:6px;
          background:#21262d; color:#c9d1d9;
          text-decoration:none; font-size:calc(13px * var(--font-scale, 1));
          transition: background .15s, color .15s;
        }
        .pages-menu-item:hover { background:#30363d; color:#58a6ff; }
        .pages-menu-item .pages-menu-icon { font-size:calc(15px * var(--font-scale, 1)); }
      </style>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/pages');
          const pages = await res.json();
          const list = document.getElementById('${props.id}-list');
          if (!pages.length) { list.innerHTML = '<span class="pages-menu-item">No pages found</span>'; return; }
          list.innerHTML = pages.map(p =>
            '<a class="pages-menu-item" href="/pages/' + p.id + '" title="' + (p.description || p.title || p.name || '') + '">' +
            '<span class="pages-menu-icon">' + (p.icon || '📄') + '</span>' +
            '<span>' + (p.title || p.name || p.id) + '</span></a>'
          ).join('');
        } catch (e) {
          console.error('Pages menu widget error:', e);
          document.getElementById('${props.id}-list').innerHTML = '<span class="pages-menu-item">Error loading pages</span>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'claude-usage': {
    name: 'Claude Usage',
    icon: '🤖',
    category: 'large',
    description: 'Real-time Claude Code subscription usage (5h session, 7d weekly, Opus, Sonnet limits). Reads credentials from ~/.claude.',
    defaultWidth: 380,
    defaultHeight: 260,
    hasApiKey: false,
    properties: {
      title: 'Claude Usage',
      refreshInterval: 120
    },
    preview: `<div style="padding:8px;font-size:11px;">
      <div style="margin-bottom:6px;"><b>5h Session</b> <span style="color:#3fb950;">28%</span></div>
      <div style="margin-bottom:6px;"><b>7d Weekly</b> <span style="color:#d29922;">31%</span></div>
      <div><b>Sonnet</b> <span style="color:#3fb950;">0%</span></div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('claude-usage')} ${props.title || 'Claude Usage'}</span>
          <span id="${props.id}-sub" style="font-size:calc(10px * var(--font-scale,1));color:#8b949e;margin-left:auto;"></span>
        </div>
        <div class="dash-card-body" id="${props.id}-body" style="padding:8px 12px;overflow-y:auto;">
          <div style="color:#8b949e;text-align:center;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      function barColor_${props.id.replace(/-/g, '_')}(pct) {
        if (pct >= 80) return '#f85149';
        if (pct >= 50) return '#d29922';
        return '#3fb950';
      }
      function timeLeft_${props.id.replace(/-/g, '_')}(iso) {
        if (!iso) return '';
        const ms = new Date(iso) - Date.now();
        if (ms <= 0) return 'now';
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
      }
      function usageBar_${props.id.replace(/-/g, '_')}(label, pct, resetIso) {
        const p = Math.min(100, Math.max(0, pct || 0));
        const c = barColor_${props.id.replace(/-/g, '_')}(p);
        const reset = resetIso ? '<span style="color:#8b949e;font-size:calc(10px * var(--font-scale,1));">resets ' + timeLeft_${props.id.replace(/-/g, '_')}(resetIso) + '</span>' : '';
        return '<div style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">' +
            '<span style="font-weight:600;font-size:calc(12px * var(--font-scale,1));">' + label + '</span>' +
            '<span style="font-size:calc(13px * var(--font-scale,1));font-weight:700;color:' + c + ';">' + p.toFixed(0) + '%</span>' +
          '</div>' +
          '<div style="background:#21262d;border-radius:4px;height:8px;overflow:hidden;">' +
            '<div style="width:' + p + '%;height:100%;background:' + c + ';border-radius:4px;transition:width .5s;"></div>' +
          '</div>' +
          (reset ? '<div style="text-align:right;margin-top:2px;">' + reset + '</div>' : '') +
        '</div>';
      }
      async function update_${props.id.replace(/-/g, '_')}() {
        const body = document.getElementById('${props.id}-body');
        const subEl = document.getElementById('${props.id}-sub');
        try {
          const res = await fetch('/api/pages/claude-usage/usage');
          const d = await res.json();
          if (d.error) { body.innerHTML = '<div style="color:#f85149;">' + d.error + '</div>'; return; }
          if (subEl) {
            const labels = { max: 'Max (5×)', pro: 'Pro', free: 'Free' };
            subEl.textContent = labels[d.subscription] || d.subscription || '';
          }
          let html = '';
          if (d.five_hour) html += usageBar_${props.id.replace(/-/g, '_')}('5h Session', d.five_hour.utilization, d.five_hour.resets_at);
          if (d.seven_day) html += usageBar_${props.id.replace(/-/g, '_')}('7d Weekly', d.seven_day.utilization, d.seven_day.resets_at);
          if (d.seven_day_opus) html += usageBar_${props.id.replace(/-/g, '_')}('Opus (7d)', d.seven_day_opus.utilization, d.seven_day_opus.resets_at);
          if (d.seven_day_sonnet && d.seven_day_sonnet.utilization > 0) html += usageBar_${props.id.replace(/-/g, '_')}('Sonnet (7d)', d.seven_day_sonnet.utilization, d.seven_day_sonnet.resets_at);
          if (d.extra_usage && d.extra_usage.is_enabled) {
            const used = (d.extra_usage.used_credits / 100).toFixed(2);
            const limit = d.extra_usage.monthly_limit > 0 ? (d.extra_usage.monthly_limit / 100).toFixed(2) : '∞';
            html += '<div style="margin-top:4px;padding-top:6px;border-top:1px solid #30363d;">' +
              '<div style="display:flex;justify-content:space-between;font-size:calc(11px * var(--font-scale,1));">' +
                '<span style="color:#8b949e;">Extra Usage</span>' +
                '<span style="font-weight:600;">$' + used + ' / $' + limit + '</span>' +
              '</div></div>';
          }
          if (!html) html = '<div style="color:#8b949e;">No usage data</div>';
          body.innerHTML = html;
        } catch (e) {
          console.error('Claude usage widget error:', e);
          body.innerHTML = '<div style="color:#f85149;">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 120) * 1000});
    `
  },

};

// Export for use in builder
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WIDGETS;
}

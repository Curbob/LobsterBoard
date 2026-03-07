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
    description: 'Shows current weather for a single location using wttr.in (no API key needed).',
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
      // Weather Widget: ${props.id} (uses free wttr.in API - no key needed)
      async function update_${props.id.replace(/-/g, '_')}() {
        const valEl = document.getElementById('${props.id}-value');
        const labelEl = document.getElementById('${props.id}-label');
        const iconEl = document.getElementById('${props.id}-icon');
        try {
          const location = encodeURIComponent('${props.location || 'Atlanta'}');
          const res = await fetch('https://wttr.in/' + location + '?format=j1');
          const data = await res.json();
          const current = data.current_condition[0];
          const temp = '${props.units}' === 'C' ? current.temp_C : current.temp_F;
          const unit = '${props.units}' === 'C' ? '°C' : '°F';
          valEl.textContent = temp + unit;
          labelEl.textContent = current.weatherDesc[0].value;
          // Update icon based on condition
          const code = parseInt(current.weatherCode);
          let iconId = 'weather';
          if (code === 113) iconId = 'weather-sunny';
          else if (code === 116 || code === 119) iconId = 'weather-cloudy';
          else if (code >= 176 && code <= 359) iconId = 'weather-rainy';
          else if (code >= 368 && code <= 395) iconId = 'weather-snowy';
          iconEl.setAttribute('data-icon', iconId);
          // Update emoji fallback for non-themed views
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
      // Multi Weather Widget: ${props.id} (uses free wttr.in API - no key needed)
      async function update_${props.id.replace(/-/g, '_')}() {
        const locations = '${props.locations || 'New York; London; Tokyo'}'.split(';').map(l => l.trim());
        const container = document.getElementById('${props.id}-list');
        const unit = '${props.units}' === 'C' ? 'C' : 'F';
        const unitSymbol = unit === 'C' ? '°C' : '°F';
        
        const results = await Promise.all(locations.map(async (loc) => {
          try {
            const res = await fetch('https://wttr.in/' + encodeURIComponent(loc) + '?format=j1');
            const data = await res.json();
            const current = data.current_condition[0];
            const temp = unit === 'C' ? current.temp_C : current.temp_F;
            const code = parseInt(current.weatherCode);
            let iconId = 'weather';
            if (code === 113) iconId = 'weather-sunny';
            else if (code === 116 || code === 119) iconId = 'weather-cloudy';
            else if (code >= 176 && code <= 359) iconId = 'weather-rainy';
            else if (code >= 368 && code <= 395) iconId = 'weather-snowy';
            const icons = window.WIDGET_ICONS || {};
            const emoji = icons[iconId] ? icons[iconId].emoji : '🌡️';
            return { loc, temp, iconId, emoji, desc: current.weatherDesc[0].value };
          } catch (e) {
            return { loc, temp: 'N/A', iconId: 'weather', emoji: '❓', desc: 'Error' };
          }
        }));
        
        container.innerHTML = results.map(r =>
          '<div class="weather-row"><span class="weather-icon lb-icon" data-icon="' + _esc(r.iconId) + '">' + _esc(r.emoji) + '</span><span class="weather-loc">' + _esc(r.loc) + '</span><span class="weather-temp">' + _esc(r.temp) + _esc(unitSymbol) + '</span></div>'
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
      // Auth Status Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/auth');
          const data = await res.json();
          const dot = document.getElementById('${props.id}-dot');
          const val = document.getElementById('${props.id}-value');
          if (data.status === 'ok') {
            const isMonthly = data.mode === 'Monthly';
            val.textContent = isMonthly ? 'Max' : 'API';
            dot.className = 'kpi-indicator ' + (isMonthly ? 'green' : 'yellow');
          } else {
            val.textContent = '—';
          }
        } catch (e) {
          console.error('Auth status widget error:', e);
          document.getElementById('${props.id}-value').textContent = '—';
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
        const currentEl = document.getElementById('${props.id}-current');
        const arrowEl = document.getElementById('${props.id}-arrow');
        const latestEl = document.getElementById('${props.id}-latest');
        const statusEl = document.getElementById('${props.id}-status');
        
        try {
          const res = await fetch('/api/releases');
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
    privacyWarning: true,
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
      // Activity List Widget: ${props.id} (Today style)
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/today'}');
          const data = await res.json();
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');

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
        } catch (e) { console.error('Today widget error:', e); }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'cron-jobs': {
    privacyWarning: true,
    name: 'Cron Jobs',
    icon: '⏰',
    category: 'large',
    description: 'Lists scheduled cron jobs from OpenClaw /api/cron endpoint.',
    defaultWidth: 400,
    defaultHeight: 250,
    hasApiKey: false,
    properties: {
      title: 'Cron',
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
      // Cron Jobs Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/cron'}');
          const json = await res.json();
          const jobs = json.jobs || [];
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
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
          document.getElementById('${props.id}-list').innerHTML = '<div class="cron-item"><span class="cron-name">Error loading</span></div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
    `
  },

  'system-log': {
    privacyWarning: true,
    name: 'System Log',
    icon: '🔧',
    category: 'large',
    description: 'Shows recent system logs from OpenClaw /api/system-log endpoint.',
    defaultWidth: 500,
    defaultHeight: 400,
    hasApiKey: false,
    properties: {
      title: 'System Log',
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
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/system-log'}?max=${props.maxLines || 50}');
          const json = await res.json();
          // Handle both new format (json.entries) and old format (json.lines)
          let entries = json.entries || [];
          if (!entries.length && json.lines && json.lines.length) {
            entries = json.lines.map(line => {
              let level = 'INFO';
              if (/\\b(error|fatal)\\b/i.test(line)) level = 'ERROR';
              else if (/\\bwarn/i.test(line)) level = 'WARN';
              else if (/\\b(ok|success|ready|started)\\b/i.test(line)) level = 'OK';
              return { time: new Date().toISOString(), level, category: 'system', message: line };
            });
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
    privacyWarning: true,
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
      // Session Count Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/sessions'}');
          const json = await res.json();
          const data = json.data || json;
          document.getElementById('${props.id}-count').textContent = data.active || data.length || 0;
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
    description: 'Shows CPU and memory usage. Requires system stats API.',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'System',
      endpoint: '/api/system',
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
      // CPU/Memory Widget: ${props.id} — live via SSE
      onSystemStats(function(data) {
        if (data.cpu) {
          document.getElementById('${props.id}-cpu').textContent = data.cpu.currentLoad.toFixed(0) + '%';
        }
        if (data.memory) {
          const used = (data.memory.active / (1024*1024*1024)).toFixed(1);
          const total = (data.memory.total / (1024*1024*1024)).toFixed(1);
          document.getElementById('${props.id}-mem').textContent = used + ' / ' + total + ' GB';
        }
      });
    `
  },

  'disk-usage': {
    name: 'Disk Usage',
    icon: '💾',
    category: 'small',
    description: 'Shows disk space usage. Requires system stats API.',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Disk',
      path: '/',
      endpoint: '/api/disk',
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
      // Disk Usage Widget: ${props.id} — live via SSE
      onSystemStats(function(data) {
        if (!data.disk || data.disk.length === 0) return;
        // Find the configured mount or default to first/root
        const targetMount = '${props.path || '/'}';
        const d = data.disk.find(x => x.mount === targetMount) || data.disk[0];
        const pct = d.use || 0;
        const circumference = 125.66;
        document.getElementById('${props.id}-ring').style.strokeDashoffset = circumference - (pct / 100) * circumference;
        document.getElementById('${props.id}-pct').textContent = Math.round(pct) + '%';
        const usedGB = (d.used / (1024*1024*1024)).toFixed(1);
        const totalGB = (d.size / (1024*1024*1024)).toFixed(0);
        document.getElementById('${props.id}-size').textContent = usedGB + ' / ' + totalGB + ' GB';
      });
    `
  },

  'uptime-monitor': {
    name: 'Uptime Monitor',
    icon: '📡',
    category: 'large',
    description: 'Shows service uptime. Requires uptime monitoring backend.',
    defaultWidth: 350,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Uptime',
      services: 'Website,API,Database',
      refreshInterval: 30
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🟢 Website — 99.9%</div>
      <div>🟢 API — 100%</div>
      <div>🟡 Database — 98.2%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('uptime')} ${props.title || 'Uptime'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-services">
          <div class="uptime-row" style="color:var(--text-muted);justify-content:center;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Uptime Monitor Widget: ${props.id} — live via SSE
      onSystemStats(function(data) {
        if (data.uptime == null) return;
        const container = document.getElementById('${props.id}-services');
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
        container.innerHTML = html;
      });
    `
  },

  'docker-containers': {
    name: 'Docker Containers',
    icon: '🐳',
    category: 'large',
    description: 'Lists Docker containers with status. Requires Docker API proxy.',
    defaultWidth: 380,
    defaultHeight: 250,
    hasApiKey: false,
    properties: {
      title: 'Containers',
      endpoint: '/api/docker',
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
      // Docker Containers Widget: ${props.id} — live via SSE
      onSystemStats(function(data) {
        const list = document.getElementById('${props.id}-list');
        const badge = document.getElementById('${props.id}-badge');
        if (!data.docker || data.docker.length === 0) {
          list.innerHTML = '<div class="docker-row" style="color:var(--text-muted);">No containers found</div>';
          badge.textContent = '0';
          return;
        }
        const containers = data.docker;
        list.innerHTML = containers.map(function(c) {
          const icon = c.state === 'running' ? '🟢' : '🔴';
          const name = (c.name || '').replace(/^\\//, '');
          return '<div class="docker-row">' + icon + ' ' + name + '<span class="docker-status">' + (c.state || c.status || '—') + '</span></div>';
        }).join('');
        badge.textContent = containers.length;
      });
    `
  },

  'network-speed': {
    name: 'Network Speed',
    icon: '🌐',
    category: 'small',
    description: 'Shows real-time network activity (upload/download throughput). Updates every 2 seconds.',
    defaultWidth: 200,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Network',
      endpoint: '/api/network',
      refreshInterval: 2
    },
    preview: `<div style="padding:8px;font-size:11px;">
      <div>↓ <span style="color:#3fb950;">45 Mbps</span></div>
      <div>↑ <span style="color:#58a6ff;">12 Mbps</span></div>
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
      // Network Speed Widget: ${props.id} — live via SSE
      function _fmtRate(bytes) {
        if (bytes == null || bytes < 0) return '0 B/s';
        if (bytes < 1024) return bytes.toFixed(0) + ' B/s';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
      }
      onSystemStats(function(data) {
        if (!data.network || data.network.length === 0) return;
        // Sum all interfaces or pick the first non-loopback
        let rx = 0, tx = 0;
        data.network.forEach(function(n) {
          if (n.iface !== 'lo' && n.iface !== 'lo0') {
            rx += (n.rx_sec || 0);
            tx += (n.tx_sec || 0);
          }
        });
        document.getElementById('${props.id}-down').textContent = _fmtRate(rx);
        document.getElementById('${props.id}-up').textContent = _fmtRate(tx);
      });
    `
  },

  // ─────────────────────────────────────────────
  // PRODUCTIVITY
  // ─────────────────────────────────────────────

  'todo-list': {
    privacyWarning: true,
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
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 120) * 1000});
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
      // World Clock Widget: ${props.id} (uses wttr.in for timezone data)
      const locs_${props.id.replace(/-/g, '_')} = '${props.locations || 'New York; London; Tokyo'}'.split(';').map(s => s.trim());
      const hour12_${props.id.replace(/-/g, '_')} = ${!props.format24h};
      
      async function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-clocks');
        const results = await Promise.all(locs_${props.id.replace(/-/g, '_')}.map(async (loc) => {
          try {
            const res = await fetch('https://wttr.in/' + encodeURIComponent(loc) + '?format=j1');
            const data = await res.json();
            const area = data.nearest_area[0];
            const city = area.areaName[0].value;
            const localTime = data.current_condition[0].localObsDateTime;
            // Parse the time from format "2026-02-07 12:30 AM"
            const timePart = localTime.split(' ').slice(1).join(' ');
            let displayTime = timePart;
            if (!hour12_${props.id.replace(/-/g, '_')}) {
              // Convert to 24h if needed
              const d = new Date('2000-01-01 ' + timePart);
              displayTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
            return { city, time: displayTime, ok: true };
          } catch (e) {
            return { city: loc, time: '—', ok: false };
          }
        }));
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

};

// Export for use in builder
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WIDGETS;
}

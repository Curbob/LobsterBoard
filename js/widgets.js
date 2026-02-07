/**
 * OpenClaw Dashboard Builder - Widget Definitions
 * Each widget defines its default size, properties, and generated code
 */

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
          <span class="dash-card-title">🌡️ ${props.title || 'Local Weather'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span id="${props.id}-icon" style="font-size:24px;">🌡️</span>
          <div>
            <div class="kpi-value blue" id="${props.id}-value">—</div>
            <div class="kpi-label" id="${props.id}-label">${props.location || 'Location'}</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Weather Widget: ${props.id} (uses free wttr.in API - no key needed)
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const location = encodeURIComponent('${props.location || 'Atlanta'}');
          const res = await fetch('https://wttr.in/' + location + '?format=j1');
          const data = await res.json();
          const current = data.current_condition[0];
          const temp = '${props.units}' === 'C' ? current.temp_C : current.temp_F;
          const unit = '${props.units}' === 'C' ? '°C' : '°F';
          document.getElementById('${props.id}-value').textContent = temp + unit;
          document.getElementById('${props.id}-label').textContent = current.weatherDesc[0].value;
          // Update icon based on condition
          const code = parseInt(current.weatherCode);
          let icon = '🌡️';
          if (code === 113) icon = '☀️';
          else if (code === 116 || code === 119) icon = '⛅';
          else if (code >= 176 && code <= 359) icon = '🌧️';
          else if (code >= 368 && code <= 395) icon = '❄️';
          document.getElementById('${props.id}-icon').textContent = icon;
        } catch (e) {
          console.error('Weather error:', e);
          document.getElementById('${props.id}-value').textContent = 'N/A';
        }
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
          <span class="dash-card-title">🌍 ${props.title || 'World Weather'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list">
          <div class="weather-row"><span class="weather-icon">☀️</span><span class="weather-loc">New York</span><span class="weather-temp">72°F</span></div>
          <div class="weather-row"><span class="weather-icon">⛅</span><span class="weather-loc">London</span><span class="weather-temp">58°F</span></div>
          <div class="weather-row"><span class="weather-icon">🌧️</span><span class="weather-loc">Tokyo</span><span class="weather-temp">65°F</span></div>
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
            let icon = '🌡️';
            if (code === 113) icon = '☀️';
            else if (code === 116 || code === 119) icon = '⛅';
            else if (code >= 176 && code <= 359) icon = '🌧️';
            else if (code >= 368 && code <= 395) icon = '❄️';
            return { loc, temp, icon, desc: current.weatherDesc[0].value };
          } catch (e) {
            return { loc, temp: 'N/A', icon: '❓', desc: 'Error' };
          }
        }));
        
        container.innerHTML = results.map(r => 
          '<div class="weather-row"><span class="weather-icon">' + r.icon + '</span><span class="weather-loc">' + r.loc + '</span><span class="weather-temp">' + r.temp + unitSymbol + '</span></div>'
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
          <span class="dash-card-title">🔐 ${props.title || 'Auth Type'}</span>
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
          const res = await fetch('${props.endpoint || '/api/status'}');
          const data = await res.json();
          const dot = document.getElementById('${props.id}-dot');
          const val = document.getElementById('${props.id}-value');
          val.textContent = data.authMode === 'oauth' ? 'Subscription' : 'API';
          dot.className = 'kpi-indicator ' + (data.authMode === 'oauth' ? 'green' : 'yellow');
        } catch (e) {
          document.getElementById('${props.id}-value').textContent = 'Error';
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
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
          <span class="dash-card-title">🦞 ${props.title || 'OpenClaw'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-version" style="font-size:16px;">—</div>
          <div class="kpi-label" id="${props.id}-status">Checking...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // OpenClaw Release Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const versionEl = document.getElementById('${props.id}-version');
        const statusEl = document.getElementById('${props.id}-status');
        const baseUrl = '${props.openclawUrl || ''}'.replace(/\\/$/, '');
        
        try {
          // Get current running version from OpenClaw API
          const statusRes = await fetch(baseUrl + '/api/status');
          const statusData = await statusRes.json();
          const currentVersion = (statusData.version || '').replace(/^v/, '');
          
          // Get latest release from GitHub
          const ghRes = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest');
          const ghData = await ghRes.json();
          const latestVersion = (ghData.tag_name || '').replace(/^v/, '');
          
          if (!currentVersion) {
            versionEl.textContent = 'v' + latestVersion;
            statusEl.textContent = 'Latest release';
          } else if (currentVersion === latestVersion) {
            versionEl.textContent = 'v' + currentVersion;
            versionEl.style.color = 'var(--accent-green)';
            statusEl.innerHTML = '✓ Up to date';
            statusEl.style.color = 'var(--accent-green)';
          } else {
            versionEl.textContent = 'v' + latestVersion + ' available';
            versionEl.style.color = 'var(--accent-blue)';
            statusEl.innerHTML = '⬆ Running v' + currentVersion;
            statusEl.style.color = 'var(--accent-blue)';
          }
        } catch (e) {
          versionEl.textContent = '—';
          statusEl.innerHTML = '<span style="font-size:10px;">CORS error - serve from same origin</span>';
          console.error('OpenClaw Release widget: CORS error. Serve dashboard from OpenClaw or configure CORS.', e);
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
          <span class="dash-card-title">📦 ${props.title || 'Release'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-version" style="font-size:16px;">—</div>
          <div class="kpi-label" id="${props.id}-status">Checking...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Release Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const currentVersion = '${props.currentVersion || ''}'.replace(/^v/, '');
        const versionEl = document.getElementById('${props.id}-version');
        const statusEl = document.getElementById('${props.id}-status');
        
        try {
          const res = await fetch('https://api.github.com/repos/${props.repo || 'openclaw/openclaw'}/releases/latest');
          const data = await res.json();
          const latestVersion = (data.tag_name || '').replace(/^v/, '');
          
          if (!currentVersion) {
            versionEl.textContent = 'v' + latestVersion;
            statusEl.textContent = 'Latest release';
            versionEl.style.color = 'var(--text-primary)';
          } else if (currentVersion === latestVersion) {
            versionEl.textContent = 'v' + latestVersion;
            versionEl.style.color = 'var(--accent-green)';
            statusEl.innerHTML = '✓ Up to date';
            statusEl.style.color = 'var(--accent-green)';
          } else {
            versionEl.textContent = 'v' + latestVersion;
            versionEl.style.color = 'var(--accent-blue)';
            statusEl.innerHTML = '⬆ Update available (v' + currentVersion + ')';
            statusEl.style.color = 'var(--accent-blue)';
          }
        } catch (e) {
          versionEl.textContent = 'Error';
          statusEl.textContent = 'Failed to check';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  },

  'clock': {
    name: 'Clock',
    icon: '🕐',
    description: 'Simple digital clock. Supports 12h or 24h format.',
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
          <span class="dash-card-title">🕐 ${props.title || 'Clock'}</span>
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
      endpoint: '/api/activity',
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
          <span class="dash-card-title">📋 ${props.title || 'Today'}</span>
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
      // Activity List Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/activity'}');
          const data = await res.json();
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
          list.innerHTML = data.items.slice(0, ${props.maxItems || 10}).map(item => 
            '<div class="list-item">' + item.text + '</div>'
          ).join('');
          badge.textContent = data.items.length + ' items';
        } catch (e) {
          document.getElementById('${props.id}-list').innerHTML = '<div class="error">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  },

  'cron-jobs': {
    name: 'Cron Jobs',
    icon: '⏰',
    category: 'large',
    description: 'Lists scheduled cron jobs from OpenClaw /api/cron endpoint.',
    defaultWidth: 400,
    defaultHeight: 250,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Cron',
      endpoint: '/api/cron',
      refreshInterval: 30
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      <div>⏰ Daily backup - 2am</div>
      <div>⏰ Sync data - */5 *</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">⏰ ${props.title || 'Cron'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list">
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
          const data = await res.json();
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
          list.innerHTML = data.jobs.map(job => 
            '<div class="cron-item"><span class="cron-name">' + job.name + '</span><span class="cron-next">' + job.next + '</span></div>'
          ).join('');
          badge.textContent = data.jobs.length + ' jobs';
        } catch (e) {
          document.getElementById('${props.id}-list').innerHTML = '<div class="error">Failed to load</div>';
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
    description: 'Shows recent system logs from OpenClaw /api/logs endpoint.',
    defaultWidth: 500,
    defaultHeight: 400,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'System Log',
      endpoint: '/api/logs',
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
          <span class="dash-card-title">🔧 ${props.title || 'System Log'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list syslog-scroll" id="${props.id}-log">
          <div class="log-line">[INFO] System started successfully</div>
          <div class="log-line">[DEBUG] Loading configuration...</div>
          <div class="log-line">[INFO] Connected to database</div>
          <div class="log-line">[INFO] API server ready on :8080</div>
          <div class="log-line">[DEBUG] Health check passed</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // System Log Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/logs'}');
          const data = await res.json();
          const log = document.getElementById('${props.id}-log');
          const badge = document.getElementById('${props.id}-badge');
          log.innerHTML = data.lines.slice(-${props.maxLines || 50}).map(line => 
            '<div class="log-line">' + line + '</div>'
          ).join('');
          badge.textContent = data.lines.length + ' lines';
          log.scrollTop = log.scrollHeight;
        } catch (e) {
          document.getElementById('${props.id}-log').innerHTML = '<div class="error">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  },

  'calendar': {
    name: 'Calendar',
    icon: '📅',
    category: 'large',
    description: 'Displays upcoming calendar events. Requires calendar API endpoint.',
    defaultWidth: 400,
    defaultHeight: 300,
    hasApiKey: true,
    apiKeyName: 'CALENDAR_API_KEY',
    properties: {
      title: 'Calendar',
      calendarId: 'primary',
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
          <span class="dash-card-title">📅 ${props.title || 'Calendar'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-events">
          <div class="event-item">📅 Team standup — 10:00 AM</div>
          <div class="event-item">📅 1:1 with manager — 2:00 PM</div>
          <div class="event-item">📅 Sprint review — 4:00 PM</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Calendar Widget: ${props.id}
      // Requires Google Calendar API setup
      async function update_${props.id.replace(/-/g, '_')}() {
        // Replace with your calendar API integration
        document.getElementById('${props.id}-events').innerHTML = 
          '<div class="event-item">Configure your calendar API</div>';
      }
      update_${props.id.replace(/-/g, '_')}();
    `
  },

  'notes': {
    name: 'Notes',
    icon: '📝',
    category: 'large',
    description: 'Simple note-taking widget. Requires storage backend.',
    defaultWidth: 350,
    defaultHeight: 250,
    hasApiKey: false,
    properties: {
      title: 'Notes',
      content: 'Your notes here...'
    },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;">
      Your notes here...
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">📝 ${props.title || 'Notes'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-content" contenteditable="true" style="white-space:pre-wrap;">
          ${props.content || 'Your notes here...'}
        </div>
      </div>`,
    generateJs: (props) => `
      // Notes Widget: ${props.id}
      // Notes are editable directly in the dashboard
    `
  },

  // ─────────────────────────────────────────────
  // BARS
  // ─────────────────────────────────────────────

  'topbar': {
    name: 'Top Nav Bar',
    icon: '🔝',
    category: 'bar',
    description: 'Navigation bar with clock, weather, and system stats.',
    defaultWidth: 1920,
    defaultHeight: 48,
    hasApiKey: false,
    properties: {
      title: 'OpenClaw',
      links: 'Dashboard,Activity,Settings'
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;display:flex;gap:12px;">
      <span>🤖 OpenClaw</span>
      <span style="color:#58a6ff;">Dashboard</span>
      <span style="color:#8b949e;">Activity</span>
    </div>`,
    generateHtml: (props) => `
      <nav class="topbar" id="widget-${props.id}">
        <div class="topbar-left">
          <span class="topbar-brand">🤖 ${props.title || 'OpenClaw'}</span>
          ${(props.links || 'Dashboard').split(',').map((link, i) => 
            `<a href="#" class="topbar-link${i === 0 ? ' active' : ''}">${link.trim()}</a>`
          ).join('')}
        </div>
        <div class="topbar-right">
          <span class="topbar-meta" id="${props.id}-refresh">—</span>
          <button class="topbar-refresh" onclick="location.reload()" title="Refresh">↻</button>
        </div>
      </nav>`,
    generateJs: (props) => `
      // Top Bar Widget: ${props.id}
      // Updates last refresh timestamp
      document.getElementById('${props.id}-refresh').textContent = 
        new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    `
  },

  'news-ticker': {
    name: 'News Ticker',
    icon: '📰',
    category: 'bar',
    description: 'Scrolling news headlines. Requires NewsAPI key.',
    defaultWidth: 1920,
    defaultHeight: 40,
    hasApiKey: true,
    apiKeyName: 'NEWS_API_KEY',
    properties: {
      title: 'News',
      category: 'technology',
      refreshInterval: 1800
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;overflow:hidden;">
      📰 Breaking: Tech news headline scrolling by...
    </div>`,
    generateHtml: (props) => `
      <section class="news-ticker-wrap" id="widget-${props.id}">
        <span class="ticker-label">📰</span>
        <div class="ticker-track">
          <div class="ticker-content" id="${props.id}-ticker">Loading news...</div>
        </div>
      </section>`,
    generateJs: (props) => `
      // News Ticker Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          // Replace with your news API
          const apiKey = 'YOUR_NEWS_API_KEY';
          const res = await fetch(\`https://newsapi.org/v2/top-headlines?category=${props.category || 'technology'}&apiKey=\${apiKey}\`);
          const data = await res.json();
          const headlines = data.articles.map(a => a.title).join(' ••• ');
          document.getElementById('${props.id}-ticker').textContent = headlines;
        } catch (e) {
          document.getElementById('${props.id}-ticker').textContent = 'Failed to load news';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 1800) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // AI / LLM MONITORING
  // ─────────────────────────────────────────────

  'ai-usage-claude': {
    name: 'Claude Usage',
    icon: '🟣',
    category: 'small',
    description: 'Shows Anthropic Claude API usage stats. Requires usage API proxy.',
    defaultWidth: 220,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'ANTHROPIC_API_KEY',
    properties: {
      title: 'Claude',
      refreshInterval: 300
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#a371f7;">Claude</div>
      <div style="font-size:20px;">125K</div>
      <div style="font-size:10px;color:#8b949e;">tokens today</div>
    </div>`,
    generateHtml: (props) => `
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;text-align:center;">
        <div style="color:#a371f7;font-size:12px;font-weight:600;">🟣 Claude</div>
        <div class="kpi-value" id="${props.id}-tokens">—</div>
        <div class="kpi-label" id="${props.id}-cost">tokens today</div>
      </div>`,
    generateJs: (props) => `
      // Claude Usage Widget: ${props.id}
      // Requires a backend proxy - Anthropic API doesn't support browser CORS
      // Set up a proxy endpoint that calls: https://api.anthropic.com/v1/usage
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          // Option 1: If using OpenClaw, it tracks usage locally
          // Option 2: Set up your own proxy endpoint
          const res = await fetch('/api/usage/claude');
          const data = await res.json();
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

  'ai-usage-openai': {
    name: 'GPT Usage',
    icon: '🟢',
    category: 'small',
    description: 'Shows OpenAI GPT API usage stats. Requires usage API proxy.',
    defaultWidth: 220,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'OPENAI_API_KEY',
    properties: {
      title: 'GPT',
      refreshInterval: 300
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#3fb950;">GPT-4</div>
      <div style="font-size:20px;">89K</div>
      <div style="font-size:10px;color:#8b949e;">tokens today</div>
    </div>`,
    generateHtml: (props) => `
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;text-align:center;">
        <div style="color:#3fb950;font-size:12px;font-weight:600;">🟢 GPT</div>
        <div class="kpi-value" id="${props.id}-tokens">—</div>
        <div class="kpi-label" id="${props.id}-cost">tokens today</div>
      </div>`,
    generateJs: (props) => `
      // GPT Usage Widget: ${props.id}
      // Requires a backend proxy - OpenAI API doesn't support browser CORS
      // Set up a proxy endpoint that calls: https://api.openai.com/v1/usage
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/usage/openai');
          const data = await res.json();
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;text-align:center;">
        <div style="color:#58a6ff;font-size:12px;font-weight:600;">🔵 Gemini</div>
        <div class="kpi-value" id="${props.id}-tokens">—</div>
        <div class="kpi-label" id="${props.id}-cost">tokens today</div>
      </div>`,
    generateJs: (props) => `
      // Gemini Usage Widget: ${props.id}
      // Requires a backend proxy - Google API doesn't support browser CORS
      // Set up a proxy endpoint for your usage data
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/usage/gemini');
          const data = await res.json();
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
            const data = await res.json();
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">💰</div>
        <div class="kpi-data">
          <div class="kpi-value green" id="${props.id}-cost">—</div>
          <div class="kpi-label">${props.period || 'Today'}</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // AI Cost Tracker Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/costs'}?period=${props.period || 'today'}');
          const data = await res.json();
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
          <span class="dash-card-title">🔄 ${props.title || 'API Status'}</span>
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">💬</div>
        <div class="kpi-data">
          <div class="kpi-value blue" id="${props.id}-count">—</div>
          <div class="kpi-label">Active</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Session Count Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/sessions'}');
          const data = await res.json();
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;text-align:center;">
        <div class="kpi-value" id="${props.id}-value">—</div>
        <div class="gauge-bar"><div class="gauge-fill" id="${props.id}-fill"></div></div>
        <div class="kpi-label">of ${((props.maxTokens || 1000000) / 1000000).toFixed(1)}M limit</div>
      </div>`,
    generateJs: (props) => `
      // Token Gauge Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/usage/tokens'}');
          const data = await res.json();
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;">
        <div class="sys-row"><span>CPU</span><span class="blue" id="${props.id}-cpu">—</span></div>
        <div class="sys-row"><span>MEM</span><span class="green" id="${props.id}-mem">—</span></div>
      </div>`,
    generateJs: (props) => `
      // CPU/Memory Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/system'}');
          const data = await res.json();
          document.getElementById('${props.id}-cpu').textContent = (data.cpu || 0) + '%';
          document.getElementById('${props.id}-mem').textContent = (data.memory || 0).toFixed(1) + 'GB';
        } catch (e) {
          console.error('System stats error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 5) * 1000});
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
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
      </div>`,
    generateJs: (props) => `
      // Disk Usage Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/disk'}');
          const data = await res.json();
          const pct = data.percent || 0;
          const circumference = 125.66;
          document.getElementById('${props.id}-ring').style.strokeDashoffset = circumference - (pct / 100) * circumference;
          document.getElementById('${props.id}-pct').textContent = pct + '%';
          document.getElementById('${props.id}-size').textContent = (data.used || 0) + 'GB';
        } catch (e) {
          console.error('Disk error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
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
          <span class="dash-card-title">📡 ${props.title || 'Uptime'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-services">
          <div class="uptime-row"><span>🟢 Website</span><span class="uptime-pct">99.9%</span></div>
          <div class="uptime-row"><span>🟢 API</span><span class="uptime-pct">100%</span></div>
          <div class="uptime-row"><span>🟡 Database</span><span class="uptime-pct">98.5%</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Uptime Monitor Widget: ${props.id}
      // Configure your uptime check endpoints
      const services_${props.id.replace(/-/g, '_')} = '${props.services || 'Service'}'.split(',').map(s => s.trim());
      function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-services');
        container.innerHTML = services_${props.id.replace(/-/g, '_')}.map(svc => 
          '<div class="uptime-row"><span>🟢 ' + svc + '</span><span class="uptime-pct">—%</span></div>'
        ).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
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
          <span class="dash-card-title">🐳 ${props.title || 'Containers'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list" id="${props.id}-list">
          <div class="docker-row">🟢 nginx <span class="docker-status">Up 3 days</span></div>
          <div class="docker-row">🟢 postgres <span class="docker-status">Up 3 days</span></div>
          <div class="docker-row">🟢 redis <span class="docker-status">Up 3 days</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Docker Containers Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/docker'}');
          const data = await res.json();
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
          list.innerHTML = (data.containers || []).map(c => {
            const icon = c.status === 'running' ? '🟢' : '🔴';
            return '<div class="docker-row">' + icon + ' ' + c.name + '<span class="docker-status">' + c.status + '</span></div>';
          }).join('');
          badge.textContent = (data.containers || []).length + ' containers';
        } catch (e) {
          document.getElementById('${props.id}-list').innerHTML = '<div class="error">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  },

  'network-speed': {
    name: 'Network Speed',
    icon: '🌐',
    category: 'small',
    description: 'Shows network upload/download speeds. Requires system stats API.',
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;">
        <div class="net-row">↓ <span class="green" id="${props.id}-down">—</span></div>
        <div class="net-row">↑ <span class="blue" id="${props.id}-up">—</span></div>
      </div>`,
    generateJs: (props) => `
      // Network Speed Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/network'}');
          const data = await res.json();
          document.getElementById('${props.id}-down').textContent = (data.download || 0) + ' Mbps';
          document.getElementById('${props.id}-up').textContent = (data.upload || 0) + ' Mbps';
        } catch (e) {
          console.error('Network error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 2) * 1000});
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
      title: 'Todo',
      items: 'Task 1,Task 2,Task 3'
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>☑️ Complete project</div>
      <div>⬜ Review PR</div>
      <div>⬜ Send email</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">✅ ${props.title || 'Todo'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list">
        </div>
      </div>`,
    generateJs: (props) => `
      // Todo List Widget: ${props.id}
      const items_${props.id.replace(/-/g, '_')} = '${props.items || 'Add tasks'}'.split(',');
      function render_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-list');
        container.innerHTML = items_${props.id.replace(/-/g, '_')}.map((item, i) => 
          '<div class="todo-item"><input type="checkbox" id="${props.id}-' + i + '"><label for="${props.id}-' + i + '">' + item.trim() + '</label></div>'
        ).join('');
      }
      render_${props.id.replace(/-/g, '_')}();
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">📧</div>
        <div class="kpi-data">
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
          <span class="dash-card-title">🎯 ${props.title || 'Focus'}</span>
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
    hasApiKey: true,
    apiKeyName: 'GITHUB_TOKEN',
    properties: {
      title: 'GitHub',
      username: 'your-username',
      refreshInterval: 300
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>⭐ 142 stars</div>
      <div>🔀 23 PRs this month</div>
      <div>📦 8 repos</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🐙 ${props.title || 'GitHub'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-stats">
          <div class="gh-stat">📦 42 repos</div>
          <div class="gh-stat">👥 128 followers</div>
          <div class="gh-stat">⭐ 1.2K stars</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // GitHub Stats Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('https://api.github.com/users/${props.username || 'octocat'}');
          const data = await res.json();
          document.getElementById('${props.id}-stats').innerHTML = 
            '<div class="gh-stat">📦 ' + data.public_repos + ' repos</div>' +
            '<div class="gh-stat">👥 ' + data.followers + ' followers</div>' +
            '<div class="gh-stat">🔗 ' + data.following + ' following</div>';
        } catch (e) {
          document.getElementById('${props.id}-stats').innerHTML = '<div class="error">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // FINANCE
  // ─────────────────────────────────────────────

  'stock-ticker': {
    name: 'Stock Ticker',
    icon: '📈',
    category: 'small',
    description: 'Shows stock prices. Requires Finnhub or similar API key.',
    defaultWidth: 200,
    defaultHeight: 130,
    hasApiKey: true,
    apiKeyName: 'STOCK_API_KEY',
    properties: {
      title: 'Stock',
      symbol: 'AAPL',
      refreshInterval: 60
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:12px;color:#8b949e;">AAPL</div>
      <div style="font-size:20px;">$185.42</div>
      <div style="font-size:11px;color:#3fb950;">+1.2%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">📈 ${props.symbol || 'AAPL'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-price">—</div>
          <div class="kpi-label" id="${props.id}-change">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Stock Ticker Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        // Replace with your stock API (Alpha Vantage, Finnhub, etc.)
        try {
          const apiKey = 'YOUR_STOCK_API_KEY';
          const res = await fetch('https://finnhub.io/api/v1/quote?symbol=${props.symbol || 'AAPL'}&token=' + apiKey);
          const data = await res.json();
          document.getElementById('${props.id}-price').textContent = '$' + (data.c || 0).toFixed(2);
          const change = ((data.c - data.pc) / data.pc * 100).toFixed(2);
          const changeEl = document.getElementById('${props.id}-change');
          changeEl.textContent = (change >= 0 ? '+' : '') + change + '%';
          changeEl.className = 'stock-change ' + (change >= 0 ? 'green' : 'red');
        } catch (e) {
          document.getElementById('${props.id}-price').textContent = '—';
        }
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
      refreshInterval: 30
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:12px;color:#f7931a;">₿ BTC</div>
      <div style="font-size:18px;">$43,521</div>
      <div style="font-size:11px;color:#f85149;">-2.4%</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">₿ ${props.coin?.toUpperCase() || 'BTC'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value" id="${props.id}-price">—</div>
          <div class="kpi-label" id="${props.id}-change">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Crypto Price Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=${props.coin || 'bitcoin'}&vs_currencies=${props.currency || 'usd'}&include_24hr_change=true');
          const data = await res.json();
          const coin = data['${props.coin || 'bitcoin'}'];
          document.getElementById('${props.id}-price').textContent = '$' + (coin.${props.currency || 'usd'} || 0).toLocaleString();
          const change = coin.${props.currency || 'usd'}_24h_change?.toFixed(2) || 0;
          const changeEl = document.getElementById('${props.id}-change');
          changeEl.textContent = (change >= 0 ? '+' : '') + change + '%';
          changeEl.className = 'crypto-change ' + (change >= 0 ? 'green' : 'red');
        } catch (e) {
          document.getElementById('${props.id}-price').textContent = '—';
        }
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">🏠</div>
        <div class="kpi-data">
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
          <span class="dash-card-title">📷 ${props.title || 'Camera'}</span>
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">🔌</div>
        <div class="kpi-data">
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
      <div class="now-playing-card" id="widget-${props.id}">
        <div class="np-art" id="${props.id}-art"></div>
        <div class="np-info">
          <div class="np-title" id="${props.id}-title">Not Playing</div>
          <div class="np-artist" id="${props.id}-artist">—</div>
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
      category: 'inspire',
      refreshInterval: 3600
    },
    preview: `<div style="padding:8px;font-size:12px;font-style:italic;">
      "The only way to do great work is to love what you do."
      <div style="font-size:11px;color:#8b949e;margin-top:4px;">— Steve Jobs</div>
    </div>`,
    generateHtml: (props) => `
      <div class="quote-card" id="widget-${props.id}">
        <div class="quote-text" id="${props.id}-text">Loading quote...</div>
        <div class="quote-author" id="${props.id}-author">—</div>
      </div>`,
    generateJs: (props) => `
      // Quote of Day Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('https://api.quotable.io/random');
          const data = await res.json();
          document.getElementById('${props.id}-text').textContent = '"' + data.content + '"';
          document.getElementById('${props.id}-author').textContent = '— ' + data.author;
        } catch (e) {
          document.getElementById('${props.id}-text').textContent = '"Stay hungry, stay foolish."';
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
          <span class="dash-card-title">⏳ ${props.title || 'Countdown'}</span>
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
          <span class="dash-card-title">🖼️ ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imagePath 
            ? `<img src="${props.imagePath}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:12px;">🖼️ No image path</span>`
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
          <span class="dash-card-title">🎲 ${props.title || 'Random Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          <img id="${props.id}-img" src="" style="width:100%;height:100%;object-fit:contain;display:none;">
          <span id="${props.id}-placeholder" style="color:var(--text-muted);font-size:12px;">🎲 No images added</span>
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
          <span class="dash-card-title">🌐 ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imageUrl 
            ? `<img src="${props.imageUrl}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:12px;">🌐 No image URL</span>`
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
          <span class="dash-card-title">🔗 ${props.title || 'Quick Links'}</span>
        </div>
        <div class="dash-card-body links-list" id="${props.id}-links">
          ${(props.links || []).length === 0 ? '<span style="color:var(--text-muted);font-size:12px;">No links added</span>' : ''}
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
          container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No links added</span>';
          return;
        }
        
        container.innerHTML = links.map(link => {
          const domain = new URL(link.url).hostname;
          const favicon = 'https://www.google.com/s2/favicons?sz=32&domain=' + domain;
          return '<a href="' + link.url + '" class="quick-link" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 0;text-decoration:none;color:var(--text-primary);border-bottom:1px solid var(--border);">' +
            '<img src="' + favicon + '" style="width:16px;height:16px;" onerror="this.style.display=\\'none\\'">' +
            '<span>' + link.name + '</span>' +
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
          <span class="dash-card-title">🌐 ${props.title || 'Embed'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;">
          <iframe src="${props.embedUrl || 'about:blank'}" style="width:100%;height:100%;border:none;" ${props.allowFullscreen ? 'allowfullscreen' : ''}></iframe>
        </div>
      </div>`,
    generateJs: (props) => `
      // Iframe Embed Widget: ${props.id}
      // Configure the embed URL in widget properties
    `
  },

  'rss-ticker': {
    name: 'RSS Ticker',
    icon: '📜',
    category: 'bar',
    description: 'Scrolling RSS feed headlines. May need CORS proxy.',
    defaultWidth: 1920,
    defaultHeight: 40,
    hasApiKey: false,
    properties: {
      title: 'RSS',
      feedUrl: 'https://example.com/feed.xml',
      refreshInterval: 600
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;overflow:hidden;">
      📜 RSS headline scrolling across the screen...
    </div>`,
    generateHtml: (props) => `
      <section class="news-ticker-wrap" id="widget-${props.id}">
        <span class="ticker-label">📜</span>
        <div class="ticker-track">
          <div class="ticker-content" id="${props.id}-ticker">Loading RSS feed...</div>
        </div>
      </section>`,
    generateJs: (props) => `
      // RSS Ticker Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('${props.feedUrl || ''}'));
          const data = await res.json();
          const headlines = (data.items || []).map(item => item.title).join(' ••• ');
          document.getElementById('${props.id}-ticker').textContent = headlines || 'No items found';
        } catch (e) {
          document.getElementById('${props.id}-ticker').textContent = 'Failed to load RSS feed';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  },

  'rss-feed': {
    name: 'RSS Feed',
    icon: '📡',
    category: 'large',
    description: 'Displays RSS feed items in a list. May need CORS proxy.',
    defaultWidth: 400,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: 'RSS Feed',
      feedUrl: 'https://example.com/feed.xml',
      maxItems: 5,
      refreshInterval: 600
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div style="padding:4px 0;">• Latest article title</div>
      <div style="padding:4px 0;">• Another article</div>
      <div style="padding:4px 0;">• Third article</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">📡 ${props.title || 'RSS Feed'}</span>
        </div>
        <div class="dash-card-body compact-list" id="${props.id}-items">
          <div class="rss-item">• Latest tech news headline</div>
          <div class="rss-item">• Another interesting article</div>
          <div class="rss-item">• Breaking: Major announcement</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // RSS Feed Widget: ${props.id}
      // Note: RSS feeds require a CORS proxy or server-side fetch
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          // Use a CORS proxy like rss2json.com
          const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('${props.feedUrl || ''}'));
          const data = await res.json();
          const container = document.getElementById('${props.id}-items');
          container.innerHTML = (data.items || []).slice(0, ${props.maxItems || 5}).map(item => 
            '<a href="' + item.link + '" class="rss-item" target="_blank">' + item.title + '</a>'
          ).join('');
        } catch (e) {
          document.getElementById('${props.id}-items').innerHTML = '<div class="error">Failed to load feed</div>';
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
          <span class="dash-card-title">🌍 ${props.title || 'World Clock'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-clocks">
          <div style="color:#8b949e;font-size:12px;">Loading times...</div>
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
  }
};

// Export for use in builder
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WIDGETS;
}

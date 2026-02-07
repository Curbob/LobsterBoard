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
    defaultWidth: 350,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'World Weather',
      locations: 'New York,London,Tokyo',
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
        const locations = '${props.locations || 'New York,London,Tokyo'}'.split(',').map(l => l.trim());
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
    defaultWidth: 180,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'OPENCLAW_API',
    properties: {
      title: 'Auth',
      endpoint: 'http://localhost:18789/api/status',
      refreshInterval: 30
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="width:10px;height:10px;background:#3fb950;border-radius:50%;margin:0 auto 4px;"></div>
      <div style="font-size:13px;">OAuth</div>
      <div style="font-size:11px;color:#8b949e;">Auth</div>
    </div>`,
    generateHtml: (props) => `
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-indicator" id="${props.id}-dot"></div>
        <div class="kpi-data">
          <div class="kpi-value" id="${props.id}-value">—</div>
          <div class="kpi-label">Auth</div>
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
          val.textContent = data.authMode || 'Unknown';
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
    name: 'Sleep Ring',
    icon: '😴',
    category: 'small',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: true,
    apiKeyName: 'GARMIN_TOKEN',
    properties: {
      title: 'Sleep',
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

  'release': {
    name: 'Release',
    icon: '📦',
    category: 'small',
    defaultWidth: 180,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Release',
      repo: 'openclaw/openclaw',
      refreshInterval: 3600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:13px;">v1.2.3</div>
      <div style="font-size:11px;color:#8b949e;">Latest Release</div>
    </div>`,
    generateHtml: (props) => `
      <div class="kpi-card kpi-sm kpi-release" id="widget-${props.id}">
        <div class="kpi-icon">📦</div>
        <div class="kpi-data">
          <div class="kpi-value" id="${props.id}-version" style="font-size:14px;">—</div>
          <div class="kpi-label">Release</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Release Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('https://api.github.com/repos/${props.repo || 'openclaw/openclaw'}/releases/latest');
          const data = await res.json();
          document.getElementById('${props.id}-version').textContent = data.tag_name || 'Unknown';
        } catch (e) {
          document.getElementById('${props.id}-version').textContent = 'Error';
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

  'stat-card': {
    name: 'Stat Card',
    icon: '📊',
    category: 'small',
    defaultWidth: 180,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Stat',
      value: '42',
      label: 'Custom Stat',
      color: 'blue'
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:24px;color:#58a6ff;">42</div>
      <div style="font-size:11px;color:#8b949e;">Custom Stat</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">📊 ${props.title || 'Stat'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-value ${props.color || 'blue'}" id="${props.id}-value">${props.value || '—'}</div>
          <div class="kpi-label">${props.label || 'Stat'}</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Stat Card Widget: ${props.id}
      // This is a static display widget - update via your own logic
    `
  },

  // ─────────────────────────────────────────────
  // LARGE CARDS (Content)
  // ─────────────────────────────────────────────

  'activity-list': {
    name: 'Activity List',
    icon: '📋',
    category: 'large',
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
    defaultWidth: 200,
    defaultHeight: 120,
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
      <div class="kpi-card kpi-sm" id="widget-${props.id}" style="flex-direction:column;text-align:center;">
        <div class="kpi-value" id="${props.id}-time">${props.workMinutes || 25}:00</div>
        <button class="pomo-btn" id="${props.id}-btn" onclick="togglePomo_${props.id.replace(/-/g, '_')}()">▶️ Start</button>
      </div>`,
    generateJs: (props) => `
      // Pomodoro Widget: ${props.id}
      let pomoRunning_${props.id.replace(/-/g, '_')} = false;
      let pomoSeconds_${props.id.replace(/-/g, '_')} = ${(props.workMinutes || 25) * 60};
      let pomoInterval_${props.id.replace(/-/g, '_')};
      function togglePomo_${props.id.replace(/-/g, '_')}() {
        const btn = document.getElementById('${props.id}-btn');
        if (pomoRunning_${props.id.replace(/-/g, '_')}) {
          clearInterval(pomoInterval_${props.id.replace(/-/g, '_')});
          btn.textContent = '▶️ Start';
        } else {
          pomoInterval_${props.id.replace(/-/g, '_')} = setInterval(() => {
            pomoSeconds_${props.id.replace(/-/g, '_')}--;
            if (pomoSeconds_${props.id.replace(/-/g, '_')} <= 0) {
              clearInterval(pomoInterval_${props.id.replace(/-/g, '_')});
              document.getElementById('${props.id}-time').textContent = 'Done!';
              return;
            }
            const m = Math.floor(pomoSeconds_${props.id.replace(/-/g, '_')} / 60);
            const s = pomoSeconds_${props.id.replace(/-/g, '_')} % 60;
            document.getElementById('${props.id}-time').textContent = m + ':' + (s < 10 ? '0' : '') + s;
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
    defaultWidth: 220,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Countdown',
      targetDate: '2025-12-31',
      label: 'New Year'
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:11px;color:#8b949e;">New Year</div>
      <div style="font-size:20px;">42 days</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">⏳ ${props.title || 'Countdown'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="kpi-label">${props.label || 'Event'}</div>
          <div class="kpi-value" id="${props.id}-days">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Countdown Widget: ${props.id}
      function update_${props.id.replace(/-/g, '_')}() {
        const target = new Date('${props.targetDate || '2025-12-31'}');
        const now = new Date();
        const diff = target - now;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        document.getElementById('${props.id}-days').textContent = days > 0 ? days + ' days' : 'Today!';
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, 60000);
    `
  },

  'image-embed': {
    name: 'Image Embed',
    icon: '🖼️',
    category: 'large',
    defaultWidth: 300,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Image',
      imageUrl: 'https://placekitten.com/300/200',
      fit: 'cover'
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🖼️ Image
    </div>`,
    generateHtml: (props) => `
      <div class="image-widget" id="widget-${props.id}" style="height:100%;border-radius:8px;overflow:hidden;">
        <img src="${props.imageUrl || ''}" style="width:100%;height:100%;object-fit:${props.fit || 'cover'};">
      </div>`,
    generateJs: (props) => `
      // Image Embed Widget: ${props.id}
      // Static image - no JS needed
    `
  },

  'quick-links': {
    name: 'Quick Links',
    icon: '🔗',
    category: 'large',
    defaultWidth: 300,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Quick Links',
      links: 'Google|https://google.com,GitHub|https://github.com,Reddit|https://reddit.com'
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
        </div>
      </div>`,
    generateJs: (props) => `
      // Quick Links Widget: ${props.id}
      const links_${props.id.replace(/-/g, '_')} = '${props.links || ''}'.split(',').filter(Boolean);
      document.getElementById('${props.id}-links').innerHTML = links_${props.id.replace(/-/g, '_')}.map(link => {
        const [name, url] = link.split('|');
        return '<a href="' + (url || '#') + '" class="quick-link" target="_blank">' + name + '</a>';
      }).join('');
    `
  },

  'iframe-embed': {
    name: 'Iframe Embed',
    icon: '🌐',
    category: 'large',
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
    defaultWidth: 300,
    defaultHeight: 180,
    hasApiKey: false,
    properties: {
      title: 'World Clock',
      timezones: 'America/New_York|New York,Europe/London|London,Asia/Tokyo|Tokyo',
      format24h: false
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🇺🇸 New York: 5:30 PM</div>
      <div>🇬🇧 London: 10:30 PM</div>
      <div>🇯🇵 Tokyo: 7:30 AM</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🌍 ${props.title || 'World Clock'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-clocks">
        </div>
      </div>`,
    generateJs: (props) => `
      // World Clock Widget: ${props.id}
      // Format: timezone|label,timezone|label (label optional)
      const tzs_${props.id.replace(/-/g, '_')} = '${props.timezones || 'UTC'}'.split(',').map(entry => {
        const parts = entry.trim().split('|');
        const tz = parts[0].trim();
        const label = parts[1] ? parts[1].trim() : tz.split('/').pop().replace(/_/g, ' ');
        return { tz, label };
      });
      function update_${props.id.replace(/-/g, '_')}() {
        const container = document.getElementById('${props.id}-clocks');
        const hour12 = ${!props.format24h};
        container.innerHTML = tzs_${props.id.replace(/-/g, '_')}.map(item => {
          const time = new Date().toLocaleTimeString('en-US', { timeZone: item.tz, hour: 'numeric', minute: '2-digit', hour12 });
          return '<div class="tz-row"><span class="tz-city">' + item.label + '</span><span class="tz-time">' + time + '</span></div>';
        }).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, 1000);
    `
  },

  'battery-status': {
    name: 'Battery Status',
    icon: '🔋',
    category: 'small',
    defaultWidth: 160,
    defaultHeight: 100,
    hasApiKey: false,
    properties: {
      title: 'Battery',
      device: 'Laptop'
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:20px;color:#3fb950;">87%</div>
      <div style="font-size:11px;color:#8b949e;">Charging</div>
    </div>`,
    generateHtml: (props) => `
      <div class="kpi-card kpi-sm" id="widget-${props.id}">
        <div class="kpi-icon">🔋</div>
        <div class="kpi-data">
          <div class="kpi-value green" id="${props.id}-level">—</div>
          <div class="kpi-label" id="${props.id}-status">${props.device || 'Battery'}</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Battery Status Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const battery = await navigator.getBattery();
          const pct = Math.round(battery.level * 100);
          document.getElementById('${props.id}-level').textContent = pct + '%';
          document.getElementById('${props.id}-status').textContent = battery.charging ? 'Charging' : 'On Battery';
          const el = document.getElementById('${props.id}-level');
          el.className = 'kpi-value ' + (pct > 50 ? 'green' : pct > 20 ? 'orange' : 'red');
        } catch (e) {
          document.getElementById('${props.id}-level').textContent = 'N/A';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, 60000);
    `
  }
};

// Export for use in builder
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WIDGETS;
}

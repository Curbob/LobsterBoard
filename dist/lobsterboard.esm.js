/*!
 * LobsterBoard v0.8.0
 * Dashboard builder with customizable widgets
 * https://github.com/curbob/LobsterBoard
 * @license MIT
 */
/**
 * LobsterBoard - Widget Definitions
 * Each widget defines its default size, properties, and generated code
 * 
 * @module lobsterboard/widgets
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
          const code = parseInt(current.weatherCode);
          let icon = '🌡️';
          if (code === 113) icon = '☀️';
          else if (code === 116 || code === 119) icon = '⛅';
          else if (code >= 176 && code <= 359) icon = '🌧️';
          else if (code >= 368 && code <= 395) icon = '❄️';
          document.getElementById('${props.id}-icon').textContent = icon;
        } catch (e) {
          console.error('Weather widget error:', e);
          document.getElementById('${props.id}-value').textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
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
          const json = await res.json();
          const data = json.data || json;
          const dot = document.getElementById('${props.id}-dot');
          const val = document.getElementById('${props.id}-value');
          val.textContent = data.authMode === 'oauth' ? 'Subscription' : 'API';
          dot.className = 'kpi-indicator ' + (data.authMode === 'oauth' ? 'green' : 'yellow');
        } catch (e) {
          console.error('Auth status widget error:', e);
          document.getElementById('${props.id}-value').textContent = '—';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 30) * 1000});
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
        </div>
      </div>`,
    generateJs: (props) => `
      // Activity List Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/activity'}');
          const json = await res.json();
          const data = json.data || json;
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
          const items = data.items || [];
          list.innerHTML = items.slice(0, ${props.maxItems || 10}).map(item => 
            '<div class="list-item">' + item.text + '</div>'
          ).join('');
          badge.textContent = items.length + ' items';
        } catch (e) {
          console.error('Activity list widget error:', e);
          document.getElementById('${props.id}-list').innerHTML = '<div class="list-item">—</div>';
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
        </div>
      </div>`,
    generateJs: (props) => `
      // Cron Jobs Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/cron'}');
          const json = await res.json();
          const data = json.data || json;
          const list = document.getElementById('${props.id}-list');
          const badge = document.getElementById('${props.id}-badge');
          const jobs = data.jobs || [];
          list.innerHTML = jobs.map(job => 
            '<div class="cron-item"><span class="cron-name">' + job.name + '</span><span class="cron-next">' + job.next + '</span></div>'
          ).join('');
          badge.textContent = jobs.length + ' jobs';
        } catch (e) {
          console.error('Cron jobs widget error:', e);
          document.getElementById('${props.id}-list').innerHTML = '<div class="cron-item"><span class="cron-name">—</span></div>';
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
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🔧 ${props.title || 'System Log'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body compact-list syslog-scroll" id="${props.id}-log">
          <div class="log-line">[INFO] System started successfully</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // System Log Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/logs'}');
          const json = await res.json();
          const data = json.data || json;
          const log = document.getElementById('${props.id}-log');
          const badge = document.getElementById('${props.id}-badge');
          const lines = data.lines || [];
          log.innerHTML = lines.slice(-${props.maxLines || 50}).map(line => 
            '<div class="log-line">' + line + '</div>'
          ).join('');
          badge.textContent = lines.length + ' lines';
          log.scrollTop = log.scrollHeight;
        } catch (e) {
          console.error('System log widget error:', e);
          document.getElementById('${props.id}-log').innerHTML = '<div class="log-line">—</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  },

  // ─────────────────────────────────────────────
  // BARS
  // ─────────────────────────────────────────────

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
          <span class="dash-card-title">📑 ${props.title || 'Pages'}</span>
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
          text-decoration:none; font-size:13px;
          transition: background .15s, color .15s;
        }
        .pages-menu-item:hover { background:#30363d; color:#58a6ff; }
        .pages-menu-item .pages-menu-icon { font-size:15px; }
      </style>`,
    generateJs: (props) => `
      // Pages Menu Widget: ${props.id}
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
      document.getElementById('${props.id}-refresh').textContent = 
        new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    `
  },

  'system-graphical': {
    name: 'System (Graphical)',
    icon: '💻',
    category: 'system',
    description: 'Graphical CPU and Memory usage with circular progress rings. Supports remote servers via lobsterboard-agent.',
    defaultWidth: 240,
    defaultHeight: 140,
    hasApiKey: false,
    properties: {
      title: 'System',
      server: 'local',
      refreshInterval: 5,
      showPercentages: true,
      showLabels: true
    },
    preview: `<div style="display:flex;align-items:center;justify-content:space-around;padding:8px;">
      <div style="position:relative;width:50px;height:50px;">
        <svg viewBox="0 0 48 48" style="width:100%;height:100%;transform:rotate(-90deg);">
          <circle cx="24" cy="24" r="18" fill="none" stroke="#30363d" stroke-width="4"/>
          <circle cx="24" cy="24" r="18" fill="none" stroke="#58a6ff" stroke-width="4"
            stroke-dasharray="113" stroke-dashoffset="85" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:600;color:#58a6ff;">25%</div>
      </div>
      <div style="position:relative;width:50px;height:50px;">
        <svg viewBox="0 0 48 48" style="width:100%;height:100%;transform:rotate(-90deg);">
          <circle cx="24" cy="24" r="18" fill="none" stroke="#30363d" stroke-width="4"/>
          <circle cx="24" cy="24" r="18" fill="none" stroke="#3fb950" stroke-width="4"
            stroke-dasharray="113" stroke-dashoffset="68" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:600;color:#3fb950;">40%</div>
      </div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('cpu')} ${props.title || 'System'}</span>
          ${props.server && props.server !== 'local' ? `<span class="dash-card-badge" style="font-size:10px;">🌐</span>` : ''}
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:space-around;padding:12px;">
          <div class="system-metric">
            ${props.showLabels ? '<div class="metric-label">CPU</div>' : ''}
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>
                <circle id="${props.id}-cpu-ring" cx="24" cy="24" r="18" fill="none" stroke="#58a6ff" stroke-width="4"
                  stroke-dasharray="113.1" stroke-dashoffset="113.1" stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease; transform: rotate(-90deg); transform-origin: 50% 50%;"/>
              </svg>
              <div class="progress-ring-text">
                <span id="${props.id}-cpu-pct" ${props.showPercentages ? '' : 'style="display:none;"'}>—</span>
                <span id="${props.id}-cpu-icon" ${props.showPercentages ? 'style="display:none;"' : ''}>💻</span>
              </div>
            </div>
          </div>
          <div class="system-metric">
            ${props.showLabels ? '<div class="metric-label">MEM</div>' : ''}
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>
                <circle id="${props.id}-mem-ring" cx="24" cy="24" r="18" fill="none" stroke="#3fb950" stroke-width="4"
                  stroke-dasharray="113.1" stroke-dashoffset="113.1" stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease; transform: rotate(-90deg); transform-origin: 50% 50%;"/>
              </svg>
              <div class="progress-ring-text">
                <span id="${props.id}-mem-pct" ${props.showPercentages ? '' : 'style="display:none;"'}>—</span>
                <span id="${props.id}-mem-icon" ${props.showPercentages ? 'style="display:none;"' : ''}>🧠</span>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // System (Graphical) Widget: ${props.id} — ${props.server === 'local' ? 'local SSE' : 'remote: ' + props.server}
      
      function getUsageColor(percentage) {
        if (percentage >= 90) return '#f85149'; // Red for critical
        if (percentage >= 75) return '#d29922'; // Yellow for warning
        if (percentage >= 50) return '#58a6ff'; // Blue for moderate
        return '#3fb950'; // Green for good
      }
      
      function updateProgressRing(ringId, percentage, textId) {
        const ring = document.getElementById(ringId);
        const text = document.getElementById(textId);
        if (!ring || !text) return;
        
        const normalizedPct = Math.max(0, Math.min(100, percentage || 0));
        const circumference = 113.1; // 2 * π * 18
        const offset = circumference - (normalizedPct / 100 * circumference);
        const color = getUsageColor(normalizedPct);
        
        ring.style.strokeDashoffset = offset;
        ring.style.stroke = color;
        text.textContent = Math.round(normalizedPct) + '%';
        text.style.color = color;
      }
      
      onStats('${props.server || 'local'}', function(data) {
        // Handle offline state
        if (data._offline) {
          document.getElementById('${props.id}-cpu-pct').textContent = '⚠️';
          document.getElementById('${props.id}-mem-pct').textContent = '⚠️';
          document.getElementById('${props.id}-cpu-ring').style.strokeDashoffset = '113.1';
          document.getElementById('${props.id}-mem-ring').style.strokeDashoffset = '113.1';
          return;
        }
        
        // Update CPU ring
        if (data.cpu && data.cpu.currentLoad != null) {
          updateProgressRing('${props.id}-cpu-ring', data.cpu.currentLoad, '${props.id}-cpu-pct');
        }
        
        // Update Memory ring  
        if (data.memory && data.memory.total && data.memory.active != null) {
          const memoryPct = (data.memory.active / data.memory.total) * 100;
          updateProgressRing('${props.id}-mem-ring', memoryPct, '${props.id}-mem-pct');
        }
      }, ${(props.refreshInterval || 5) * 1000});
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
    properties: { title: 'Claude Usage', refreshInterval: 120 },
    preview: `<div style="padding:8px;font-size:11px;"><div><b>5h Session</b> 28%</div><div><b>7d Weekly</b> 31%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🤖 ${props.title || 'Claude Usage'}</span><span id="${props.id}-sub" style="font-size:10px;color:#8b949e;margin-left:auto;"></span></div><div class="dash-card-body" id="${props.id}-body" style="padding:8px 12px;overflow-y:auto;"><div style="color:#8b949e;text-align:center;">Loading...</div></div></div>`,
    generateJs: (props) => `
      function barColor(pct) { return pct >= 80 ? '#f85149' : pct >= 50 ? '#d29922' : '#3fb950'; }
      function timeLeft(iso) { if (!iso) return ''; const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'now'; const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000); return h > 0 ? h+'h '+m+'m' : m+'m'; }
      function usageBar(label, pct, resetIso) { const p = Math.min(100,Math.max(0,pct||0)), c = barColor(p), reset = resetIso ? '<span style="color:#8b949e;font-size:10px;">resets '+timeLeft(resetIso)+'</span>' : ''; return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-weight:600;font-size:12px;">'+label+'</span><span style="font-size:13px;font-weight:700;color:'+c+';">'+p.toFixed(0)+'%</span></div><div style="background:#21262d;border-radius:4px;height:8px;overflow:hidden;"><div style="width:'+p+'%;height:100%;background:'+c+';border-radius:4px;transition:width .5s;"></div></div>'+(reset?'<div style="text-align:right;margin-top:2px;">'+reset+'</div>':'')+'</div>'; }
      async function update_${props.id.replace(/-/g,'_')}() { const body = document.getElementById('${props.id}-body'); const subEl = document.getElementById('${props.id}-sub'); try { const res = await fetch('/api/pages/claude-usage/usage'); const d = await res.json(); if (d.error) { body.innerHTML='<div style="color:#f85149;">'+d.error+'</div>'; return; } if (subEl) { subEl.textContent = {max:'Max (5×)',pro:'Pro',free:'Free'}[d.subscription]||d.subscription||''; } let html=''; if(d.five_hour) html+=usageBar('5h Session',d.five_hour.utilization,d.five_hour.resets_at); if(d.seven_day) html+=usageBar('7d Weekly',d.seven_day.utilization,d.seven_day.resets_at); if(d.seven_day_opus) html+=usageBar('Opus (7d)',d.seven_day_opus.utilization,d.seven_day_opus.resets_at); if(d.seven_day_sonnet&&d.seven_day_sonnet.utilization>0) html+=usageBar('Sonnet (7d)',d.seven_day_sonnet.utilization,d.seven_day_sonnet.resets_at); if(d.extra_usage&&d.extra_usage.is_enabled){const used=(d.extra_usage.used_credits/100).toFixed(2),limit=d.extra_usage.monthly_limit>0?(d.extra_usage.monthly_limit/100).toFixed(2):'∞';html+='<div style="margin-top:4px;padding-top:6px;border-top:1px solid #30363d;"><div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:#8b949e;">Extra Usage</span><span style="font-weight:600;">$'+used+' / $'+limit+'</span></div></div>';} if(!html) html='<div style="color:#8b949e;">No usage data</div>'; body.innerHTML=html; } catch(e) { console.error('Claude usage error:',e); body.innerHTML='<div style="color:#f85149;">Failed to load</div>'; } }
      update_${props.id.replace(/-/g,'_')}(); setInterval(update_${props.id.replace(/-/g,'_')}, ${(props.refreshInterval||120)*1000});
    `
  }
};

// Helper to get widget categories
function getWidgetCategories() {
  const categories = {};
  for (const [key, widget] of Object.entries(WIDGETS)) {
    const cat = widget.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key, ...widget });
  }
  return categories;
}

// Helper to get widget by type
function getWidget(type) {
  return WIDGETS[type] || null;
}

// Helper to list all widget types
function getWidgetTypes() {
  return Object.keys(WIDGETS);
}

/**
 * LobsterBoard - Dashboard Builder Core
 * Provides utilities for generating dashboard HTML, CSS, and JS
 * 
 * @module lobsterboard/builder
 */


// ─────────────────────────────────────────────
// SECURITY HELPERS
// ─────────────────────────────────────────────

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  // Fallback for Node.js
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────
// HTML PROCESSING
// ─────────────────────────────────────────────

/**
 * Process widget HTML to conditionally remove header
 * @param {string} html - Widget HTML
 * @param {boolean} showHeader - Whether to show the header
 * @returns {string} Processed HTML
 */
function processWidgetHtml(html, showHeader) {
  if (showHeader !== false) return html;
  const headerRegex = /<div\s+class="dash-card-head"[^>]*>[\s\S]*?<\/div>/i;
  return html.replace(headerRegex, '');
}

// ─────────────────────────────────────────────
// CSS GENERATION
// ─────────────────────────────────────────────

/**
 * Generate the base dashboard CSS
 * @returns {string} CSS styles
 */
function generateDashboardCss() {
  return `/* LobsterBoard Dashboard - Generated Styles */

:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --bg-hover: #30363d;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;
  --accent-red: #f85149;
  --accent-purple: #a371f7;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

.dashboard {
  margin: 0 auto;
  overflow: hidden;
}

.widget-container {
  overflow: hidden;
}

/* KPI Cards */
.kpi-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.kpi-sm {
  padding: 12px;
}

.kpi-icon {
  font-size: 24px;
}

.kpi-data {
  flex: 1;
}

.kpi-value {
  font-size: 20px;
  font-weight: 600;
}

.kpi-value.blue { color: var(--accent-blue); }
.kpi-value.green { color: var(--accent-green); }
.kpi-value.orange { color: var(--accent-orange); }
.kpi-value.red { color: var(--accent-red); }

.kpi-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.kpi-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}

.kpi-indicator.green { background: var(--accent-green); }
.kpi-indicator.yellow { background: var(--accent-orange); }
.kpi-indicator.red { background: var(--accent-red); }

/* Dash Cards */
.dash-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.dash-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.dash-card-title {
  font-size: 13px;
  font-weight: 600;
}

.dash-card-badge {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 10px;
}

.dash-card-body {
  flex: 1;
  padding: 12px 16px;
  overflow-y: auto;
}

.compact-list {
  font-size: 12px;
}

.syslog-scroll {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
}

/* Top Bar */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  height: 100%;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.topbar-brand {
  font-weight: 600;
  font-size: 14px;
}

.topbar-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
}

.topbar-link:hover,
.topbar-link.active {
  color: var(--accent-blue);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.topbar-refresh {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

/* List Items */
.list-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.list-item:last-child {
  border-bottom: none;
}

.cron-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.cron-name {
  color: var(--text-primary);
}

.cron-next {
  color: var(--text-muted);
  font-size: 11px;
}

.log-line {
  padding: 2px 0;
  border-bottom: 1px solid rgba(48, 54, 61, 0.5);
}

/* Weather */
.weather-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.weather-row:last-child {
  border-bottom: none;
}

.weather-icon {
  font-size: 18px;
}

.weather-loc {
  flex: 1;
  color: var(--text-primary);
}

.weather-temp {
  font-weight: 600;
  color: var(--accent-blue);
}

/* Utilities */
.loading-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid var(--bg-tertiary);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  color: var(--accent-red);
  padding: 10px;
  text-align: center;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

/* Post-Export Edit Mode */
.edit-mode .widget-container {
  cursor: move;
  outline: 2px dashed #3b82f6;
  outline-offset: -2px;
}

.edit-mode .widget-container:hover {
  outline-color: #60a5fa;
}

.edit-mode .widget-container.dragging {
  opacity: 0.8;
  z-index: 1000;
}

.resize-handle-edit {
  display: none;
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: #3b82f6;
  border-radius: 2px 0 0 0;
  z-index: 10;
}

.edit-mode .resize-handle-edit {
  display: block;
}

#edit-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  padding: 8px 16px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

#edit-toggle:hover {
  background: #334155;
}

#edit-toggle.active {
  background: #3b82f6;
}
`;
}

// ─────────────────────────────────────────────
// JS GENERATION
// ─────────────────────────────────────────────

/**
 * Generate the post-export edit mode JS
 * @returns {string} JavaScript code
 */
function generateEditJs() {
  return `
// ─────────────────────────────────────────────
// POST-EXPORT LAYOUT EDITING
// ─────────────────────────────────────────────

(function() {
  const STORAGE_KEY = 'lobsterboard-layout';
  const GRID_SIZE = 20;
  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 60;
  
  let editMode = false;
  let activeWidget = null;
  let startX, startY, origLeft, origTop, origWidth, origHeight;
  let isResizing = false;

  document.addEventListener('DOMContentLoaded', initEditMode);

  function initEditMode() {
    const btn = document.createElement('button');
    btn.id = 'edit-toggle';
    btn.textContent = '✏️ Edit Layout';
    btn.onclick = toggleEditMode;
    document.body.appendChild(btn);
    document.querySelectorAll('.widget-container').forEach(initWidget);
    loadPositions();
  }

  function initWidget(widget) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle-edit';
    widget.appendChild(handle);
    widget.addEventListener('mousedown', onWidgetMouseDown);
    handle.addEventListener('mousedown', onResizeMouseDown);
  }

  function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    document.getElementById('edit-toggle').classList.toggle('active', editMode);
    document.getElementById('edit-toggle').textContent = editMode ? '💾 Save Layout' : '✏️ Edit Layout';
    if (!editMode) savePositions();
  }

  function onWidgetMouseDown(e) {
    if (!editMode) return;
    if (e.target.classList.contains('resize-handle-edit')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    activeWidget = e.currentTarget;
    isResizing = false;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = activeWidget.offsetLeft;
    origTop = activeWidget.offsetTop;
    activeWidget.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onResizeMouseDown(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    activeWidget = e.target.parentElement;
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    origWidth = activeWidget.offsetWidth;
    origHeight = activeWidget.offsetHeight;
    activeWidget.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!activeWidget) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (isResizing) {
      activeWidget.style.width = Math.max(MIN_WIDTH, origWidth + dx) + 'px';
      activeWidget.style.height = Math.max(MIN_HEIGHT, origHeight + dy) + 'px';
    } else {
      activeWidget.style.left = Math.max(0, origLeft + dx) + 'px';
      activeWidget.style.top = Math.max(0, origTop + dy) + 'px';
    }
  }

  function onMouseUp() {
    if (!activeWidget) return;
    if (isResizing) {
      activeWidget.style.width = snapToGrid(activeWidget.offsetWidth) + 'px';
      activeWidget.style.height = snapToGrid(activeWidget.offsetHeight) + 'px';
    } else {
      activeWidget.style.left = snapToGrid(activeWidget.offsetLeft) + 'px';
      activeWidget.style.top = snapToGrid(activeWidget.offsetTop) + 'px';
    }
    activeWidget.classList.remove('dragging');
    activeWidget = null;
    isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  function savePositions() {
    const positions = {};
    document.querySelectorAll('.widget-container').forEach(widget => {
      const id = widget.dataset.widgetId;
      if (id) {
        positions[id] = {
          left: widget.offsetLeft,
          top: widget.offsetTop,
          width: widget.offsetWidth,
          height: widget.offsetHeight
        };
      }
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch (e) {}
  }

  function loadPositions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const positions = JSON.parse(saved);
      document.querySelectorAll('.widget-container').forEach(widget => {
        const id = widget.dataset.widgetId;
        const pos = positions[id];
        if (pos) {
          widget.style.left = pos.left + 'px';
          widget.style.top = pos.top + 'px';
          widget.style.width = pos.width + 'px';
          widget.style.height = pos.height + 'px';
        }
      });
    } catch (e) {}
  }
})();
`;
}

// ─────────────────────────────────────────────
// DASHBOARD GENERATION
// ─────────────────────────────────────────────

/**
 * Generate widget HTML for a widget configuration
 * @param {Object} widget - Widget configuration
 * @returns {string} Widget HTML
 */
function generateWidgetHtml(widget) {
  const template = WIDGETS[widget.type];
  if (!template) return '';

  const props = { ...widget.properties, id: widget.id };
  let html = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);

  return `
    <div class="widget-container" data-widget-id="${widget.id}" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;">
      ${html}
    </div>`;
}

/**
 * Generate widget JavaScript for a widget configuration
 * @param {Object} widget - Widget configuration
 * @returns {string} Widget JavaScript
 */
function generateWidgetJs(widget) {
  const template = WIDGETS[widget.type];
  if (!template || !template.generateJs) return '';

  const props = { ...widget.properties, id: widget.id };
  return template.generateJs(props);
}

/**
 * Generate complete dashboard HTML
 * @param {Object} config - Dashboard configuration
 * @param {Object} config.canvas - Canvas dimensions { width, height }
 * @param {Array} config.widgets - Array of widget configurations
 * @returns {string} Complete HTML document
 */
function generateDashboardHtml(config) {
  const { canvas, widgets } = config;
  const widgetHtml = widgets.map(generateWidgetHtml).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My LobsterBoard Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="dashboard" style="width:${canvas.width}px;height:${canvas.height}px;position:relative;">
    ${widgetHtml}
  </main>
  <script src="js/dashboard.js"></script>
</body>
</html>`;
}

/**
 * Generate complete dashboard JavaScript
 * @param {Array} widgets - Array of widget configurations
 * @returns {string} Complete JavaScript
 */
function generateDashboardJs(widgets) {
  const widgetJs = widgets.map(generateWidgetJs).filter(Boolean).join('\n\n');
  const editJs = generateEditJs();

  return `/**
 * LobsterBoard Dashboard - Generated JavaScript
 * Replace YOUR_*_API_KEY placeholders with your actual API keys
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');
});

${widgetJs}

${editJs}
`;
}

/**
 * Generate README for exported dashboard
 * @param {Array} widgets - Array of widget configurations
 * @returns {string} README markdown
 */
function generateReadme(widgets) {
  const apiKeys = [];
  const needsOpenClaw = widgets.some(w => 
    ['openclaw-release', 'auth-status', 'activity-list', 'cron-jobs', 'system-log', 'session-count', 'token-gauge'].includes(w.type)
  );
  
  widgets.forEach(widget => {
    const template = WIDGETS[widget.type];
    if (template?.hasApiKey && template.apiKeyName) {
      if (!apiKeys.includes(template.apiKeyName)) {
        apiKeys.push(template.apiKeyName);
      }
    }
  });

  return `# LobsterBoard Dashboard

This dashboard was generated with LobsterBoard Dashboard Builder.

## Quick Start

${needsOpenClaw ? `### Running with OpenClaw widgets

Your dashboard includes widgets that connect to OpenClaw. Run the included server:

\`\`\`bash
node server.js
\`\`\`

Open http://localhost:8080 in your browser.
` : ''}
### Static mode

Open \`index.html\` directly in a browser.

## Files

| File | Description |
|------|-------------|
| \`index.html\` | Dashboard page |
| \`css/style.css\` | Styles |
| \`js/dashboard.js\` | Widget logic |
| \`server.js\` | Server with OpenClaw API proxy |

${apiKeys.length > 0 ? `## API Keys

Edit \`js/dashboard.js\` and replace these placeholders:
${apiKeys.map(key => `- \`YOUR_${key}\``).join('\n')}
` : ''}

---

Generated with LobsterBoard - https://github.com/curbob/LobsterBoard
`;
}

var builder = {
  escapeHtml,
  processWidgetHtml,
  generateDashboardCss,
  generateEditJs,
  generateWidgetHtml,
  generateWidgetJs,
  generateDashboardHtml,
  generateDashboardJs,
  generateReadme
};

/**
 * LobsterBoard - Dashboard Builder Library
 * 
 * A library for building and generating dashboard configurations
 * with customizable widgets.
 * 
 * @module lobsterboard
 * @example
 * // ESM
 * import { WIDGETS, generateDashboardHtml, generateDashboardCss } from 'lobsterboard';
 * 
 * // CommonJS
 * const { WIDGETS, generateDashboardHtml } = require('lobsterboard');
 * 
 * // Browser (UMD)
 * <script src="https://unpkg.com/lobsterboard"></script>
 * const { WIDGETS } = LobsterBoard;
 */


// Version (will be replaced during build)
const VERSION = '0.1.0';

// Default export for convenience
var index = {
  VERSION,
  WIDGETS,
  ...builder
};

export { VERSION, WIDGETS, index as default, escapeHtml, generateDashboardCss, generateDashboardHtml, generateDashboardJs, generateEditJs, generateReadme, generateWidgetHtml, generateWidgetJs, getWidget, getWidgetCategories, getWidgetTypes, processWidgetHtml };
//# sourceMappingURL=lobsterboard.esm.js.map

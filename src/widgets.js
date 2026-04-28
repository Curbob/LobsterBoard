/**
 * LobsterBoard - Widget Definitions
 * Each widget defines its default size, properties, and generated code
 * 
 * @module lobsterboard/widgets
 */

export const WIDGETS = {
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
  },

  // ── Finance ──────────────────────────────────────────────────────────────

  'stock-ticker': {
    name: 'Stock Ticker',
    icon: '📈',
    category: 'large',
    description: 'Live stock prices via Yahoo Finance. No API key required.',
    defaultWidth: 320,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'Stocks',
      symbols: 'AAPL,MSFT,GOOGL,AMZN',
      refreshInterval: 300
    },
    preview: `<div style="padding:6px;font-size:11px;">
      <div style="display:flex;justify-content:space-between;"><span>AAPL</span><span>$182.50 <span style="color:#3fb950;">+1.24%</span></span></div>
      <div style="display:flex;justify-content:space-between;"><span>MSFT</span><span>$375.20 <span style="color:#f85149;">-0.38%</span></span></div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">📈 ${props.title || 'Stocks'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list" style="overflow-y:auto;padding:4px 8px;">
          <div style="color:#8b949e;font-size:12px;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        var list = document.getElementById('${props.id}-list');
        var badge = document.getElementById('${props.id}-badge');
        if (!list) return;
        try {
          var res = await fetch('/api/finance/stocks?symbols=' + encodeURIComponent('${props.symbols || 'AAPL,MSFT'}'));
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var ok = data.filter(function(d) { return !d.error; });
          list.innerHTML = data.map(function(d) {
            if (d.error) return '<div style="padding:5px 0;border-bottom:1px solid #21262d;color:#8b949e;font-size:12px;">' + _esc(d.symbol) + ' — ' + _esc(d.error) + '</div>';
            var color = d.up ? '#3fb950' : '#f85149';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;">'
              + '<span style="font-weight:600;font-size:13px;">' + _esc(d.symbol) + '</span>'
              + '<span style="text-align:right;">'
              + '<span style="font-size:13px;font-weight:700;margin-right:8px;">$' + _esc(d.price) + '</span>'
              + '<span style="font-size:11px;color:' + color + ';font-weight:600;">' + _esc(d.pctChange) + '%</span>'
              + '</span></div>';
          }).join('');
          if (badge) badge.textContent = ok.length + ' stocks';
        } catch (e) {
          console.error('Stock ticker error:', e);
          if (list) list.innerHTML = '<div style="color:#f85149;font-size:12px;">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  'crypto-price': {
    name: 'Crypto Price',
    icon: '₿',
    category: 'large',
    description: 'Live crypto prices via CoinGecko. No API key required.',
    defaultWidth: 320,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'Crypto',
      coins: 'bitcoin,ethereum,solana',
      currency: 'usd',
      refreshInterval: 300
    },
    preview: `<div style="padding:6px;font-size:11px;">
      <div style="display:flex;justify-content:space-between;"><span>Bitcoin</span><span>$67,240 <span style="color:#3fb950;">+2.1%</span></span></div>
      <div style="display:flex;justify-content:space-between;"><span>Ethereum</span><span>$3,521 <span style="color:#f85149;">-0.8%</span></span></div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">₿ ${props.title || 'Crypto'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">—</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list" style="overflow-y:auto;padding:4px 8px;">
          <div style="color:#8b949e;font-size:12px;">Loading...</div>
        </div>
      </div>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        var list = document.getElementById('${props.id}-list');
        var badge = document.getElementById('${props.id}-badge');
        if (!list) return;
        try {
          var res = await fetch('/api/finance/crypto?coins=' + encodeURIComponent('${props.coins || 'bitcoin,ethereum'}') + '&currency=${props.currency || 'usd'}');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          list.innerHTML = data.map(function(d) {
            var color = d.up ? '#3fb950' : '#f85149';
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;">'
              + '<span style="font-weight:600;font-size:13px;">' + _esc(d.name) + '</span>'
              + '<span style="text-align:right;">'
              + '<span style="font-size:13px;font-weight:700;margin-right:8px;">${(props.currency || 'usd').toUpperCase()} ' + _esc(d.price) + '</span>'
              + '<span style="font-size:11px;color:' + color + ';font-weight:600;">' + _esc(d.pctChange) + '%</span>'
              + '</span></div>';
          }).join('');
          if (badge) badge.textContent = data.length + ' coins';
        } catch (e) {
          console.error('Crypto price error:', e);
          if (list) list.innerHTML = '<div style="color:#f85149;font-size:12px;">Failed to load</div>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  },

  // ── Search ────────────────────────────────────────────────────────────────

  'search': {
    name: 'Search',
    icon: '🔍',
    category: 'large',
    description: 'Search box with DuckDuckGo-style !bangs. Press S to focus, ↑ for last query.',
    defaultWidth: 460,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Search',
      placeholder: 'Search or use !bangs',
      searchEngine: 'duckduckgo',
      openInNewTab: true,
      showBangHints: true
    },
    preview: `<div style="padding:10px;">
      <input style="width:100%;padding:6px 10px;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:13px;" placeholder="Search or use !bangs" readonly />
      <div style="font-size:10px;color:#8b949e;margin-top:6px;">!yt YouTube &nbsp; !gh GitHub &nbsp; !r Reddit &nbsp; !so Stack Overflow</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">🔍 ${props.title || 'Search'}</span>
        </div>
        <div class="dash-card-body" style="padding:8px 10px;">
          <form id="${props.id}-form" style="display:flex;gap:6px;" onsubmit="return false;">
            <input id="${props.id}-input" type="text"
              placeholder="${props.placeholder || 'Search or use !bangs'}"
              autocomplete="off" spellcheck="false"
              style="flex:1;padding:7px 11px;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:13px;outline:none;" />
            <button type="submit"
              style="padding:7px 14px;background:#238636;border:none;border-radius:6px;color:#fff;font-size:13px;cursor:pointer;">Go</button>
          </form>
          ${props.showBangHints !== false ? `<div style="font-size:10px;color:#8b949e;margin-top:5px;"><span style="opacity:.7;">!g Google &nbsp; !yt YouTube &nbsp; !gh GitHub &nbsp; !r Reddit &nbsp; !so Stack Overflow &nbsp; !w Wikipedia &nbsp; !npm npm</span></div>` : ''}
        </div>
      </div>`,
    generateJs: (props) => {
      const providers = { duckduckgo:'https://duckduckgo.com/?q={q}', google:'https://www.google.com/search?q={q}', bing:'https://www.bing.com/search?q={q}', brave:'https://search.brave.com/search?q={q}' };
      const bangs = { g:'https://www.google.com/search?q={q}',b:'https://www.bing.com/search?q={q}',yt:'https://www.youtube.com/results?search_query={q}',gh:'https://github.com/search?q={q}',r:'https://www.reddit.com/search/?q={q}',so:'https://stackoverflow.com/search?q={q}',w:'https://en.wikipedia.org/wiki/Special:Search/{q}',img:'https://www.google.com/search?tbm=isch&q={q}',maps:'https://www.google.com/maps/search/{q}',ddg:'https://duckduckgo.com/?q={q}',npm:'https://www.npmjs.com/search?q={q}',mdn:'https://developer.mozilla.org/en-US/search?q={q}',x:'https://x.com/search?q={q}',tw:'https://x.com/search?q={q}' };
      const defaultUrl = providers[props.searchEngine] || providers.duckduckgo;
      return `
        (function() {
          var BANGS = ${JSON.stringify(bangs)};
          var DEFAULT_URL = '${defaultUrl}';
          var lastQuery = '';
          function navigate(q) {
            q = q.trim(); if (!q) return; lastQuery = q;
            var url = DEFAULT_URL;
            var m = q.match(/^!(\\S+)\\s*(.*)/);
            if (m) { var bang = m[1].toLowerCase(), rest = m[2]; if (BANGS[bang]) { url = BANGS[bang]; q = rest || q; } }
            var target = url.replace('{q}', encodeURIComponent(q));
            if (${props.openInNewTab !== false}) { window.open(target, '_blank', 'noopener'); } else { window.location.href = target; }
          }
          var form = document.getElementById('${props.id}-form');
          var input = document.getElementById('${props.id}-input');
          if (form) form.addEventListener('submit', function() { navigate(input.value); });
          if (input) input.addEventListener('keydown', function(e) { if (e.key === 'ArrowUp') { e.preventDefault(); input.value = lastQuery; } });
          document.addEventListener('keydown', function(e) {
            var tag = document.activeElement && document.activeElement.tagName;
            if (e.key === 's' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.ctrlKey && !e.metaKey) {
              var inp = document.getElementById('${props.id}-input');
              if (inp) { inp.focus(); inp.select(); e.preventDefault(); }
            }
          });
        })();
      `;
    }
  }
};

// Helper to get widget categories
export function getWidgetCategories() {
  const categories = {};
  for (const [key, widget] of Object.entries(WIDGETS)) {
    const cat = widget.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key, ...widget });
  }
  return categories;
}

// Helper to get widget by type
export function getWidget(type) {
  return WIDGETS[type] || null;
}

// Helper to list all widget types
export function getWidgetTypes() {
  return Object.keys(WIDGETS);
}

export default WIDGETS;

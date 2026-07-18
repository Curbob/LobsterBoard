/**
 * OpenClaw Dashboard Builder - Misc Widgets
 */
(function(WIDGETS) {

  WIDGETS['auth-status'] = {
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
  };

  WIDGETS['sleep-ring'] = {
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
  };

  WIDGETS['api-status'] = {
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
  };

  WIDGETS['session-count'] = {
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
  };

  WIDGETS['token-gauge'] = {
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
  };

  WIDGETS['cron-jobs'] = {

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
  };

  WIDGETS['indoor-climate'] = {
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
  };

  WIDGETS['camera-feed'] = {
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
  };

  WIDGETS['power-usage'] = {
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
  };

  WIDGETS['teddy-camera-events'] = {
    name: 'Teddy Camera',
    icon: '📷',
    category: 'large',
    description: 'Recent person, vehicle, and package detections from Teddy AI Camera. Polls /api/teddy-camera/feed.',
    defaultWidth: 320,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'Front Door',
      maxItems: 6,
      refreshInterval: 30,
      emptyState: 'Watching the front door.',
      staleAfterSeconds: 300,
      cameraUrl: ''
    },
    preview: `<div style="padding:6px 8px;font-size:11px;">
      <div style="margin-bottom:4px;">🚶 Person on camera 10 min ago.</div>
      <div style="margin-bottom:4px;opacity:0.85;">🚗 Car on camera 32 min ago.</div>
      <div style="opacity:0.55;">📦 Package left at the door 2 hr ago.</div>
    </div>`,
    generateHtml: (props) => `
      <style>
        @keyframes teddycam-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .teddycam-row { display:flex; align-items:center; padding:5px 12px; border-bottom:1px solid var(--border-color,#21262d); cursor:pointer; transition: background 0.1s; }
        .teddycam-row:hover { background: var(--bg-tertiary, #161b22); }
        .teddycam-row img { width:48px; height:36px; object-fit:cover; border-radius:4px; margin-right:8px; flex-shrink:0; background: var(--bg-tertiary,#1f2937); }
        .teddycam-row .line { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .teddycam-row .sub { font-size:10px; color: var(--text-muted,#8b949e); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .teddycam-stale { opacity: 0.55; }
        .teddycam-pulse { display:inline-block; width:6px; height:6px; border-radius:50%; background:#3fb950; margin-right:5px; vertical-align:middle; animation: teddycam-pulse 1.6s ease-in-out infinite; }
        .teddycam-pulse-dim { background:#8b949e; animation: none; }
        .teddycam-modal { position:fixed; inset:0; background:rgba(0,0,0,0.78); display:flex; align-items:center; justify-content:center; z-index:9999; cursor:zoom-out; }
        .teddycam-modal img { max-width:90vw; max-height:90vh; border-radius:6px; box-shadow: 0 12px 36px rgba(0,0,0,0.6); }
      </style>
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('camera')} ${props.title || 'Teddy Camera'}</span>
          <span class="dash-card-badge" id="${props.id}-badge" style="display:none;">0</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;height:100%;overflow:hidden;padding:0;">
          <div id="${props.id}-list" style="flex:1;overflow-y:auto;padding:6px 0;font-size:calc(13px * var(--font-scale, 1));"></div>
          <div id="${props.id}-footer" style="flex-shrink:0;padding:6px 12px 4px 12px;font-size:11px;color:var(--text-muted,#8b949e);border-top:1px solid var(--border-color,#21262d);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
              <span id="${props.id}-status" style="display:flex;align-items:center;gap:0;"></span>
              <a id="${props.id}-link" data-camera-url="${_esc(props.cameraUrl || '')}" href="${_esc(props.cameraUrl || '/api/teddy-camera/health')}" target="_blank" rel="noopener" style="color:var(--accent-blue,#58a6ff);text-decoration:none;">Open Camera →</a>
            </div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Teddy Camera Events Widget: ${props.id}
      (function() {
        const listEl = document.getElementById('${props.id}-list');
        const statusEl = document.getElementById('${props.id}-status');
        const badgeEl = document.getElementById('${props.id}-badge');
        const linkEl = document.getElementById('${props.id}-link');
        const endpoint = '/api/teddy-camera/feed';
        const maxItems = ${Number(props.maxItems) || 6};
        const emptyState = ${JSON.stringify(props.emptyState || 'Watching the front door.')};
        const staleAfter = ${Number(props.staleAfterSeconds) || 300};
        const cameraUrl = ${JSON.stringify(props.cameraUrl || '')};

        // Resolve the "Open Camera" link. If the user left cameraUrl empty, we
        // default to the homebase origin — that lands on the homebase index,
        // which has the teddy house page. Users can override cameraUrl to point
        // at any reachable teddy-camera player URL.
        if (linkEl && (!cameraUrl || cameraUrl.trim() === '')) {
          linkEl.href = window.location.origin + '/pages/teddy-house/';
        }

        function esc(s) {
          return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function openThumb(url) {
          if (!url) return;
          const modal = document.createElement('div');
          modal.className = 'teddycam-modal';
          const img = document.createElement('img');
          img.src = baseUrl + url;
          img.alt = 'detection frame';
          modal.appendChild(img);
          modal.addEventListener('click', () => modal.remove());
          document.body.appendChild(modal);
        }

        function renderEmpty(msg) {
          listEl.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted,#8b949e);font-style:italic;line-height:1.5;">' + esc(msg) + '</div>';
        }

        function ageLabel(sec) {
          if (sec == null) return '';
          const s = Math.max(0, Math.floor(sec));
          if (s < 60) return s + 's';
          const m = Math.floor(s / 60);
          if (m < 60) return m + 'm';
          const h = Math.floor(m / 60);
          if (h < 24) return h + 'h';
          return Math.floor(h / 24) + 'd';
        }

        // Use the homebase origin as the base for thumb URLs. The homebase proxy
        // already forwards /thumbs/* to the teddy camera server, so this works
        // both on localhost and on the Tailscale funnel from a phone.
        const baseUrl = window.location.origin;

        function renderItems(items) {
          if (!items || !items.length) { renderEmpty(emptyState); return; }
          const html = items.slice(0, maxItems).map(function(it) {
            const line = it.message || ((it.icon || '•') + ' ' + (it.label || 'Motion') + ' ' + (it.verb || 'on camera'));
            const age = ageLabel(it.age_seconds);
            const lineWithAge = age ? line + ' ' + age + ' ago' : line;
            const thumb = it.thumb_url ? '<img src="' + baseUrl + it.thumb_url + '" alt="" onerror="this.style.display=\\'none\\'">' : '';
            const sub = it.soc || it.teddy || (it.caption && it.caption !== it.label ? it.caption : null) || (it.source ? it.source.replace('rolling-thumbnail-yolo', 'camera').replace('simulated-detect', 'test') : null);
            const tooltip = it.hand_off || (it.soc && it.teddy ? (it.soc + '  //  ' + it.teddy) : null);
            const staleClass = (it.age_seconds != null && it.age_seconds > staleAfter) ? ' teddycam-stale' : '';
            const thumbFull = it.thumb_url ? baseUrl + it.thumb_url : '';
            const safeUrl = thumbFull ? esc(thumbFull) : '';
            const click = thumbFull ? ' onclick=\\'window.open("' + safeUrl + '","_blank")\\'' : '';
            return '<div class="teddycam-row' + staleClass + '"' + (tooltip ? ' title="' + esc(tooltip) + '"' : '') + click + '>' +
              thumb +
              '<div style="flex:1;min-width:0;">' +
                '<div class="line">' + esc(lineWithAge) + '</div>' +
                (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
              '</div>' +
            '</div>';
          }).join('');
          listEl.innerHTML = html;
        }

        function breakdown(items) {
          const counts = {};
          for (const it of items) {
            const k = it.kind || (it.labels && it.labels[0]) || 'detection';
            counts[k] = (counts[k] || 0) + 1;
          }
          return counts;
        }

        function breakdownTooltip(counts) {
          const parts = [];
          for (const k of Object.keys(counts).sort()) {
            parts.push(counts[k] + ' ' + k);
          }
          return parts.join(', ');
        }

        let lastOkAt = 0;

        function setStatus(text, fresh) {
          const pulse = '<span class="teddycam-pulse' + (fresh ? '' : ' teddycam-pulse-dim') + '"></span>';
          statusEl.innerHTML = pulse + esc(text);
        }

        async function refresh_${props.id.replace(/-/g, '_')}() {
          try {
            const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data.ok) {
              renderEmpty('Camera offline. ' + (data.error || ''));
              setStatus('Camera offline', false);
              if (badgeEl) badgeEl.style.display = 'none';
              return;
            }
            const items = data.items || [];
            renderItems(items);
            const n = items.length;
            if (badgeEl) {
              badgeEl.textContent = String(n);
              badgeEl.style.display = n ? '' : 'none';
              if (n) badgeEl.title = breakdownTooltip(breakdown(items));
            }
            const now = Date.now();
            const updatedMs = data.last_updated ? Date.parse(data.last_updated) : now;
            const ageMs = isNaN(updatedMs) ? 0 : (now - updatedMs);
            const fresh = ageMs < 30000;
            const time = data.last_updated ? new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now';
            setStatus(n ? (n + ' recent • ' + time) : ('Updated ' + time), fresh);
            if (fresh) lastOkAt = now;
          } catch (e) {
            console.error('Teddy Camera widget error:', e);
            renderEmpty('Camera unreachable. Retrying…');
            setStatus('Unreachable', false);
          }
        }

        refresh_${props.id.replace(/-/g, '_')}();
        setInterval(refresh_${props.id.replace(/-/g, '_')}, ${(Number(props.refreshInterval) || 30) * 1000});
      })();
    `
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

/**
 * OpenClaw Dashboard Builder - Time Widgets
 */
(function(WIDGETS) {

  WIDGETS['clock'] = {
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
  };

  WIDGETS['countdown'] = {
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
  };

  WIDGETS['world-clock'] = {
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
  };

  WIDGETS['calendar'] = {

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
  };

  WIDGETS['activity-list'] = {

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
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

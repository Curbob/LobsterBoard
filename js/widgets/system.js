/**
 * OpenClaw Dashboard Builder - System Widgets
 */
(function(WIDGETS) {

  WIDGETS['cpu-memory'] = {
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
  };

  WIDGETS['disk-usage'] = {
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
  };

  WIDGETS['uptime-monitor'] = {
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
  };

  WIDGETS['docker-containers'] = {
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
  };

  WIDGETS['network-speed'] = {
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
  };

  WIDGETS['system-log'] = {

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
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

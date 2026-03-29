/**
 * OpenClaw Dashboard Builder - Releases Widgets
 */
(function(WIDGETS) {

  WIDGETS['lobsterboard-release'] = {
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
  };

  WIDGETS['openclaw-release'] = {
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
  };

  WIDGETS['release'] = {
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
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

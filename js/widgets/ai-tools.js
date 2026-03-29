/**
 * OpenClaw Dashboard Builder - Ai Tools Widgets
 */
(function(WIDGETS) {

  WIDGETS['ai-usage'] = {

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
  };

  WIDGETS['claude-code'] = {

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
  };

  WIDGETS['codex-cli'] = {

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
  };

  WIDGETS['github-copilot'] = {
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
  };

  WIDGETS['cursor'] = {
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
  };

  WIDGETS['gemini-cli'] = {
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
  };

  WIDGETS['amp-code'] = {
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
  };

  WIDGETS['factory'] = {
    name: 'Factory',
    icon: '🏭',
    category: 'small',
    description: 'Track Factory (Droid) usage. Setup: run `factory` once to authenticate.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Factory', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Standard: 25%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🏭 ${props.title || 'Factory'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/factory');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['kimi-code'] = {
    name: 'Kimi Code',
    icon: '🌙',
    category: 'small',
    description: 'Track Kimi Code usage. Setup: run `kimi` once to authenticate.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Kimi', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 26%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🌙 ${props.title || 'Kimi'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/kimi');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['jetbrains-ai'] = {
    name: 'JetBrains AI',
    icon: '🧠',
    category: 'small',
    description: 'Track JetBrains AI Assistant usage. Setup: sign into AI Assistant in any JetBrains IDE.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'JetBrains', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Quota: 15%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🧠 ${props.title || 'JetBrains'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/jetbrains');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['minimax'] = {
    name: 'MiniMax',
    icon: '🔶',
    category: 'small',
    description: 'Track MiniMax Coding usage. Requires MINIMAX_API_KEY env var.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'MiniMax', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 30%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🔶 ${props.title || 'MiniMax'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/minimax');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['zai'] = {
    name: 'Z.ai',
    icon: '🇿',
    category: 'small',
    description: 'Track Z.ai (GLM Coding) usage. Requires ZAI_API_KEY env var.',
    defaultWidth: 280, defaultHeight: 180, hasApiKey: false,
    properties: { title: 'Z.ai', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Session: 15%</div><div>Weekly: 45%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🇿 ${props.title || 'Z.ai'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/zai');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['antigravity-local'] = {
    name: 'Antigravity',
    icon: '🪐',
    category: 'small',
    description: 'Track Google Antigravity usage (Gemini 3, Claude via Google). Requires antigravity-usage login.',
    defaultWidth: 280, defaultHeight: 200, hasApiKey: false,
    properties: { title: 'Antigravity', showPlan: true, refreshInterval: 300 },
    preview: `<div style="padding:4px;font-size:11px;color:#8b949e;"><div>Gemini 3 Pro: 25%</div><div>Claude Sonnet: 40%</div></div>`,
    generateHtml: (props) => `<div class="dash-card" id="widget-${props.id}" style="height:100%;"><div class="dash-card-head"><span class="dash-card-title">🪐 ${props.title || 'Antigravity'}</span><span class="dash-card-badge" id="${props.id}-badge">—</span></div><div class="dash-card-body" id="${props.id}-content" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;"><div style="color:var(--text-muted);font-size:11px;">Loading...</div></div></div>`,
    generateJs: (props) => `async function update_${props.id.replace(/-/g, '_')}(){const content=document.getElementById('${props.id}-content');const badge=document.getElementById('${props.id}-badge');try{const res=await fetch('/api/ai-usage/antigravity');const data=await res.json();if(data.error){content.innerHTML='<div style="color:#f85149;font-size:11px;">'+_esc(data.error)+'</div>';badge.textContent='!';return;}let html='';if(${props.showPlan !== false}&&data.plan)badge.textContent=_esc(data.plan);for(const m of(data.metrics||[])){const pct=m.used!=null?Math.min(100,Math.max(0,m.used)):0;const color=pct>80?'#f85149':pct>50?'#d29922':'#3fb950';html+='<div style="margin-bottom:4px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>'+_esc(m.label)+'</span><span style="color:'+color+';">'+pct.toFixed(0)+'%</span></div><div style="height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+color+';"></div></div></div>';}content.innerHTML=html||'<div style="color:var(--text-muted);font-size:11px;">No data</div>';}catch(e){content.innerHTML='<div style="color:#f85149;font-size:11px;">Error</div>';badge.textContent='!';}}update_${props.id.replace(/-/g, '_')}();setInterval(update_${props.id.replace(/-/g, '_')},${(props.refreshInterval||300)*1000});`
  };

  WIDGETS['ai-usage-claude'] = {
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

  WIDGETS['ai-usage-multi'] = {
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

  WIDGETS['ai-cost-tracker'] = {
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
  };

  WIDGETS['claude-usage'] = {
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
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

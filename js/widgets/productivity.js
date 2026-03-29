/**
 * OpenClaw Dashboard Builder - Productivity Widgets
 */
(function(WIDGETS) {

  WIDGETS['todo-list'] = {

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
  };

  WIDGETS['email-count'] = {
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
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 300) * 1000});
    `
  };

  WIDGETS['pomodoro'] = {
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
  };

  WIDGETS['github-stats'] = {
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
  };

  WIDGETS['stock-ticker'] = {
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
  };

  WIDGETS['crypto-price'] = {
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
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

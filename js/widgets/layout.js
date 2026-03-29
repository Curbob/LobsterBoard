/**
 * OpenClaw Dashboard Builder - Layout Widgets
 */
(function(WIDGETS) {

  WIDGETS['text-header'] = {
    name: 'Header / Text',
    icon: '🔤',
    category: 'layout',
    description: 'Custom text or heading. Adjustable font size, color, and alignment.',
    defaultWidth: 400,
    defaultHeight: 50,
    hasApiKey: false,
    properties: {
      title: 'My Dashboard',
      showHeader: false,
      showBorder: false,
      fontSize: 24,
      fontColor: '#e6edf3',
      textAlign: 'left',
      fontWeight: 'bold'
    },
    preview: `<div style="padding:8px;font-size:18px;font-weight:bold;">My Dashboard</div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="height:100%;display:flex;align-items:center;padding:0 12px;
        font-size:${props.fontSize || 24}px;
        color:${props.fontColor || '#e6edf3'};
        text-align:${props.textAlign || 'left'};
        font-weight:${props.fontWeight || 'bold'};
        justify-content:${props.textAlign === 'center' ? 'center' : props.textAlign === 'right' ? 'flex-end' : 'flex-start'};${props.showBorder ? 'border:1px solid #3a4150;border-radius:8px;' : ''}">
        ${props.title || 'Header'}
      </div>`,
    generateJs: () => ''
  };

  WIDGETS['horizontal-line'] = {
    name: 'Horizontal Line',
    icon: '➖',
    category: 'layout',
    description: 'A horizontal divider line. Resize width to fit.',
    defaultWidth: 600,
    defaultHeight: 10,
    hasApiKey: false,
    properties: {
      title: '',
      showHeader: false,
      lineColor: '#30363d',
      lineThickness: 2
    },
    preview: `<div style="padding:4px 0;"><hr style="border:none;border-top:2px solid #30363d;"></div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="width:100%;height:100%;display:flex;align-items:center;padding:0;">
        <hr style="width:100%;border:none;border-top:${props.lineThickness || 2}px solid ${props.lineColor || '#30363d'};margin:0;flex-shrink:0;">
      </div>`,
    generateJs: () => ''
  };

  WIDGETS['vertical-line'] = {
    name: 'Vertical Line',
    icon: '│',
    category: 'layout',
    description: 'A vertical divider line. Resize height to fit.',
    defaultWidth: 10,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: '',
      showHeader: false,
      lineColor: '#30363d',
      lineThickness: 2
    },
    preview: `<div style="display:flex;justify-content:center;height:40px;"><div style="border-left:2px solid #30363d;height:100%;"></div></div>`,
    generateHtml: (props) => `
      <div id="widget-${props.id}" style="width:100%;height:100%;display:flex;justify-content:center;padding:0;">
        <div style="border-left:${props.lineThickness || 2}px solid ${props.lineColor || '#30363d'};height:100%;flex-shrink:0;"></div>
      </div>`,
    generateJs: () => ''
  };

  WIDGETS['notes'] = {
    name: 'Notes',
    icon: '📝',
    category: 'large',
    description: 'Simple note-taking widget with persistent storage.',
    defaultWidth: 350,
    defaultHeight: 300,
    hasApiKey: false,
    properties: {
      title: 'Notes'
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>📝 Remember to check logs</div>
      <div>📝 Update docs</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('notes')} ${props.title || 'Notes'}</span>
          <span class="dash-card-badge" id="${props.id}-badge">0</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
          <div style="display:flex;gap:6px;padding:0 0 8px 0;flex-shrink:0;">
            <textarea id="${props.id}-input" placeholder="Add a note..." rows="2" style="flex:1;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;color:var(--text-primary);font-size:calc(12px * var(--font-scale, 1));resize:none;font-family:inherit;"></textarea>
            <button id="${props.id}-add-btn" style="background:var(--accent-blue);color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:calc(12px * var(--font-scale, 1));align-self:flex-end;">Add</button>
          </div>
          <div id="${props.id}-list" style="flex:1;overflow-y:auto;"></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Notes Widget: ${props.id}
      (function() {
        let notes = [];
        const container = document.getElementById('${props.id}-list');
        const input = document.getElementById('${props.id}-input');
        const addBtn = document.getElementById('${props.id}-add-btn');
        const badge = document.getElementById('${props.id}-badge');

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\n/g,'<br>'); }

        function render() {
          badge.textContent = notes.length;
          container.innerHTML = notes.map((n, i) =>
            '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:calc(13px * var(--font-scale, 1));">' +
              '<span style="flex:1;white-space:pre-wrap;word-break:break-word;">' + esc(n.text) + '</span>' +
              '<button data-del="' + i + '" style="background:none;border:none;color:var(--accent-red,#f85149);cursor:pointer;font-size:calc(14px * var(--font-scale, 1));padding:0 4px;flex-shrink:0;">✕</button>' +
            '</div>'
          ).join('');
        }

        function save() {
          fetch('/api/notes').then(r => r.json()).then(all => {
            all['${props.id}'] = notes;
            return fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all) });
          }).catch(() => {});
        }

        container.addEventListener('click', function(e) {
          if (e.target.dataset.del != null) {
            notes.splice(parseInt(e.target.dataset.del), 1);
            save(); render();
          }
        });

        addBtn.addEventListener('click', function() {
          const text = input.value.trim();
          if (!text) return;
          notes.push({ text: text, ts: Date.now() });
          input.value = '';
          save(); render();
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addBtn.click(); }
        });

        fetch('/api/notes').then(r => r.json()).then(all => {
          notes = Array.isArray(all['${props.id}']) ? all['${props.id}'] : [];
          render();
        }).catch(() => render());
      })();
    `
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

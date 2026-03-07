/**
 * LobsterBoard Template Gallery System
 */
(function() {
  function _esc(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  const galleryModal = document.getElementById('template-gallery-modal');
  const exportModal = document.getElementById('template-export-modal');
  const tplGrid = document.getElementById('tpl-grid');
  const tplDetail = document.getElementById('tpl-detail');
  const tplSearch = document.getElementById('tpl-search');

  let allTemplates = [];
  let selectedTemplate = null;

  // ── Open/Close Gallery ──
  document.getElementById('btn-templates').addEventListener('click', () => {
    galleryModal.style.display = 'flex';
    tplDetail.style.display = 'none';
    tplGrid.style.display = '';
    loadTemplates();
  });

  document.getElementById('tpl-close').addEventListener('click', () => {
    galleryModal.style.display = 'none';
  });

  galleryModal.addEventListener('click', (e) => {
    if (e.target === galleryModal) galleryModal.style.display = 'none';
  });

  // ── Open/Close Export ──
  document.getElementById('btn-export-template').addEventListener('click', () => {
    exportModal.style.display = 'flex';
    document.getElementById('tpl-export-result').style.display = 'none';
    document.getElementById('tpl-export-name').value = '';
    document.getElementById('tpl-export-desc').value = '';
    document.getElementById('tpl-export-author').value = '';
    document.getElementById('tpl-export-tags').value = '';
    document.getElementById('tpl-export-screenshot').value = '';
    // Show widget list
    const widgetListEl = document.getElementById('tpl-widget-list');
    if (typeof state !== 'undefined' && state.widgets && typeof WIDGETS !== 'undefined') {
      const typeCounts = {};
      state.widgets.forEach(w => {
        const tpl = WIDGETS[w.type];
        const name = tpl ? (tpl.icon || '') + ' ' + tpl.name : w.type;
        typeCounts[name] = (typeCounts[name] || 0) + 1;
      });
      const items = Object.entries(typeCounts).sort((a,b) => b[1] - a[1]);
      widgetListEl.innerHTML = `<strong style="color:var(--text-secondary);">Widgets in this template (${state.widgets.length}):</strong><div style="margin-top:6px;">${items.map(([name, count]) => `<span style="display:inline-block;padding:2px 8px;margin:2px;background:var(--bg-secondary);border-radius:4px;font-size:11px;">${name}${count > 1 ? ' ×' + count : ''}</span>`).join('')}</div>`;
    } else {
      widgetListEl.innerHTML = '';
    }
  });

  document.getElementById('tpl-export-close').addEventListener('click', () => {
    exportModal.style.display = 'none';
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.style.display = 'none';
  });

  // ── Search ──
  tplSearch.addEventListener('input', () => {
    const q = tplSearch.value.toLowerCase();
    renderGrid(allTemplates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    ));
  });

  // ── Load Templates ──
  async function loadTemplates() {
    try {
      const res = await fetch('/api/templates');
      allTemplates = await res.json();
      renderGrid(allTemplates);
    } catch (e) {
      tplGrid.innerHTML = '<div class="tpl-empty">Failed to load templates</div>';
    }
  }

  // ── Render Grid ──
  function renderGrid(templates) {
    if (!templates.length) {
      tplGrid.innerHTML = '<div class="tpl-empty">No templates found. Export your dashboard to create one!</div>';
      return;
    }
    tplGrid.innerHTML = templates.map(t => `
      <div class="tpl-card" data-id="${_esc(t.id)}">
        <div class="tpl-card-img">
          <img src="/api/templates/${_esc(t.id)}/preview" alt="${_esc(t.name)}" onerror="this.parentElement.innerHTML='<div class=\\'tpl-no-preview\\'>🦞</div>'">
        </div>
        <div class="tpl-card-body">
          <h3>${_esc(t.name)}</h3>
          <p>${_esc(t.description || '')}</p>
          <div class="tpl-card-meta">
            <span>${_esc(String(t.widgetCount || 0))} widgets</span>
            <span>${_esc(t.canvasSize || '')}</span>
          </div>
          ${(t.widgetTypes || []).length ? `<div style="margin-top:4px;font-size:10px;color:var(--text-muted);">${t.widgetTypes.slice(0,6).map(w => _esc((w.icon || '') + ' ' + w.name)).join(' · ')}${t.widgetTypes.length > 6 ? ' · +' + (t.widgetTypes.length - 6) + ' more' : ''}</div>` : ''}
          <div class="tpl-card-tags">${(t.tags || []).map(tag => `<span class="tpl-tag">${_esc(tag)}</span>`).join('')}</div>
        </div>
      </div>
    `).join('');

    tplGrid.querySelectorAll('.tpl-card').forEach(card => {
      card.addEventListener('click', () => showDetail(card.dataset.id));
    });
  }

  // ── Detail View ──
  function showDetail(id) {
    selectedTemplate = allTemplates.find(t => t.id === id);
    if (!selectedTemplate) return;

    tplGrid.style.display = 'none';
    tplDetail.style.display = 'block';

    document.getElementById('tpl-detail-img').src = `/api/templates/${id}/preview`;
    document.getElementById('tpl-detail-name').textContent = selectedTemplate.name;
    document.getElementById('tpl-detail-desc').textContent = selectedTemplate.description || '';
    document.getElementById('tpl-detail-meta').innerHTML = `
      <div><strong>Author:</strong> ${_esc(selectedTemplate.author || 'anonymous')}</div>
      <div><strong>Canvas:</strong> ${_esc(selectedTemplate.canvasSize || 'unknown')}</div>
      <div><strong>Widgets:</strong> ${_esc(String(selectedTemplate.widgetCount || 0))}</div>
      ${(selectedTemplate.requiresSetup || []).length ? `<div><strong>Requires:</strong> ${(selectedTemplate.requiresSetup || []).map(s => _esc(s)).join(', ')}</div>` : ''}
      ${(selectedTemplate.widgetTypes || []).length ? `<div style="margin-top:8px;"><strong>Widget Types:</strong><div style="margin-top:4px;">${selectedTemplate.widgetTypes.map(w => `<span style="display:inline-block;padding:2px 8px;margin:2px;background:var(--bg-tertiary);border-radius:4px;font-size:11px;">${_esc((w.icon || '') + ' ' + w.name)}${w.count > 1 ? ' ×' + _esc(String(w.count)) : ''}</span>`).join('')}</div></div>` : ''}
    `;
    document.getElementById('tpl-detail-tags').innerHTML = (selectedTemplate.tags || []).map(t => `<span class="tpl-tag">${_esc(t)}</span>`).join('');
  }

  document.getElementById('tpl-back').addEventListener('click', () => {
    tplDetail.style.display = 'none';
    tplGrid.style.display = '';
  });

  // ── Lightbox — click detail image to enlarge ──
  document.getElementById('tpl-detail-img').addEventListener('click', () => {
    const lb = document.getElementById('tpl-lightbox');
    document.getElementById('tpl-lightbox-img').src = document.getElementById('tpl-detail-img').src;
    lb.style.display = 'flex';
  });

  // ── Delete Template ──
  document.getElementById('tpl-delete').addEventListener('click', async () => {
    if (!selectedTemplate) return;
    if (!confirm(`Delete template "${selectedTemplate.name}"?\n\nThis cannot be undone!`)) return;
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        tplDetail.style.display = 'none';
        tplGrid.style.display = '';
        loadTemplates();
      } else {
        alert('❌ ' + (data.error || data.message || 'Delete failed'));
      }
    } catch (e) {
      alert('❌ Delete failed: ' + e.message);
    }
  });

  // ── Import ──
  document.getElementById('tpl-import-replace').addEventListener('click', async () => {
    if (!selectedTemplate) return;
    if (!confirm(`Replace your current dashboard with "${selectedTemplate.name}"?\n\nThis will overwrite your entire layout!`)) return;
    await doImport(selectedTemplate.id, 'replace');
  });

  document.getElementById('tpl-import-merge').addEventListener('click', async () => {
    if (!selectedTemplate) return;
    await doImport(selectedTemplate.id, 'merge');
  });

  async function doImport(id, mode) {
    try {
      const res = await fetch('/api/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mode })
      });
      const data = await res.json();
      if (data.status === 'success') {
        galleryModal.style.display = 'none';
        alert(`✅ ${data.message}\n\nReloading dashboard...`);
        location.reload();
      } else {
        alert('❌ ' + (data.error || data.message || 'Import failed'));
      }
    } catch (e) {
      alert('❌ Import failed: ' + e.message);
    }
  }

  // ── Export ──
  document.getElementById('tpl-export-submit').addEventListener('click', async () => {
    const name = document.getElementById('tpl-export-name').value.trim();
    if (!name) { alert('Please enter a template name'); return; }

    const description = document.getElementById('tpl-export-desc').value.trim();
    const author = document.getElementById('tpl-export-author').value.trim();
    const tagsStr = document.getElementById('tpl-export-tags').value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Build widget type list
    const widgetTypes = [];
    if (typeof state !== 'undefined' && state.widgets && typeof WIDGETS !== 'undefined') {
      const typeCounts = {};
      state.widgets.forEach(w => {
        const tpl = WIDGETS[w.type];
        const displayName = tpl ? tpl.name : w.type;
        typeCounts[w.type] = typeCounts[w.type] || { name: displayName, icon: tpl ? (tpl.icon || '') : '', count: 0 };
        typeCounts[w.type].count++;
      });
      Object.entries(typeCounts).forEach(([type, info]) => {
        widgetTypes.push({ type, name: info.name, icon: info.icon, count: info.count });
      });
    }

    try {
      const res = await fetch('/api/templates/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, author, tags, widgetTypes })
      });
      const data = await res.json();
      const resultEl = document.getElementById('tpl-export-result');
      if (data.status === 'success') {
        // Upload screenshot — use user file if provided, otherwise auto-capture
        const screenshotFile = document.getElementById('tpl-export-screenshot').files[0];
        let screenshotData = null;

        if (screenshotFile) {
          screenshotData = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(screenshotFile);
          });
        } else {
          // Auto-capture the canvas with html2canvas
          try {
            if (!window.html2canvas) {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
              document.head.appendChild(script);
              await new Promise(resolve => script.onload = resolve);
            }
            const canvasEl = document.getElementById('canvas');
            const captured = await html2canvas(canvasEl, {
              backgroundColor: '#0d1117',
              scale: 1,
              useCORS: true,
              allowTaint: true
            });
            screenshotData = captured.toDataURL('image/png');
          } catch (e) {
            console.warn('Auto-capture screenshot failed:', e);
          }
        }

        if (screenshotData) {
          await fetch(`/api/templates/${data.id}/screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: screenshotData })
          });
        }
        resultEl.innerHTML = `✅ Template exported as <strong>${_esc(data.id)}</strong>${screenshotData ? '<br>Screenshot captured!' : '<br>⚠️ No screenshot (auto-capture failed).'}`;
        resultEl.className = 'tpl-export-result tpl-export-success';
      } else {
        resultEl.innerHTML = `❌ ${_esc(data.error || 'Export failed')}`;
        resultEl.className = 'tpl-export-result tpl-export-error';
      }
      resultEl.style.display = 'block';
    } catch (e) {
      const resultEl = document.getElementById('tpl-export-result');
      resultEl.innerHTML = `❌ Export failed: ${_esc(e.message)}`;
      resultEl.className = 'tpl-export-result tpl-export-error';
      resultEl.style.display = 'block';
    }
  });
})();

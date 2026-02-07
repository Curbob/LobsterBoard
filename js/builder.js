/**
 * OpenClaw Dashboard Builder - Core Logic
 * Handles drag-drop, canvas management, and export
 */

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

const state = {
  canvas: { width: 1920, height: 1080 },
  zoom: 0.5,
  widgets: [],
  selectedWidget: null,
  draggedWidget: null,
  idCounter: 0
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Process widget HTML to conditionally remove header
function processWidgetHtml(html, showHeader) {
  console.log('processWidgetHtml called, showHeader:', showHeader);
  if (showHeader !== false) return html;
  // Remove the dash-card-head element (handles multi-line with newlines)
  const headerRegex = /<div\s+class="dash-card-head"[^>]*>[\s\S]*?<\/div>/i;
  const result = html.replace(headerRegex, '');
  console.log('Header removed, before length:', html.length, 'after:', result.length);
  return result;
}

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initDragDrop();
  initControls();
  initProperties();
  updateCanvasInfo();
});

function initCanvas() {
  const canvas = document.getElementById('canvas');
  updateCanvasSize();
  
  // Canvas click to deselect
  canvas.addEventListener('click', (e) => {
    if (e.target === canvas || e.target.classList.contains('canvas-grid')) {
      selectWidget(null);
    }
  });
}

function updateCanvasSize(preserveZoom = false) {
  const canvas = document.getElementById('canvas');
  const wrapper = document.getElementById('canvas-wrapper');
  
  // Calculate zoom to fit (only if not preserving zoom)
  if (!preserveZoom) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const maxWidth = wrapperRect.width - 80;
    const maxHeight = wrapperRect.height - 80;
    
    const scaleX = maxWidth / state.canvas.width;
    const scaleY = maxHeight / state.canvas.height;
    state.zoom = Math.min(scaleX, scaleY, 0.6);
  }
  
  canvas.style.width = state.canvas.width + 'px';
  canvas.style.height = state.canvas.height + 'px';
  canvas.style.transform = `scale(${state.zoom})`;
  canvas.dataset.width = state.canvas.width;
  canvas.dataset.height = state.canvas.height;
  
  updateCanvasInfo();
}

function setZoom(newZoom) {
  state.zoom = Math.max(0.1, Math.min(2, newZoom)); // Clamp between 10% and 200%
  const canvas = document.getElementById('canvas');
  canvas.style.transform = `scale(${state.zoom})`;
  updateCanvasInfo();
}

function zoomIn() {
  setZoom(state.zoom + 0.1);
}

function zoomOut() {
  setZoom(state.zoom - 0.1);
}

function zoomFit() {
  updateCanvasSize(false); // Recalculate fit zoom
}

function zoom100() {
  setZoom(1);
}

// Expose functions globally for onclick handlers
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.zoomFit = zoomFit;
window.zoom100 = zoom100;
window.deleteWidget = deleteWidget;
window.state = state;

function updateCanvasInfo() {
  document.getElementById('canvas-dimensions').textContent = 
    `${state.canvas.width} × ${state.canvas.height}`;
  document.getElementById('widget-count').textContent = 
    `${state.widgets.length} widget${state.widgets.length !== 1 ? 's' : ''}`;
  document.getElementById('zoom-level').textContent = 
    `${Math.round(state.zoom * 100)}%`;
}

// ─────────────────────────────────────────────
// DRAG & DROP
// ─────────────────────────────────────────────

function initDragDrop() {
  const canvas = document.getElementById('canvas');
  
  // Widget library items
  document.querySelectorAll('.widget-item').forEach(item => {
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragend', onDragEnd);
  });
  
  // Canvas drop zone
  canvas.addEventListener('dragover', onDragOver);
  canvas.addEventListener('dragleave', onDragLeave);
  canvas.addEventListener('drop', onDrop);
}

function onDragStart(e) {
  const widgetType = e.target.dataset.widget;
  e.dataTransfer.setData('widget-type', widgetType);
  e.target.classList.add('dragging');
  state.draggedWidget = widgetType;
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  state.draggedWidget = null;
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('canvas').classList.add('drag-over');
}

function onDragLeave(e) {
  document.getElementById('canvas').classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const canvas = document.getElementById('canvas');
  canvas.classList.remove('drag-over');
  
  const widgetType = e.dataTransfer.getData('widget-type');
  if (!widgetType || !WIDGETS[widgetType]) return;
  
  // Calculate drop position relative to canvas
  const canvasRect = canvas.getBoundingClientRect();
  const x = (e.clientX - canvasRect.left) / state.zoom;
  const y = (e.clientY - canvasRect.top) / state.zoom;
  
  createWidget(widgetType, x, y);
}

// ─────────────────────────────────────────────
// WIDGET MANAGEMENT
// ─────────────────────────────────────────────

function createWidget(type, x, y) {
  const template = WIDGETS[type];
  if (!template) return;
  
  const id = `widget-${++state.idCounter}`;
  
  // Center widget on drop point
  const widget = {
    id,
    type,
    x: Math.max(0, Math.round(x - template.defaultWidth / 2)),
    y: Math.max(0, Math.round(y - template.defaultHeight / 2)),
    width: template.defaultWidth,
    height: template.defaultHeight,
    properties: { ...template.properties }
  };
  
  // Snap to grid (20px)
  widget.x = Math.round(widget.x / 20) * 20;
  widget.y = Math.round(widget.y / 20) * 20;
  
  // Keep in bounds
  widget.x = Math.min(widget.x, state.canvas.width - widget.width);
  widget.y = Math.min(widget.y, state.canvas.height - widget.height);
  
  state.widgets.push(widget);
  renderWidget(widget);
  selectWidget(id);
  updateCanvasInfo();
  
  // Show has-widgets state
  document.getElementById('canvas').classList.add('has-widgets');
}

function renderWidget(widget) {
  const template = WIDGETS[widget.type];
  const canvas = document.getElementById('canvas');
  
  const el = document.createElement('div');
  el.className = 'placed-widget';
  el.id = widget.id;
  el.style.left = widget.x + 'px';
  el.style.top = widget.y + 'px';
  el.style.width = widget.width + 'px';
  el.style.height = widget.height + 'px';
  
  // Generate actual widget HTML for realistic preview
  const props = { ...widget.properties, id: 'preview-' + widget.id };
  const widgetContent = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
  
  el.innerHTML = `
    <div class="widget-render">${widgetContent}</div>
    <div class="resize-handle"></div>
  `;
  
  // Click to select
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectWidget(widget.id);
  });
  
  // Drag to move
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    startDragWidget(e, widget);
  });
  
  // Resize handle
  el.querySelector('.resize-handle').addEventListener('mousedown', (e) => {
    e.stopPropagation();
    startResizeWidget(e, widget);
  });
  
  canvas.appendChild(el);
}

function renderWidgetPreview(widget) {
  const template = WIDGETS[widget.type];
  const el = document.getElementById(widget.id);
  if (!el) return;
  
  const props = { ...widget.properties, id: 'preview-' + widget.id };
  const widgetContent = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
  
  const renderDiv = el.querySelector('.widget-render');
  if (renderDiv) {
    renderDiv.innerHTML = widgetContent;
  }
}

function selectWidget(id) {
  // Deselect previous
  document.querySelectorAll('.placed-widget.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  state.selectedWidget = id ? state.widgets.find(w => w.id === id) : null;
  
  if (state.selectedWidget) {
    document.getElementById(id).classList.add('selected');
    showProperties(state.selectedWidget);
  } else {
    hideProperties();
  }
}

function deleteWidget(id) {
  const idx = state.widgets.findIndex(w => w.id === id);
  if (idx === -1) return;
  
  state.widgets.splice(idx, 1);
  document.getElementById(id)?.remove();
  selectWidget(null);
  updateCanvasInfo();
  
  if (state.widgets.length === 0) {
    document.getElementById('canvas').classList.remove('has-widgets');
  }
}

// ─────────────────────────────────────────────
// WIDGET DRAGGING
// ─────────────────────────────────────────────

function startDragWidget(e, widget) {
  if (e.button !== 0) return;
  
  const el = document.getElementById(widget.id);
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = widget.x;
  const origY = widget.y;
  
  function onMove(e) {
    const dx = (e.clientX - startX) / state.zoom;
    const dy = (e.clientY - startY) / state.zoom;
    
    widget.x = Math.round((origX + dx) / 20) * 20;
    widget.y = Math.round((origY + dy) / 20) * 20;
    
    // Keep in bounds
    widget.x = Math.max(0, Math.min(widget.x, state.canvas.width - widget.width));
    widget.y = Math.max(0, Math.min(widget.y, state.canvas.height - widget.height));
    
    el.style.left = widget.x + 'px';
    el.style.top = widget.y + 'px';
    
    updatePropertyInputs();
  }
  
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startResizeWidget(e, widget) {
  const el = document.getElementById(widget.id);
  const startX = e.clientX;
  const startY = e.clientY;
  const origW = widget.width;
  const origH = widget.height;
  
  function onMove(e) {
    const dw = (e.clientX - startX) / state.zoom;
    const dh = (e.clientY - startY) / state.zoom;
    
    widget.width = Math.round((origW + dw) / 20) * 20;
    widget.height = Math.round((origH + dh) / 20) * 20;
    
    // Minimum size
    widget.width = Math.max(100, widget.width);
    widget.height = Math.max(60, widget.height);
    
    // Keep in bounds
    widget.width = Math.min(widget.width, state.canvas.width - widget.x);
    widget.height = Math.min(widget.height, state.canvas.height - widget.y);
    
    el.style.width = widget.width + 'px';
    el.style.height = widget.height + 'px';
    
    updatePropertyInputs();
  }
  
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─────────────────────────────────────────────
// PROPERTIES PANEL
// ─────────────────────────────────────────────

function initProperties() {
  // Position/size inputs
  ['prop-x', 'prop-y', 'prop-width', 'prop-height'].forEach(id => {
    document.getElementById(id).addEventListener('change', onPropertyChange);
  });
  
  // Title
  document.getElementById('prop-title').addEventListener('input', onPropertyChange);
  
  // Location fields
  document.getElementById('prop-location').addEventListener('input', onPropertyChange);
  document.getElementById('prop-locations').addEventListener('input', onPropertyChange);
  document.getElementById('prop-units').addEventListener('change', onPropertyChange);
  
  // API key and endpoint
  document.getElementById('prop-api-key').addEventListener('input', onPropertyChange);
  document.getElementById('prop-endpoint').addEventListener('input', onPropertyChange);
  document.getElementById('prop-refresh').addEventListener('change', onPropertyChange);
  
  // Show header checkbox
  document.getElementById('prop-show-header').addEventListener('change', onPropertyChange);
  
  // Delete button
  document.getElementById('btn-delete-widget').addEventListener('click', () => {
    if (state.selectedWidget) {
      deleteWidget(state.selectedWidget.id);
    }
  });
}

function showProperties(widget) {
  const template = WIDGETS[widget.type];
  
  document.querySelector('.no-selection').style.display = 'none';
  document.getElementById('properties-form').style.display = 'block';
  
  document.getElementById('prop-type').value = template.name;
  document.getElementById('prop-title').value = widget.properties.title || '';
  document.getElementById('prop-show-header').checked = widget.properties.showHeader !== false; // default true
  
  updatePropertyInputs();
  
  // Hide all optional groups first
  document.getElementById('prop-api-group').style.display = 'none';
  document.getElementById('prop-endpoint-group').style.display = 'none';
  document.getElementById('prop-location-group').style.display = 'none';
  document.getElementById('prop-locations-group').style.display = 'none';
  document.getElementById('prop-units-group').style.display = 'none';
  
  // Show location field (single)
  if (widget.properties.location !== undefined) {
    document.getElementById('prop-location-group').style.display = 'block';
    document.getElementById('prop-location').value = widget.properties.location || '';
  }
  
  // Show locations field (multi)
  if (widget.properties.locations !== undefined) {
    document.getElementById('prop-locations-group').style.display = 'block';
    document.getElementById('prop-locations').value = widget.properties.locations || '';
  }
  
  // Show units field
  if (widget.properties.units !== undefined) {
    document.getElementById('prop-units-group').style.display = 'block';
    document.getElementById('prop-units').value = widget.properties.units || 'F';
  }
  
  // Show API fields
  if (template.hasApiKey) {
    document.getElementById('prop-api-group').style.display = 'block';
    document.getElementById('prop-api-key').value = template.apiKeyName || '';
  }
  
  // Show endpoint field
  if (widget.properties.endpoint !== undefined) {
    document.getElementById('prop-endpoint-group').style.display = 'block';
    document.getElementById('prop-endpoint').value = widget.properties.endpoint || '';
  }
  
  document.getElementById('prop-refresh').value = widget.properties.refreshInterval || 60;
}

function hideProperties() {
  document.querySelector('.no-selection').style.display = 'block';
  document.getElementById('properties-form').style.display = 'none';
}

function updatePropertyInputs() {
  if (!state.selectedWidget) return;
  
  document.getElementById('prop-x').value = state.selectedWidget.x;
  document.getElementById('prop-y').value = state.selectedWidget.y;
  document.getElementById('prop-width').value = state.selectedWidget.width;
  document.getElementById('prop-height').value = state.selectedWidget.height;
}

function onPropertyChange(e) {
  if (!state.selectedWidget) return;
  
  const widget = state.selectedWidget;
  const el = document.getElementById(widget.id);
  
  switch (e.target.id) {
    case 'prop-x':
      widget.x = parseInt(e.target.value) || 0;
      el.style.left = widget.x + 'px';
      break;
    case 'prop-y':
      widget.y = parseInt(e.target.value) || 0;
      el.style.top = widget.y + 'px';
      break;
    case 'prop-width':
      widget.width = parseInt(e.target.value) || 100;
      el.style.width = widget.width + 'px';
      break;
    case 'prop-height':
      widget.height = parseInt(e.target.value) || 60;
      el.style.height = widget.height + 'px';
      break;
    case 'prop-title':
      widget.properties.title = e.target.value;
      break;
    case 'prop-show-header':
      widget.properties.showHeader = e.target.checked;
      renderWidgetPreview(widget);
      break;
    case 'prop-location':
      widget.properties.location = e.target.value;
      break;
    case 'prop-locations':
      widget.properties.locations = e.target.value;
      break;
    case 'prop-units':
      widget.properties.units = e.target.value;
      break;
    case 'prop-endpoint':
      widget.properties.endpoint = e.target.value;
      break;
    case 'prop-refresh':
      widget.properties.refreshInterval = parseInt(e.target.value) || 60;
      break;
  }
}

// ─────────────────────────────────────────────
// CONTROLS
// ─────────────────────────────────────────────

function initControls() {
  // Canvas size selector
  document.getElementById('canvas-size').addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      document.getElementById('custom-width').style.display = 'inline-block';
      document.getElementById('custom-x').style.display = 'inline-block';
      document.getElementById('custom-height').style.display = 'inline-block';
    } else {
      document.getElementById('custom-width').style.display = 'none';
      document.getElementById('custom-x').style.display = 'none';
      document.getElementById('custom-height').style.display = 'none';
      
      const [w, h] = e.target.value.split('x').map(Number);
      state.canvas.width = w;
      state.canvas.height = h;
      updateCanvasSize();
    }
  });
  
  // Custom size inputs
  ['custom-width', 'custom-height'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      state.canvas.width = parseInt(document.getElementById('custom-width').value) || 1920;
      state.canvas.height = parseInt(document.getElementById('custom-height').value) || 1080;
      updateCanvasSize();
    });
  });
  
  // Clear button
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Clear all widgets?')) {
      state.widgets.forEach(w => document.getElementById(w.id)?.remove());
      state.widgets = [];
      selectWidget(null);
      updateCanvasInfo();
      document.getElementById('canvas').classList.remove('has-widgets');
    }
  });
  
  // Preview button
  document.getElementById('btn-preview').addEventListener('click', showPreview);
  
  // Export button
  document.getElementById('btn-export').addEventListener('click', exportDashboard);
  
  // Close preview
  document.getElementById('close-preview').addEventListener('click', () => {
    document.getElementById('preview-modal').classList.remove('active');
  });
  
  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('zoom-fit').addEventListener('click', zoomFit);
  document.getElementById('zoom-100').addEventListener('click', zoom100);
  
  // Keyboard shortcuts for zoom
  document.addEventListener('keydown', (e) => {
    // Check if not typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      zoom100();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      zoomFit();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedWidget) {
        e.preventDefault();
        deleteWidget(state.selectedWidget.id);
      }
    }
  });
  
  // Mouse wheel zoom (with Ctrl/Cmd)
  document.getElementById('canvas-wrapper').addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  }, { passive: false });
}

// ─────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────

function showPreview() {
  const css = generateDashboardCss();
  const js = generateDashboardJs();
  
  const widgetHtml = state.widgets.map(widget => {
    const template = WIDGETS[widget.type];
    if (!template) return '';
    
    console.log('Preview widget:', widget.id, 'showHeader:', widget.properties.showHeader);
    const props = { ...widget.properties, id: widget.id };
    let html = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
    
    return `
      <div class="widget-container" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;">
        ${html}
      </div>`;
  }).join('\n');
  
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Preview</title>
  <style>${css}</style>
</head>
<body>
  <main class="dashboard" style="width:${state.canvas.width}px;height:${state.canvas.height}px;position:relative;">
    ${widgetHtml}
  </main>
  <script>${js}</script>
</body>
</html>`;
  
  const frame = document.getElementById('preview-frame');
  frame.srcdoc = previewHtml;
  document.getElementById('preview-modal').classList.add('active');
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

async function exportDashboard() {
  const html = generateDashboardHtml();
  const css = generateDashboardCss();
  const js = generateDashboardJs();
  
  // Create ZIP using JSZip (loaded dynamically)
  if (!window.JSZip) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }
  
  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('css/style.css', css);
  zip.file('js/dashboard.js', js);
  zip.file('README.md', generateReadme());
  
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'openclaw-dashboard.zip';
  a.click();
  URL.revokeObjectURL(url);
}

function generateDashboardHtml() {
  const widgetHtml = state.widgets.map(widget => {
    const template = WIDGETS[widget.type];
    if (!template) return '';
    
    const props = { ...widget.properties, id: widget.id };
    let html = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
    
    // Wrap in positioned container
    return `
      <div class="widget-container" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;">
        ${html}
      </div>`;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My OpenClaw Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main class="dashboard" style="width:${state.canvas.width}px;height:${state.canvas.height}px;position:relative;">
    ${widgetHtml}
  </main>
  <script src="js/dashboard.js"></script>
</body>
</html>`;
}

function generateDashboardCss() {
  return `/* OpenClaw Dashboard - Generated Styles */

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

/* Ring */
.kpi-ring-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-ring-sm {
  width: 48px;
  height: 48px;
}

.kpi-ring {
  width: 100%;
  height: 100%;
}

.kpi-ring-label {
  position: absolute;
  font-size: 14px;
  font-weight: 600;
}

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

/* News Ticker */
.news-ticker-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
}

.ticker-label {
  font-size: 16px;
}

.ticker-track {
  flex: 1;
  overflow: hidden;
}

.ticker-content {
  white-space: nowrap;
  animation: ticker 30s linear infinite;
  font-size: 13px;
  color: var(--text-secondary);
}

@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
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

.event-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

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

.usage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.usage-row:last-child {
  border-bottom: none;
}

.usage-tokens {
  font-weight: 600;
  color: var(--text-primary);
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
`;
}

function generateDashboardJs() {
  const widgetJs = state.widgets.map(widget => {
    const template = WIDGETS[widget.type];
    if (!template || !template.generateJs) return '';
    
    const props = { ...widget.properties, id: widget.id };
    return template.generateJs(props);
  }).join('\n\n');
  
  return `/**
 * OpenClaw Dashboard - Generated JavaScript
 * Replace YOUR_*_API_KEY placeholders with your actual API keys
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');
});

${widgetJs}
`;
}

function generateReadme() {
  const apiKeys = [];
  state.widgets.forEach(widget => {
    const template = WIDGETS[widget.type];
    if (template?.hasApiKey && template.apiKeyName) {
      if (!apiKeys.includes(template.apiKeyName)) {
        apiKeys.push(template.apiKeyName);
      }
    }
  });
  
  return `# OpenClaw Dashboard

This dashboard was generated with the OpenClaw Dashboard Builder.

## Setup

1. Extract all files to a folder
2. Open \`js/dashboard.js\` and replace the API key placeholders:
${apiKeys.map(key => `   - \`YOUR_${key}\``).join('\n') || '   - (No API keys required)'}
3. Serve the folder with any static file server, or just open \`index.html\`

## Files

- \`index.html\` - Main dashboard page
- \`css/style.css\` - Styles
- \`js/dashboard.js\` - Widget logic and API calls

## Customization

Edit the CSS variables in \`style.css\` to change colors:

\`\`\`css
:root {
  --bg-primary: #0d1117;
  --accent-blue: #58a6ff;
  /* etc */
}
\`\`\`

## Learn More

- OpenClaw: https://github.com/openclaw/openclaw
- Dashboard Builder: https://clawhub.com

Generated: ${new Date().toISOString()}
`;
}

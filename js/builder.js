/**
 * OpenClaw Dashboard Builder - Core Logic
 * Handles drag-drop, canvas management, and export
 */

// ─────────────────────────────────────────────
// SECURITY HELPERS
// ─────────────────────────────────────────────

// Escape HTML to prevent XSS attacks
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

const state = {
  canvas: { width: 1920, height: 1080 },
  zoom: 0.5,
  widgets: [],
  selectedWidget: null,
  draggedWidget: null,
  idCounter: 0,
  fontScale: 1,
  editMode: false, // New: Track edit mode state
  pinVerified: false, // Track if PIN has been verified this session
  hasPin: false, // Whether a PIN is configured
  publicMode: false // Whether public mode is enabled
};

// ─────────────────────────────────────────────
// SCROLLABLE / UNLIMITED HEIGHT HELPERS
// ─────────────────────────────────────────────

function isScrollableMode() {
  return state.canvas.height === 'auto';
}

/** Return the pixel height the canvas should actually use (based on lowest widget + padding). */
function getScrollableCanvasHeight() {
  if (!state.widgets.length) return 1080; // sensible default when empty
  let maxBottom = 0;
  state.widgets.forEach(w => {
    const bottom = w.y + w.height;
    if (bottom > maxBottom) maxBottom = bottom;
  });
  return maxBottom + 100; // 100px breathing room below lowest widget
}

// ─────────────────────────────────────────────
// EDIT MODE
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// PIN & PUBLIC MODE
// ─────────────────────────────────────────────

function addPublicUnlockButton() {
  let unlock = document.getElementById('public-unlock');
  if (unlock) return; // already exists
  unlock = document.createElement('button');
  unlock.id = 'public-unlock';
  unlock.textContent = '🔒';
  unlock.title = 'Admin';
  unlock.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;background:transparent;border:none;color:#6e7681;font-size:12px;cursor:pointer;opacity:0.3;transition:opacity .2s;padding:4px;';
  unlock.addEventListener('mouseenter', () => unlock.style.opacity = '0.8');
  unlock.addEventListener('mouseleave', () => unlock.style.opacity = '0.3');
  unlock.addEventListener('click', () => {
    if (state.hasPin) {
      showPinModal('verify');
    } else {
      openSecurityModal();
    }
  });
  document.body.appendChild(unlock);
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    state.hasPin = data.hasPin;
    state.publicMode = data.publicMode;
    if (state.publicMode) {
      const editBtn = document.getElementById('btn-edit-layout');
      if (editBtn) editBtn.style.display = 'none';
      addPublicUnlockButton();
    }
  } catch (e) { console.error('Auth status check failed:', e); }
}

function showPinModal(mode) {
  // mode: 'verify', 'set', 'change', 'remove'
  const modal = document.getElementById('pin-modal');
  const title = document.getElementById('pin-modal-title');
  const input = document.getElementById('pin-input');
  const input2 = document.getElementById('pin-input-confirm');
  const currentInput = document.getElementById('pin-input-current');
  const error = document.getElementById('pin-error');
  const confirmGroup = document.getElementById('pin-confirm-group');
  const currentGroup = document.getElementById('pin-current-group');

  error.textContent = '';
  input.value = '';
  input2.value = '';
  currentInput.value = '';

  if (mode === 'verify') {
    title.textContent = '🔒 Enter PIN to Edit';
    confirmGroup.style.display = 'none';
    currentGroup.style.display = 'none';
  } else if (mode === 'set') {
    title.textContent = '🔐 Set Edit PIN';
    confirmGroup.style.display = 'block';
    currentGroup.style.display = 'none';
  } else if (mode === 'change') {
    title.textContent = '🔄 Change PIN';
    confirmGroup.style.display = 'block';
    currentGroup.style.display = 'block';
  } else if (mode === 'remove') {
    title.textContent = '🗑️ Remove PIN';
    confirmGroup.style.display = 'none';
    currentGroup.style.display = 'block';
    input.parentElement.style.display = 'none';
  }

  modal.style.display = 'flex';
  modal.dataset.mode = mode;
  setTimeout(() => (mode === 'change' || mode === 'remove' ? currentInput : input).focus(), 100);
}

function closePinModal() {
  const modal = document.getElementById('pin-modal');
  modal.style.display = 'none';
  // Restore visibility of new PIN input
  document.getElementById('pin-input').parentElement.style.display = '';
  // Clear any pending public mode callback
  if (state._publicModeCallback) {
    state._publicModeCallback = null;
    const toggle = document.getElementById('public-mode-toggle');
    if (toggle) toggle.checked = state.publicMode;
  }
}

async function submitPin() {
  const modal = document.getElementById('pin-modal');
  const mode = modal.dataset.mode;
  const pin = document.getElementById('pin-input').value;
  const pin2 = document.getElementById('pin-input-confirm').value;
  const currentPin = document.getElementById('pin-input-current').value;
  const error = document.getElementById('pin-error');
  error.textContent = '';

  if (mode === 'verify') {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.valid) {
      state.pinVerified = true;
      // If there's a pending public mode toggle, handle that instead of entering edit mode
      if (state._publicModeCallback) {
        const callback = state._publicModeCallback;
        state._publicModeCallback = null; // clear before closePinModal tries to
        closePinModal();
        await callback(pin);
        return;
      }
      // If in public mode (unlock button clicked), disable it and restore edit UI
      if (state.publicMode) {
        state.publicMode = false;
        await fetch('/api/mode', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicMode: false, pin })
        });
        const editBtn = document.getElementById('btn-edit-layout');
        if (editBtn) editBtn.style.display = '';
        const unlock = document.getElementById('public-unlock');
        if (unlock) unlock.remove();
        const pubToggle = document.getElementById('public-mode-toggle');
        if (pubToggle) pubToggle.checked = false;
      }
      closePinModal();
      setEditMode(true);
    } else {
      error.textContent = 'Incorrect PIN';
    }
  } else if (mode === 'set') {
    if (pin !== pin2) { error.textContent = 'PINs do not match'; return; }
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { error.textContent = 'PIN must be 4-6 digits'; return; }
    const res = await fetch('/api/auth/set-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      state.hasPin = true;
      state.pinVerified = true;
      closePinModal();
      setEditMode(true);
    } else { error.textContent = data.error || 'Failed to set PIN'; }
  } else if (mode === 'change') {
    if (pin !== pin2) { error.textContent = 'New PINs do not match'; return; }
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { error.textContent = 'PIN must be 4-6 digits'; return; }
    const res = await fetch('/api/auth/set-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, currentPin })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      closePinModal();
      alert('PIN changed successfully');
    } else { error.textContent = data.error || 'Failed to change PIN'; }
  } else if (mode === 'remove') {
    const res = await fetch('/api/auth/remove-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: currentPin })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      state.hasPin = false;
      closePinModal();
      alert('PIN removed');
    } else { error.textContent = data.error || 'Failed to remove PIN'; }
  }
}

async function requestEditMode() {
  if (state.publicMode) { alert('Dashboard is in public mode. Editing is disabled.'); return; }
  if (state.hasPin && !state.pinVerified) {
    showPinModal('verify');
  } else if (!state.hasPin) {
    // No PIN set — offer to set one, or go straight to edit
    setEditMode(true);
  } else {
    setEditMode(true);
  }
}

function openSecurityModal() {
  const modal = document.getElementById('security-modal');
  const pinStatus = document.getElementById('pin-status');
  const setBtn = document.getElementById('sec-set-pin');
  const changeBtn = document.getElementById('sec-change-pin');
  const removeBtn = document.getElementById('sec-remove-pin');
  const publicToggle = document.getElementById('public-mode-toggle');

  if (state.hasPin) {
    pinStatus.textContent = 'Active';
    pinStatus.className = 'security-badge active';
    setBtn.style.display = 'none';
    changeBtn.style.display = '';
    removeBtn.style.display = '';
  } else {
    pinStatus.textContent = 'Not Set';
    pinStatus.className = 'security-badge';
    setBtn.style.display = '';
    changeBtn.style.display = 'none';
    removeBtn.style.display = 'none';
  }
  publicToggle.checked = state.publicMode;
  modal.style.display = 'flex';
}

function setEditMode(enable) {
  state.editMode = enable;
  document.body.dataset.mode = enable ? 'edit' : 'view';

  // Toggle button text and handler
  const editLayoutBtn = document.getElementById('btn-edit-layout');
  const saveBtn = document.getElementById('btn-save');

  if (enable) {
    stopWidgetScripts();
    editLayoutBtn.style.display = 'none';
    saveBtn.textContent = '💾 Save';
    saveBtn.removeEventListener('click', exportDashboard);
    saveBtn.addEventListener('click', saveConfig);
    // Ensure builder panels are visible in edit mode
    document.querySelector('.builder-header').style.display = 'flex';
    document.querySelector('.widget-panel').style.display = 'flex';
    document.getElementById('properties-panel').style.display = 'flex';
    document.querySelector('.canvas-info').style.display = 'flex';
    document.getElementById('canvas-wrapper').style.padding = '40px'; // Restore padding
    document.getElementById('canvas').style.border = '2px solid var(--border)'; // Restore border
    document.getElementById('canvas').style.borderRadius = '8px'; // Restore border radius
    document.getElementById('canvas').style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)'; // Restore shadow
    document.querySelector('.canvas-grid').style.display = 'block'; // Show grid
    document.querySelector('.drop-hint').style.display = 'flex'; // Show drop hint
  } else {
    editLayoutBtn.style.display = state.publicMode ? 'none' : 'block';
    saveBtn.textContent = '📦 Export ZIP';
    saveBtn.removeEventListener('click', saveConfig);
    saveBtn.addEventListener('click', exportDashboard);
    // Hide builder panels in view mode
    document.querySelector('.builder-header').style.display = 'none';
    document.querySelector('.widget-panel').style.display = 'none';
    document.getElementById('properties-panel').style.display = 'none';
    document.querySelector('.canvas-info').style.display = 'none';
    document.getElementById('canvas-wrapper').style.padding = '0'; // Remove padding
    document.getElementById('canvas').style.border = 'none'; // Remove border
    document.getElementById('canvas').style.borderRadius = '0'; // Remove border radius
    document.getElementById('canvas').style.boxShadow = 'none'; // Remove shadow
    document.querySelector('.canvas-grid').style.display = 'none'; // Hide grid
    document.querySelector('.drop-hint').style.display = 'none'; // Hide drop hint
  }
  // Re-render widgets to apply new pointer-events
  state.widgets.forEach(widget => {
    const el = document.getElementById(widget.id);
    if (el) {
      el.querySelector('.widget-render').style.pointerEvents = enable ? 'none' : 'auto';
      el.querySelector('.resize-handle').style.display = enable ? 'block' : 'none';
      if (enable) {
        el.style.cursor = 'move';
        el.classList.add('builder-edit-mode'); // Add class for styling in edit mode
      } else {
        el.style.cursor = 'default';
        el.classList.remove('builder-edit-mode'); // Remove class in view mode
      }
    }
  });
  selectWidget(null); // Deselect any widget when mode changes
  updateEmptyState();
  if (!enable) {
    scaleCanvasToFit();
    if (state.widgets.length > 0) {
      executeWidgetScripts();
    }
  } else {
    // Restore edit mode zoom
    const canvas = document.getElementById('canvas');
    canvas.style.transform = `scale(${state.zoom})`;
  }
}

// Execute widget JS for live preview (view mode)
function executeWidgetScripts() {
  // Clear any existing intervals from previous executions
  if (window._widgetIntervals) {
    window._widgetIntervals.forEach(id => clearInterval(id));
  }
  window._widgetIntervals = [];

  // Override setInterval to track widget intervals
  const origSetInterval = window.setInterval;
  window.setInterval = function(fn, ms) {
    const id = origSetInterval(fn, ms);
    window._widgetIntervals.push(id);
    return id;
  };

  state.widgets.forEach(widget => {
    const template = WIDGETS[widget.type];
    if (!template || !template.generateJs) return;
    const props = sanitizeProps({ ...widget.properties, id: 'preview-' + widget.id });
    try {
      const js = template.generateJs(props);
      new Function(js)();
    } catch (e) {
      console.error(`Widget ${widget.type} script error:`, e);
    }
  });

  // Restore original setInterval
  window.setInterval = origSetInterval;
}

function stopWidgetScripts() {
  if (window._widgetIntervals) {
    window._widgetIntervals.forEach(id => clearInterval(id));
    window._widgetIntervals = [];
  }
  // Reset SSE connection so it reconnects fresh on next view
  if (_statsSource) {
    _statsSource.close();
    _statsSource = null;
    _statsCallbacks = [];
  }
}

function scaleCanvasToFit() {
  const canvas = document.getElementById('canvas');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cw = state.canvas.width;

  if (isScrollableMode()) {
    // Scrollable: scale width to fit viewport, height scrolls naturally
    const effectiveHeight = getScrollableCanvasHeight();
    canvas.style.height = effectiveHeight + 'px';
    const scale = vw / cw;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
    const scaledW = cw * scale;
    const offsetX = Math.max(0, (vw - scaledW) / 2);
    canvas.style.marginLeft = offsetX + 'px';
    canvas.style.marginTop = '0px';
    // Set wrapper height so page scrolls
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.height = (effectiveHeight * scale) + 'px';
    return;
  }

  const ch = state.canvas.height;
  const scale = Math.min(vw / cw, vh / ch);
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'top left';
  // Center if there's leftover space
  const scaledW = cw * scale;
  const scaledH = ch * scale;
  const offsetX = Math.max(0, (vw - scaledW) / 2);
  const offsetY = Math.max(0, (vh - scaledH) / 2);
  canvas.style.marginLeft = offsetX + 'px';
  canvas.style.marginTop = offsetY + 'px';
}

// Re-scale on window resize in view mode
window.addEventListener('resize', () => {
  if (!state.editMode) scaleCanvasToFit();
});

function updateEmptyState() {
  if (state.widgets.length === 0) {
    document.body.classList.add('empty-dashboard');
  } else {
    document.body.classList.remove('empty-dashboard');
  }
}

// ─────────────────────────────────────────────
// CONFIG MANAGEMENT
// ─────────────────────────────────────────────

async function loadConfig() {
  try {
    const response = await fetch('/config');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const config = await response.json();
    
    state.canvas = config.canvas || { width: 1920, height: 1080 };
    state.fontScale = config.fontScale || 1;

    // Restore canvas size dropdown to match loaded config
    const sizeSelect = document.getElementById('canvas-size');
    if (state.canvas.height === 'auto') {
      sizeSelect.value = 'scrollable';
    } else {
      const sizeKey = state.canvas.width + 'x' + state.canvas.height;
      if (sizeSelect.querySelector(`option[value="${sizeKey}"]`)) {
        sizeSelect.value = sizeKey;
      } else {
        sizeSelect.value = 'custom';
      }
    }
    state.widgets = config.widgets || [];
    document.documentElement.style.setProperty('--font-scale', state.fontScale);
    const fontScaleEl = document.getElementById('font-scale');
    if (fontScaleEl) fontScaleEl.value = String(state.fontScale);
    state.idCounter = state.widgets.reduce((maxId, w) => Math.max(maxId, parseInt(w.id.replace('widget-', ''))), 0);

    updateCanvasSize(true); // Preserve zoom on load
    state.widgets.forEach(widget => {
      try {
        renderWidget(widget);
      } catch (e) {
        console.error(`Failed to render widget ${widget.id} (type: ${widget.type}):`, e);
      }
    });
    updateCanvasInfo();
    if (state.widgets.length > 0) {
      document.getElementById('canvas').classList.add('has-widgets');
    }
    console.log('Dashboard config loaded successfully.');
    setEditMode(false); // Start in view mode
    if (state.widgets.length > 0) {
      executeWidgetScripts();
    }
  } catch (error) {
    console.error('Failed to load dashboard config:', error);
    // If config fails to load, start in edit mode with a blank canvas
    setEditMode(true);
  }
}

async function saveConfig() {
  try {
    const configToSave = {
      canvas: state.canvas,
      fontScale: state.fontScale || 1,
      widgets: state.widgets
    };
    const response = await fetch('/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configToSave)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    console.log('Dashboard config saved successfully:', result);
    alert('Dashboard layout saved!');
  } catch (error) {
    console.error('Failed to save dashboard config:', error);
    alert('Failed to save dashboard layout. See console for details.');
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Process widget HTML to conditionally remove header
function processWidgetHtml(html, showHeader) {
  if (showHeader !== false) return html;
  // Remove the dash-card-head element (handles multi-line with newlines)
  const headerRegex = /<div\s+class="dash-card-head"[^>]*>[\s\S]*?<\/div>/i;
  return html.replace(headerRegex, '');
}

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initDragDrop();
  initControls();
  initProperties();
  loadConfig(); // New: Load config on startup
  // setEditMode(false) is called inside loadConfig()

  // Initialize Edit Layout button
  document.getElementById('btn-edit-layout').addEventListener('click', requestEditMode);
  document.getElementById('btn-done-editing').addEventListener('click', () => {
    saveConfig();
    setEditMode(false);
  });

  // PIN modal buttons
  document.getElementById('pin-submit').addEventListener('click', submitPin);
  document.getElementById('pin-cancel').addEventListener('click', closePinModal);
  document.getElementById('pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });
  document.getElementById('pin-input-confirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });
  document.getElementById('pin-input-current').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });

  // Check auth status on load
  checkAuthStatus();

  // Security modal
  document.getElementById('btn-security').addEventListener('click', openSecurityModal);
  document.getElementById('sec-close').addEventListener('click', () => {
    document.getElementById('security-modal').style.display = 'none';
  });
  document.getElementById('sec-set-pin').addEventListener('click', () => {
    document.getElementById('security-modal').style.display = 'none';
    showPinModal('set');
  });
  document.getElementById('sec-change-pin').addEventListener('click', () => {
    document.getElementById('security-modal').style.display = 'none';
    showPinModal('change');
  });
  document.getElementById('sec-remove-pin').addEventListener('click', () => {
    document.getElementById('security-modal').style.display = 'none';
    showPinModal('remove');
  });
  document.getElementById('public-mode-toggle').addEventListener('change', async (e) => {
    const enable = e.target.checked;
    if (enable && !confirm('Enable Public Mode? This will hide the Edit button and block config APIs.')) {
      e.target.checked = false; return;
    }
    if (state.hasPin) {
      // Use PIN modal instead of prompt() so input is masked
      state._pendingPublicMode = enable;
      document.getElementById('security-modal').style.display = 'none';
      showPinModal('verify');
      // Override the verify handler temporarily
      state._publicModeCallback = async (pin) => {
        const res = await fetch('/api/mode', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicMode: enable, pin })
        });
        const data = await res.json();
        if (data.status === 'ok') {
          state.publicMode = data.publicMode;
          state._publicModeCallback = null;
          // Reload page for clean state
          location.reload();
          return;
        } else {
          e.target.checked = !enable;
          alert(data.error || 'Failed to change mode');
        }
        state._publicModeCallback = null;
      };
    } else {
      const res = await fetch('/api/mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicMode: enable })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        state.publicMode = data.publicMode;
        if (data.publicMode) {
          setEditMode(false);
          document.getElementById('btn-edit-layout').style.display = 'none';
          document.getElementById('security-modal').style.display = 'none';
        } else {
          document.getElementById('btn-edit-layout').style.display = '';
        }
      } else {
        e.target.checked = !enable;
        alert(data.error || 'Failed to change mode');
      }
    }
  });
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
  const effectiveHeight = isScrollableMode() ? getScrollableCanvasHeight() : state.canvas.height;

  // Calculate zoom to fit (only if not preserving zoom)
  if (!preserveZoom) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const maxWidth = wrapperRect.width - 80;
    const maxHeight = wrapperRect.height - 80;

    const scaleX = maxWidth / state.canvas.width;
    const scaleY = maxHeight / effectiveHeight;
    state.zoom = Math.min(scaleX, scaleY, 0.6);
  }

  canvas.style.width = state.canvas.width + 'px';
  canvas.style.height = isScrollableMode() ? effectiveHeight + 'px' : state.canvas.height + 'px';
  canvas.style.transform = `scale(${state.zoom})`;
  canvas.dataset.width = state.canvas.width;
  canvas.dataset.height = isScrollableMode() ? 'auto' : state.canvas.height;

  // Toggle scrollable class on body
  document.body.classList.toggle('canvas-scrollable', isScrollableMode());

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
    `${state.canvas.width} × ${isScrollableMode() ? '∞ (scrollable)' : state.canvas.height}`;
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

  // Widget library items — add privacy badges
  document.querySelectorAll('.widget-item').forEach(item => {
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragend', onDragEnd);
    const widgetType = item.dataset.widget;
    const widgetDef = WIDGETS[widgetType];
    if (widgetDef && widgetDef.privacyWarning) {
      const nameEl = item.querySelector('.widget-name');
      if (nameEl && !nameEl.querySelector('.privacy-badge')) {
        const badge = document.createElement('span');
        badge.className = 'privacy-badge';
        badge.textContent = ' ⚠️';
        badge.title = 'May expose sensitive data when dashboard is public';
        badge.style.cssText = 'font-size:10px;cursor:help;';
        nameEl.appendChild(badge);
      }
    }
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
    properties: JSON.parse(JSON.stringify(template.properties))
  };

  // Snap to grid (20px)
  widget.x = Math.round(widget.x / 20) * 20;
  widget.y = Math.round(widget.y / 20) * 20;

  // Keep in bounds
  widget.x = Math.min(widget.x, state.canvas.width - widget.width);
  if (!isScrollableMode()) {
    widget.y = Math.min(widget.y, state.canvas.height - widget.height);
  }

  state.widgets.push(widget);

  // In scrollable mode, grow canvas to fit new widget
  if (isScrollableMode()) {
    updateCanvasSize(true);
  }
  renderWidget(widget);
  updateEmptyState();
  selectWidget(id);
  updateCanvasInfo();

  // Show has-widgets state
  document.getElementById('canvas').classList.add('has-widgets');
}

function applyWidgetFontScale(widget) {
  const el = document.getElementById(widget.id);
  if (!el) return;
  const body = el.querySelector('.dash-card-body');
  const render = el.querySelector('.widget-render');
  const adjustment = widget.properties.widgetFontAdjust || 0; // e.g. -25, -10, 0, +10, +25
  if (adjustment !== 0) {
    // Compute effective scale: global + adjustment (additive percentage points)
    const globalScale = state.fontScale || 1;
    const effectiveScale = globalScale + (adjustment / 100);
    // Set --font-scale override on widget body content only (header stays at global)
    const target = body || render;
    if (target) {
      target.style.setProperty('--font-scale', effectiveScale);
      target.style.fontSize = (effectiveScale * 100) + '%';
    }
  } else {
    // No adjustment — inherit global
    const target = body || render;
    if (target) {
      target.style.removeProperty('--font-scale');
      target.style.removeProperty('font-size');
    }
  }
}

function renderWidget(widget) {
  const template = WIDGETS[widget.type];
  if (!template) {
    console.warn(`renderWidget: unknown widget type "${widget.type}" (${widget.id}), skipping`);
    return;
  }
  const canvas = document.getElementById('canvas');

  const el = document.createElement('div');
  el.className = 'placed-widget';
  el.dataset.type = widget.type;
  if (widget.type === 'text-header') {
    el.dataset.showBorder = widget.properties.showBorder ? 'true' : 'false';
  }
  if (widget.type === 'pages-menu' && widget.properties.showBorder === false) {
    el.dataset.showBorder = 'false';
  }
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

  // Apply initial edit mode styles
  if (state.editMode) {
    el.querySelector('.widget-render').style.pointerEvents = 'none';
    el.querySelector('.resize-handle').style.display = 'block';
    el.style.cursor = 'move';
    el.classList.add('builder-edit-mode');
  } else {
    el.querySelector('.widget-render').style.pointerEvents = 'auto';
    el.querySelector('.resize-handle').style.display = 'none';
    el.style.cursor = 'default';
    el.classList.remove('builder-edit-mode');
  }

  // Click to select
  el.addEventListener('click', (e) => {
    if (state.editMode) {
      e.stopPropagation();
      selectWidget(widget.id);
    }
  });

  // Drag to move
  el.addEventListener('mousedown', (e) => {
    if (state.editMode) {
      if (e.target.classList.contains('resize-handle')) return;
      startDragWidget(e, widget);
    }
  });

  // Resize handle
  el.querySelector('.resize-handle').addEventListener('mousedown', (e) => {
    if (state.editMode) {
      e.stopPropagation();
      startResizeWidget(e, widget);
    }
  });

  canvas.appendChild(el);
  applyWidgetFontScale(widget);
}

function renderWidgetPreview(widget) {
  const template = WIDGETS[widget.type];
  const el = document.getElementById(widget.id);
  if (!el) return;

  if (widget.type === 'text-header') {
    el.dataset.showBorder = widget.properties.showBorder ? 'true' : 'false';
  }

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
  updateEmptyState();

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
    if (isScrollableMode()) {
      widget.y = Math.max(0, widget.y);
    } else {
      widget.y = Math.max(0, Math.min(widget.y, state.canvas.height - widget.height));
    }

    el.style.left = widget.x + 'px';
    el.style.top = widget.y + 'px';

    // In scrollable mode, grow canvas to fit
    if (isScrollableMode()) {
      updateCanvasSize(true);
    }

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
    if (!isScrollableMode()) {
      widget.height = Math.min(widget.height, state.canvas.height - widget.y);
    }

    el.style.width = widget.width + 'px';
    el.style.height = widget.height + 'px';

    // In scrollable mode, grow canvas to fit
    if (isScrollableMode()) {
      updateCanvasSize(true);
    }

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
  document.getElementById('prop-api-key-value').addEventListener('input', onPropertyChange);
  document.getElementById('prop-endpoint').addEventListener('input', onPropertyChange);
  if (document.getElementById('prop-directorypath')) {
    document.getElementById('prop-directorypath').addEventListener('input', onPropertyChange);
    document.getElementById('btn-browse-dir').addEventListener('click', () => openDirBrowser());
  }
  document.getElementById('prop-refresh').addEventListener('change', onPropertyChange);
  document.getElementById('prop-widgetfontscale').addEventListener('change', onPropertyChange);
  document.getElementById('prop-timeformat').addEventListener('change', onPropertyChange);

  // Show header checkbox
  document.getElementById('prop-show-header').addEventListener('change', onPropertyChange);

  // Countdown-specific fields
  document.getElementById('prop-targetdate').addEventListener('change', onPropertyChange);
  document.getElementById('prop-show-hours').addEventListener('change', onPropertyChange);
  document.getElementById('prop-show-minutes').addEventListener('change', onPropertyChange);

  // Pomodoro-specific fields
  document.getElementById('prop-work-minutes').addEventListener('change', onPropertyChange);
  document.getElementById('prop-break-minutes').addEventListener('change', onPropertyChange);

  // Show border checkbox
  document.getElementById('prop-showborder').addEventListener('change', onPropertyChange);

  // Columns
  document.getElementById('prop-columns').addEventListener('change', onPropertyChange);

  // Feed URL
  document.getElementById('prop-feedurl').addEventListener('change', onPropertyChange);
  document.getElementById('prop-layout').addEventListener('change', onPropertyChange);

  // Text header fields
  document.getElementById('prop-fontsize').addEventListener('change', onPropertyChange);
  document.getElementById('prop-fontcolor').addEventListener('input', onPropertyChange);
  document.getElementById('prop-textalign').addEventListener('change', onPropertyChange);
  document.getElementById('prop-fontweight').addEventListener('change', onPropertyChange);

  // Line fields
  document.getElementById('prop-linecolor').addEventListener('input', onPropertyChange);
  document.getElementById('prop-linethickness').addEventListener('change', onPropertyChange);

  // Image embed fields
  document.getElementById('prop-imagepath').addEventListener('input', onPropertyChange);
  document.getElementById('prop-imagefile').addEventListener('change', onImageFileSelect);
  document.getElementById('prop-imageurl').addEventListener('input', onPropertyChange);
  document.getElementById('prop-imagelist-file').addEventListener('change', onRandomImageFilesSelect);

  // Quick links
  document.getElementById('prop-link-add').addEventListener('click', onAddQuickLink);

  // Iframe embed
  document.getElementById('prop-embedurl').addEventListener('input', onPropertyChange);

  // Release widget
  document.getElementById('prop-repo').addEventListener('input', onPropertyChange);
  document.getElementById('prop-currentversion').addEventListener('input', onPropertyChange);
  if (document.getElementById('prop-gh-username')) document.getElementById('prop-gh-username').addEventListener('input', onPropertyChange);
  if (document.getElementById('prop-gh-repo')) document.getElementById('prop-gh-repo').addEventListener('input', onPropertyChange);
  if (document.getElementById('prop-gh-apikey')) document.getElementById('prop-gh-apikey').addEventListener('input', onPropertyChange);
  document.getElementById('prop-openclawurl').addEventListener('input', onPropertyChange);

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
  if (document.getElementById('prop-directorypath-group')) document.getElementById('prop-directorypath-group').style.display = 'none';
  document.getElementById('prop-location-group').style.display = 'none';
  document.getElementById('prop-locations-group').style.display = 'none';
  document.getElementById('prop-units-group').style.display = 'none';
  document.getElementById('prop-timeformat-group').style.display = 'none';
  document.getElementById('prop-targetdate-group').style.display = 'none';
  document.getElementById('prop-countdown-options-group').style.display = 'none';
  document.getElementById('prop-pomodoro-group').style.display = 'none';
  document.getElementById('prop-imagepath-group').style.display = 'none';
  document.getElementById('prop-imageurl-group').style.display = 'none';
  document.getElementById('prop-imagelist-group').style.display = 'none';
  document.getElementById('prop-quicklinks-group').style.display = 'none';
  document.getElementById('prop-embedurl-group').style.display = 'none';
  document.getElementById('prop-release-group').style.display = 'none';
  if (document.getElementById('prop-github-group')) document.getElementById('prop-github-group').style.display = 'none';
  document.getElementById('prop-openclawurl-group').style.display = 'none';
  document.getElementById('prop-title-hint').style.display = 'none';
  document.getElementById('prop-fontsize-group').style.display = 'none';
  document.getElementById('prop-fontcolor-group').style.display = 'none';
  document.getElementById('prop-textalign-group').style.display = 'none';
  document.getElementById('prop-fontweight-group').style.display = 'none';
  document.getElementById('prop-linecolor-group').style.display = 'none';
  document.getElementById('prop-linethickness-group').style.display = 'none';
  document.getElementById('prop-showborder-group').style.display = 'none';
  document.getElementById('prop-columns-group').style.display = 'none';
  document.getElementById('prop-feedurl-group').style.display = 'none';
  document.getElementById('prop-layout-group').style.display = 'none';

  // Show layout field (pages-menu)
  if (widget.properties.layout !== undefined) {
    document.getElementById('prop-layout-group').style.display = 'block';
    document.getElementById('prop-layout').value = widget.properties.layout || 'vertical';
  }

  // Show text header fields
  if (widget.properties.fontSize !== undefined) {
    document.getElementById('prop-fontsize-group').style.display = 'block';
    document.getElementById('prop-fontsize').value = widget.properties.fontSize || 24;
    document.getElementById('prop-fontcolor-group').style.display = 'block';
    document.getElementById('prop-fontcolor').value = widget.properties.fontColor || '#e6edf3';
    document.getElementById('prop-textalign-group').style.display = 'block';
    document.getElementById('prop-textalign').value = widget.properties.textAlign || 'left';
    document.getElementById('prop-fontweight-group').style.display = 'block';
    document.getElementById('prop-fontweight').value = widget.properties.fontWeight || 'bold';
  }

  // Show border toggle
  if (widget.properties.showBorder !== undefined) {
    document.getElementById('prop-showborder-group').style.display = 'block';
    document.getElementById('prop-showborder').checked = widget.properties.showBorder || false;
  }

  // Show line fields
  if (widget.properties.lineColor !== undefined) {
    document.getElementById('prop-linecolor-group').style.display = 'block';
    document.getElementById('prop-linecolor').value = widget.properties.lineColor || '#30363d';
    document.getElementById('prop-linethickness-group').style.display = 'block';
    document.getElementById('prop-linethickness').value = widget.properties.lineThickness || 2;
  }

  // Show columns field
  const tpl = WIDGETS[widget.type];
  if (widget.properties.columns !== undefined || (tpl && tpl.properties && tpl.properties.columns !== undefined)) {
    document.getElementById('prop-columns-group').style.display = 'block';
    document.getElementById('prop-columns').value = widget.properties.columns || (tpl && tpl.properties && tpl.properties.columns) || 1;
  }

  // Show feed URL field
  const tplFeed = WIDGETS[widget.type];
  if (widget.properties.feedUrl !== undefined || (tplFeed && tplFeed.properties && tplFeed.properties.feedUrl !== undefined)) {
    document.getElementById('prop-feedurl-group').style.display = 'block';
    document.getElementById('prop-feedurl').value = widget.properties.feedUrl || (tplFeed && tplFeed.properties && tplFeed.properties.feedUrl) || '';
  }

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

  // Show time format field
  if (widget.properties.format24h !== undefined) {
    document.getElementById('prop-timeformat-group').style.display = 'block';
    document.getElementById('prop-timeformat').value = widget.properties.format24h ? '24h' : '12h';
  }

  // Show countdown-specific fields
  if (widget.properties.targetDate !== undefined) {
    document.getElementById('prop-targetdate-group').style.display = 'block';
    document.getElementById('prop-targetdate').value = widget.properties.targetDate || '';
    document.getElementById('prop-countdown-options-group').style.display = 'block';
    document.getElementById('prop-show-hours').checked = widget.properties.showHours || false;
    document.getElementById('prop-show-minutes').checked = widget.properties.showMinutes || false;
    // Show title hint for countdown
    document.getElementById('prop-title-hint').textContent = 'Name what you\'re counting down to';
    document.getElementById('prop-title-hint').style.display = 'block';
  }

  // Show pomodoro-specific fields
  if (widget.properties.workMinutes !== undefined) {
    document.getElementById('prop-pomodoro-group').style.display = 'block';
    document.getElementById('prop-work-minutes').value = widget.properties.workMinutes || 25;
    document.getElementById('prop-break-minutes').value = widget.properties.breakMinutes || 5;
  }

  // Show local image fields
  if (widget.properties.imagePath !== undefined) {
    document.getElementById('prop-imagepath-group').style.display = 'block';
    const pathInput = document.getElementById('prop-imagepath');
    const pathHint = document.querySelector('#prop-imagepath-group small');
    // If image is embedded (base64), hide the path input
    if (widget.properties.imagePath && widget.properties.imagePath.startsWith('data:')) {
      pathInput.style.display = 'none';
      pathHint.style.display = 'none';
    } else {
      pathInput.style.display = 'block';
      pathInput.value = widget.properties.imagePath || '';
      pathHint.style.display = 'block';
    }
  }

  // Show web image fields
  if (widget.properties.imageUrl !== undefined) {
    document.getElementById('prop-imageurl-group').style.display = 'block';
    document.getElementById('prop-imageurl').value = widget.properties.imageUrl || '';
  }

  // Show random image fields
  if (widget.properties.images !== undefined || widget.type === 'image-random') {
    document.getElementById('prop-imagelist-group').style.display = 'block';
    if (!widget.properties.images) widget.properties.images = [];
    renderRandomImageList();
  }

  // Show quick links fields
  if (widget.type === 'image-latest' && document.getElementById('prop-directorypath-group')) {
    document.getElementById('prop-directorypath-group').style.display = 'block';
    document.getElementById('prop-directorypath').value = widget.properties.directoryPath || '';
  }

  if (widget.type === 'quick-links') {
    document.getElementById('prop-quicklinks-group').style.display = 'block';
    if (!widget.properties.links) widget.properties.links = [];
    renderQuickLinksList();
  }

  // Show iframe embed fields
  if (widget.properties.embedUrl !== undefined) {
    document.getElementById('prop-embedurl-group').style.display = 'block';
    document.getElementById('prop-embedurl').value = widget.properties.embedUrl || '';
  }

  // Show release widget fields
  if (widget.properties.repo !== undefined) {
    document.getElementById('prop-release-group').style.display = 'block';
    document.getElementById('prop-repo').value = widget.properties.repo || '';
    document.getElementById('prop-currentversion').value = widget.properties.currentVersion || '';
  }

  // Show GitHub stats fields
  if (widget.type === 'github-stats') {
    document.getElementById('prop-github-group').style.display = 'block';
    document.getElementById('prop-gh-username').value = widget.properties.username || '';
    document.getElementById('prop-gh-repo').value = widget.properties.repo || '';
    document.getElementById('prop-gh-apikey').value = widget.properties.apiKey || '';
  }

  // Show OpenClaw URL field
  if (widget.properties.openclawUrl !== undefined) {
    document.getElementById('prop-openclawurl-group').style.display = 'block';
    document.getElementById('prop-openclawurl').value = widget.properties.openclawUrl || '';
  }

  // Show API fields
  if (template.hasApiKey) {
    document.getElementById('prop-api-group').style.display = 'block';
    const apiKeyVarEl = document.getElementById('prop-api-key');
    const apiKeyVarLabel = apiKeyVarEl.previousElementSibling;
    if (template.hideApiKeyVar) {
      apiKeyVarEl.style.display = 'none';
      if (apiKeyVarLabel) apiKeyVarLabel.style.display = 'none';
    } else {
      apiKeyVarEl.style.display = '';
      if (apiKeyVarLabel) apiKeyVarLabel.style.display = '';
      apiKeyVarEl.value = template.apiKeyName || '';
    }
    document.getElementById('prop-api-key-value').value = widget.properties.apiKey || '';
    const noteEl = document.getElementById('prop-api-note');
    if (noteEl) {
      noteEl.textContent = template.properties?.apiKeyNote || '';
      noteEl.style.display = template.properties?.apiKeyNote ? 'block' : 'none';
    }
  }

  // Show endpoint field
  if (widget.properties.endpoint !== undefined) {
    document.getElementById('prop-endpoint-group').style.display = 'block';
    document.getElementById('prop-endpoint').value = widget.properties.endpoint || '';
  }

  document.getElementById('prop-refresh').value = widget.properties.refreshInterval || 60;

  // Widget font scale (per-widget override)
  document.getElementById('prop-widgetfontscale').value = widget.properties.widgetFontAdjust || '0';

  // Render dynamic extra properties for fields not handled by hardcoded groups
  renderExtraProperties(widget, template);

  // Show widget description
  const descEl = document.getElementById('prop-description');
  if (template.description) {
    descEl.textContent = template.description;
    document.getElementById('prop-description-group').style.display = 'block';
  } else {
    document.getElementById('prop-description-group').style.display = 'none';
  }

  // Show privacy warning for sensitive widgets
  let privWarn = document.getElementById('prop-privacy-warning');
  if (!privWarn) {
    privWarn = document.createElement('div');
    privWarn.id = 'prop-privacy-warning';
    privWarn.style.cssText = 'background:#2d1b00;border:1px solid #d29922;border-radius:6px;padding:8px 10px;margin:8px 0;font-size:11px;color:#d29922;display:none;line-height:1.4;';
    const descGroup = document.getElementById('prop-description-group');
    descGroup.parentNode.insertBefore(privWarn, descGroup.nextSibling);
  }
  if (template.privacyWarning) {
    privWarn.innerHTML = '⚠️ <strong>Privacy Warning:</strong> This widget may display sensitive data (API keys, credentials, personal info) to anyone viewing your dashboard. Public Mode and PIN protection only prevent editing — they do <strong>not</strong> hide widget content.';
    privWarn.style.display = 'block';
  } else {
    privWarn.style.display = 'none';
  }
}

// Properties already handled by hardcoded UI groups
const HANDLED_PROPS = new Set([
  'title', 'showHeader', 'refreshInterval', 'endpoint',
  'fontSize', 'fontColor', 'textAlign', 'fontWeight',
  'showBorder', 'lineColor', 'lineThickness', 'columns', 'feedUrl', 'layout',
  'location', 'locations', 'units', 'format24h',
  'targetDate', 'showHours', 'showMinutes',
  'workMinutes', 'breakMinutes',
  'imagePath', 'imageUrl', 'images', 'links',
  'embedUrl', 'repo', 'currentVersion', 'openclawUrl',
  'apiKey', 'apiKeyNote', 'username',
  'widgetFontScale', 'widgetFontAdjust', 'symbols',
  'directoryPath'
]);

// Known select/dropdown options for specific properties
const PROP_OPTIONS = {
  period: ['today', 'week', 'month', 'year'],
  units: ['F', 'C'],
  maxLength: ['0', '50', '100', '150', '200', '300'],
};

const PROP_LABELS = {
  maxLength: { '0': 'No limit', '50': '50 chars', '100': '100 chars', '150': '150 chars', '200': '200 chars', '300': '300 chars' },
};

function renderExtraProperties(widget, template) {
  const container = document.getElementById('prop-extra-container');
  container.innerHTML = '';

  const templateProps = template.properties || {};
  // Merge: show any property in templateProps or widget.properties not in HANDLED_PROPS
  const allKeys = new Set([...Object.keys(templateProps), ...Object.keys(widget.properties)]);

  for (const key of allKeys) {
    if (HANDLED_PROPS.has(key)) continue;

    const defaultVal = templateProps[key];
    const currentVal = widget.properties[key] !== undefined ? widget.properties[key] : defaultVal;
    if (currentVal === undefined) continue;

    const group = document.createElement('div');
    group.className = 'prop-group';

    const label = document.createElement('label');
    // Convert camelCase to readable label
    label.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

    let input;

    if (PROP_OPTIONS[key]) {
      // Dropdown
      input = document.createElement('select');
      PROP_OPTIONS[key].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = (PROP_LABELS[key] && PROP_LABELS[key][opt]) || opt.charAt(0).toUpperCase() + opt.slice(1);
        if (String(currentVal) === String(opt)) option.selected = true;
        input.appendChild(option);
      });
    } else if (typeof currentVal === 'boolean' || typeof defaultVal === 'boolean') {
      // Checkbox
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!currentVal;
      // Style: put checkbox inline with label
      label.style.display = 'inline';
      label.style.marginLeft = '6px';
      group.appendChild(input);
      group.appendChild(label);
      input.dataset.extraProp = key;
      input.dataset.extraType = 'boolean';
      input.addEventListener('change', onExtraPropertyChange);
      container.appendChild(group);
      continue;
    } else if (typeof currentVal === 'number' || typeof defaultVal === 'number') {
      // Number input
      input = document.createElement('input');
      input.type = 'number';
      input.value = currentVal;
    } else if (typeof currentVal === 'string') {
      // Text input
      input = document.createElement('input');
      input.type = 'text';
      input.value = currentVal;
    } else {
      continue; // Skip objects/arrays
    }

    input.dataset.extraProp = key;
    input.dataset.extraType = typeof (defaultVal !== undefined ? defaultVal : currentVal);
    input.addEventListener('change', onExtraPropertyChange);
    input.addEventListener('input', onExtraPropertyChange);

    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
  }
}

function onExtraPropertyChange(e) {
  if (!state.selectedWidget) return;
  const key = e.target.dataset.extraProp;
  const type = e.target.dataset.extraType;

  if (type === 'boolean') {
    state.selectedWidget.properties[key] = e.target.checked;
  } else if (type === 'number') {
    state.selectedWidget.properties[key] = parseFloat(e.target.value) || 0;
  } else {
    state.selectedWidget.properties[key] = e.target.value;
  }
  renderWidgetPreview(state.selectedWidget);
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

function onImageFileSelect(e) {
  if (!state.selectedWidget) return;
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    state.selectedWidget.properties.imagePath = event.target.result;
    // Hide the path input after file is selected
    document.getElementById('prop-imagepath').style.display = 'none';
    document.querySelector('#prop-imagepath-group small').style.display = 'none';
    renderWidgetPreview(state.selectedWidget);
  };
  reader.readAsDataURL(file);
}

function onRandomImageFilesSelect(e) {
  if (!state.selectedWidget) return;
  const files = Array.from(e.target.files);
  if (!files.length) return;
  
  // Initialize images array if needed
  if (!state.selectedWidget.properties.images) {
    state.selectedWidget.properties.images = [];
  }
  
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(event) {
      state.selectedWidget.properties.images.push({
        name: file.name,
        data: event.target.result
      });
      loaded++;
      if (loaded === files.length) {
        renderRandomImageList();
        // Clear file input
        document.getElementById('prop-imagelist-file').value = '';
      }
    };
    reader.readAsDataURL(file);
  });
}

function renderRandomImageList() {
  if (!state.selectedWidget) return;
  const container = document.getElementById('prop-imagelist-items');
  const images = state.selectedWidget.properties.images || [];
  
  if (images.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px 0;">No images added yet</div>';
    return;
  }
  
  container.innerHTML = images.map((img, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);">
      <img src="${escapeHtml(img.data)}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;">
      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(img.name)}</span>
      <button onclick="removeRandomImage(${i})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:14px;" title="Remove">×</button>
    </div>
  `).join('');
}

window.removeRandomImage = function(index) {
  if (!state.selectedWidget || !state.selectedWidget.properties.images) return;
  state.selectedWidget.properties.images.splice(index, 1);
  renderRandomImageList();
};

function onAddQuickLink() {
  if (!state.selectedWidget) return;
  const nameInput = document.getElementById('prop-link-name');
  const urlInput = document.getElementById('prop-link-url');
  
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  
  if (!name || !url) return;
  
  // Add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  if (!state.selectedWidget.properties.links) {
    state.selectedWidget.properties.links = [];
  }
  
  state.selectedWidget.properties.links.push({ name, url });
  renderQuickLinksList();
  renderWidgetPreview(state.selectedWidget);
  
  // Clear inputs
  nameInput.value = '';
  urlInput.value = '';
  nameInput.focus();
}

function renderQuickLinksList() {
  if (!state.selectedWidget) return;
  const container = document.getElementById('prop-quicklinks-items');
  const links = state.selectedWidget.properties.links || [];
  
  if (links.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px 0;">No links added yet</div>';
    return;
  }
  
  container.innerHTML = links.map((link, i) => {
    let domain = '';
    try { domain = new URL(link.url).hostname; } catch(e) {}
    const favicon = domain ? 'https://www.google.com/s2/favicons?sz=16&domain=' + encodeURIComponent(domain) : '';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);">
      ${favicon ? `<img src="${escapeHtml(favicon)}" style="width:16px;height:16px;">` : ''}
      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(link.name)}</span>
      <button onclick="removeQuickLink(${i})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:14px;" title="Remove">×</button>
    </div>
  `;
  }).join('');
}

window.removeQuickLink = function(index) {
  if (!state.selectedWidget || !state.selectedWidget.properties.links) return;
  state.selectedWidget.properties.links.splice(index, 1);
  renderQuickLinksList();
  renderWidgetPreview(state.selectedWidget);
};

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
      renderWidgetPreview(widget);
      break;
    case 'prop-show-header':
      widget.properties.showHeader = e.target.checked;
      renderWidgetPreview(widget);
      break;
    case 'prop-showborder':
      widget.properties.showBorder = e.target.checked;
      const el = document.getElementById(widget.id);
      if (el) el.dataset.showBorder = e.target.checked ? 'true' : 'false';
      renderWidgetPreview(widget);
      break;
    case 'prop-layout':
      widget.properties.layout = e.target.value;
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
    case 'prop-timeformat':
      widget.properties.format24h = e.target.value === '24h';
      break;
    case 'prop-targetdate':
      widget.properties.targetDate = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-show-hours':
      widget.properties.showHours = e.target.checked;
      break;
    case 'prop-show-minutes':
      widget.properties.showMinutes = e.target.checked;
      break;
    case 'prop-work-minutes':
      widget.properties.workMinutes = parseInt(e.target.value) || 25;
      renderWidgetPreview(widget);
      break;
    case 'prop-break-minutes':
      widget.properties.breakMinutes = parseInt(e.target.value) || 5;
      break;
    case 'prop-imagepath':
      widget.properties.imagePath = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-imageurl':
      widget.properties.imageUrl = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-embedurl':
      widget.properties.embedUrl = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-repo':
      widget.properties.repo = e.target.value;
      break;
    case 'prop-currentversion':
      widget.properties.currentVersion = e.target.value;
      break;
    case 'prop-gh-username':
      widget.properties.username = e.target.value;
      break;
    case 'prop-gh-repo':
      widget.properties.repo = e.target.value;
      break;
    case 'prop-gh-apikey':
      widget.properties.apiKey = e.target.value;
      break;
    case 'prop-openclawurl':
      widget.properties.openclawUrl = e.target.value;
      break;
    case 'prop-api-key-value':
      widget.properties.apiKey = e.target.value;
      break;
    case 'prop-endpoint':
      widget.properties.endpoint = e.target.value;
      break;
    case 'prop-directorypath':
      widget.properties.directoryPath = e.target.value;
      break;
    case 'prop-refresh':
      widget.properties.refreshInterval = parseInt(e.target.value) || 60;
      break;
    case 'prop-widgetfontscale':
      const adj = parseInt(e.target.value) || 0;
      if (adj !== 0) {
        widget.properties.widgetFontAdjust = adj;
      } else {
        delete widget.properties.widgetFontAdjust;
      }
      // Clean up old property if present
      delete widget.properties.widgetFontScale;
      applyWidgetFontScale(widget);
      break;
    case 'prop-fontsize':
      widget.properties.fontSize = parseInt(e.target.value) || 24;
      renderWidgetPreview(widget);
      break;
    case 'prop-fontcolor':
      widget.properties.fontColor = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-textalign':
      widget.properties.textAlign = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-fontweight':
      widget.properties.fontWeight = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-linecolor':
      widget.properties.lineColor = e.target.value;
      renderWidgetPreview(widget);
      break;
    case 'prop-linethickness':
      widget.properties.lineThickness = parseInt(e.target.value) || 2;
      renderWidgetPreview(widget);
      break;
    case 'prop-columns':
      widget.properties.columns = parseInt(e.target.value) || 1;
      renderWidgetPreview(widget);
      break;
    case 'prop-feedurl':
      widget.properties.feedUrl = e.target.value;
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
    } else if (e.target.value === 'scrollable') {
      document.getElementById('custom-width').style.display = 'none';
      document.getElementById('custom-x').style.display = 'none';
      document.getElementById('custom-height').style.display = 'none';

      state.canvas.width = 1920;
      state.canvas.height = 'auto';
      updateCanvasSize();
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

  // Font scale selector
  document.getElementById('font-scale').addEventListener('change', (e) => {
    const scale = parseFloat(e.target.value) || 1;
    state.fontScale = scale;
    document.documentElement.style.setProperty('--font-scale', scale);
    // Reapply per-widget adjustments since they're relative to global
    state.widgets.forEach(w => applyWidgetFontScale(w));
  });

  // Clear button
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Clear all widgets?')) {
      state.widgets.forEach(w => document.getElementById(w.id)?.remove());
      state.widgets = [];
      selectWidget(null);
      updateCanvasInfo();
      updateEmptyState();
      document.getElementById('canvas').classList.remove('has-widgets');
    }
  });

  // Preview button
  document.getElementById('btn-preview').addEventListener('click', showPreview);

  // Export button (now Save button)
  document.getElementById('btn-save').addEventListener('click', saveConfig);

  // Close preview
  document.getElementById('close-preview').addEventListener('click', () => {
    document.getElementById('preview-modal').classList.remove('active');
  });

  // Edit layout button
  document.getElementById('btn-edit-layout').addEventListener('click', requestEditMode);

  // Zoom controls - handled via inline onclick in HTML

  // Keyboard shortcuts for zoom and edit mode
  document.addEventListener('keydown', (e) => {
    // Check if not typing in an input/editable element
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;

    if (e.ctrlKey && e.key === 'e') { // Ctrl+E to toggle edit mode
      e.preventDefault();
      if (state.editMode) setEditMode(false); else requestEditMode();
    } else if (e.key === '=' || e.key === '+') {
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
      if (state.selectedWidget && state.editMode) {
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

    const props = { ...widget.properties, id: widget.id };
    let html = processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);

    return `
      <div class="widget-container" data-widget-id="${widget.id}" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;">
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
  <main class="dashboard" style="width:${state.canvas.width}px;height:${isScrollableMode() ? 'auto' : state.canvas.height + 'px'};min-height:${isScrollableMode() ? getScrollableCanvasHeight() + 'px' : 'auto'};position:relative;">
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

  // Load JSZip dynamically
  if (!window.JSZip) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }

  // Load html2canvas dynamically
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }

  const zip = new JSZip();
  zip.file('index.html', html);
  zip.file('css/style.css', css);
  zip.file('js/dashboard.js', js);
  zip.file('README.md', generateReadme());
  zip.file('server.js', generateServerJs());

  // Capture preview screenshot automatically
  try {
    const canvas = document.getElementById('canvas');
    const screenshot = await html2canvas(canvas, {
      backgroundColor: '#0d1117',
      scale: 1,
      useCORS: true,
      allowTaint: true
    });
    const pngBlob = await new Promise(resolve => screenshot.toBlob(resolve, 'image/png'));
    zip.file('preview.png', pngBlob);
  } catch (e) {
    console.warn('Could not generate preview screenshot:', e);
  }

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

    // Wrap in positioned container with data-widget-id for post-export editing
    return `
      <div class="widget-container" data-widget-id="${widget.id}" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;">
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
  <main class="dashboard" style="width:${state.canvas.width}px;height:${isScrollableMode() ? 'auto' : state.canvas.height + 'px'};min-height:${isScrollableMode() ? getScrollableCanvasHeight() + 'px' : 'auto'};position:relative;">
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
  font-size: calc(13px * var(--font-scale, 1));
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

/* World Clock */
.tz-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.tz-row:last-child {
  border-bottom: none;
}

.tz-city {
  color: var(--text-primary);
}

.tz-time {
  font-weight: 600;
  color: var(--accent-blue);
  font-variant-numeric: tabular-nums;
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

/* Pomodoro Button */
.pomo-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pomo-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.pomo-btn:active {
  background: var(--bg-secondary);
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

/* Post-Export Edit Mode */
.edit-mode .widget-container {
  cursor: move;
  outline: 2px dashed #3b82f6;
  outline-offset: -2px;
}

.edit-mode .widget-container:hover {
  outline-color: #60a5fa;
}

.edit-mode .widget-container.dragging {
  opacity: 0.8;
  z-index: 1000;
}

.resize-handle-edit {
  display: none;
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: #3b82f6;
  border-radius: 2px 0 0 0;
  z-index: 10;
}

.resize-handle-edit::before {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-right: 2px solid white;
  border-bottom: 2px solid white;
}

.edit-mode .resize-handle-edit {
  display: block;
}

#edit-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  padding: 8px 16px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: background 0.15s, transform 0.1s;
}

#edit-toggle:hover {
  background: #334155;
}

#edit-toggle:active {
  transform: scale(0.98);
}

#edit-toggle.active {
  background: #3b82f6;
}
`;
}

function generateEditJs() {
  return `
// ─────────────────────────────────────────────
// POST-EXPORT LAYOUT EDITING
// ─────────────────────────────────────────────

(function() {
  const STORAGE_KEY = 'lobsterboard-layout';
  const GRID_SIZE = 20;
  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 60;
  
  let editMode = false;
  let activeWidget = null;
  let startX, startY, origLeft, origTop, origWidth, origHeight;
  let isResizing = false;

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', initEditMode);

  function initEditMode() {
    // Create edit toggle button
    const btn = document.createElement('button');
    btn.id = 'edit-toggle';
    btn.textContent = '✏️ Edit Layout';
    btn.onclick = toggleEditMode;
    document.body.appendChild(btn);

    // Add resize handles and event listeners to all widgets
    document.querySelectorAll('.widget-container').forEach(initWidget);

    // Load saved positions
    loadPositions();
  }

  function initWidget(widget) {
    // Add resize handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle-edit';
    widget.appendChild(handle);

    // Drag to move
    widget.addEventListener('mousedown', onWidgetMouseDown);
    
    // Resize handle
    handle.addEventListener('mousedown', onResizeMouseDown);
  }

  function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    document.getElementById('edit-toggle').classList.toggle('active', editMode);
    document.getElementById('edit-toggle').textContent = editMode ? '💾 Save Layout' : '✏️ Edit Layout';
    
    if (!editMode) {
      savePositions();
    }
  }

  function onWidgetMouseDown(e) {
    if (!editMode) return;
    if (e.target.classList.contains('resize-handle-edit')) return;
    if (e.button !== 0) return;

    e.preventDefault();
    activeWidget = e.currentTarget;
    isResizing = false;
    
    startX = e.clientX;
    startY = e.clientY;
    origLeft = activeWidget.offsetLeft;
    origTop = activeWidget.offsetTop;

    activeWidget.classList.add('dragging');
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onResizeMouseDown(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    activeWidget = e.target.parentElement;
    isResizing = true;
    
    startX = e.clientX;
    startY = e.clientY;
    origWidth = activeWidget.offsetWidth;
    origHeight = activeWidget.offsetHeight;

    activeWidget.classList.add('dragging');
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!activeWidget) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isResizing) {
      // Resize
      const newWidth = Math.max(MIN_WIDTH, origWidth + dx);
      const newHeight = Math.max(MIN_HEIGHT, origHeight + dy);
      activeWidget.style.width = newWidth + 'px';
      activeWidget.style.height = newHeight + 'px';
    } else {
      // Move
      const newLeft = Math.max(0, origLeft + dx);
      const newTop = Math.max(0, origTop + dy);
      activeWidget.style.left = newLeft + 'px';
      activeWidget.style.top = newTop + 'px';
    }
  }

  function onMouseUp() {
    if (!activeWidget) return;

    // Snap to grid
    if (isResizing) {
      activeWidget.style.width = snapToGrid(activeWidget.offsetWidth) + 'px';
      activeWidget.style.height = snapToGrid(activeWidget.offsetHeight) + 'px';
    } else {
      activeWidget.style.left = snapToGrid(activeWidget.offsetLeft) + 'px';
      activeWidget.style.top = snapToGrid(activeWidget.offsetTop) + 'px';
    }

    activeWidget.classList.remove('dragging');
    activeWidget = null;
    isResizing = false;
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  function savePositions() {
    const positions = {};
    document.querySelectorAll('.widget-container').forEach(widget => {
      const id = widget.dataset.widgetId;
      if (id) {
        positions[id] = {
          left: widget.offsetLeft,
          top: widget.offsetTop,
          width: widget.offsetWidth,
          height: widget.offsetHeight
        };
      }
    });
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      console.log('Layout saved');
    } catch (e) {
      console.warn('Failed to save layout:', e);
    }
  }

  function loadPositions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      
      const positions = JSON.parse(saved);
      document.querySelectorAll('.widget-container').forEach(widget => {
        const id = widget.dataset.widgetId;
        const pos = positions[id];
        if (pos) {
          widget.style.left = pos.left + 'px';
          widget.style.top = pos.top + 'px';
          widget.style.width = pos.width + 'px';
          widget.style.height = pos.height + 'px';
        }
      });
      console.log('Layout restored from localStorage');
    } catch (e) {
      console.warn('Failed to load saved layout:', e);
    }
  }
})();
`;
}

function sanitizeProps(props) {
  const safe = { ...props };
  for (const key of Object.keys(safe)) {
    if (typeof safe[key] === 'string') {
      safe[key] = safe[key].replace(/[`$\\]/g, '\\$&').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
  }
  return safe;
}

function generateDashboardJs() {
  const widgetJs = state.widgets.map(widget => {
    const template = WIDGETS[widget.type];
    if (!template || !template.generateJs) return '';

    const props = sanitizeProps({ ...widget.properties, id: widget.id });
    return template.generateJs(props);
  }).join('\n\n');

  const editJs = generateEditJs();

  return `/**
 * OpenClaw Dashboard - Generated JavaScript
 * Replace YOUR_*_API_KEY placeholders with your actual API keys
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');
});

${widgetJs}

${editJs}
`;
}

function generateServerJs() {
  return `/**
 * LobsterBoard Dashboard Server
 * 
 * A server that:
 * - Serves your dashboard static files
 * - Provides OpenClaw data via CLI commands (not HTTP proxy)
 * 
 * Usage: node server.js
 * 
 * Environment variables:
 *   PORT - Server port (default: 8080)
 *   HOST - Bind address (default: 127.0.0.1 for security)
 * 
 * Security: By default binds to localhost only. To expose on network:
 *   HOST=0.0.0.0 node server.js
 *   ⚠️  Only do this on trusted networks!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

// Cache for expensive CLI operations (30 second TTL)
let statusCache = { data: null, timestamp: 0 };
let cronCache = { data: null, timestamp: 0 };
let activityCache = { data: null, timestamp: 0 };
let logsCache = { data: null, timestamp: 0 };
const CACHE_TTL = 30000;

// Run openclaw CLI command and return output
function runOpenClawCmd(args) {
  try {
    return execSync(\`openclaw \${args}\`, { 
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (e) {
    console.error(\`openclaw \${args} failed:\`, e.message);
    return null;
  }
}

// Parse openclaw status output
function parseStatus() {
  const now = Date.now();
  if (statusCache.data && (now - statusCache.timestamp) < CACHE_TTL) {
    return statusCache.data;
  }

  const output = runOpenClawCmd('status');
  if (!output) return null;

  const versionOutput = runOpenClawCmd('--version');
  const currentVersion = versionOutput ? versionOutput.trim() : 'unknown';

  const data = {
    authMode: 'unknown',
    version: currentVersion,
    sessions: 0,
    gateway: 'unknown'
  };

  // Detect auth mode from status output
  if (output.includes('oauth') || output.includes('claude-cli')) {
    data.authMode = 'oauth';
  } else if (output.includes('api-key') || output.match(/sk-ant-/)) {
    data.authMode = 'api-key';
  } else {
    data.authMode = 'oauth';
  }

  // Look for version update info
  const versionMatch = output.match(/npm update ([\\\\d.-]+)/);
  if (versionMatch) data.latestVersion = versionMatch[1];

  // Look for sessions count
  const sessionsMatch = output.match(/sessions?\\\\s+(\\\\d+)/i);
  if (sessionsMatch) data.sessions = parseInt(sessionsMatch[1]);

  // Look for gateway status
  if (output.includes('running')) data.gateway = 'running';

  statusCache = { data, timestamp: now };
  return data;
}

// Parse cron jobs via CLI
function parseCronJobs() {
  const now = Date.now();
  if (cronCache.data && (now - cronCache.timestamp) < CACHE_TTL) {
    return cronCache.data;
  }

  const output = runOpenClawCmd('cron list --json');
  let jobs = [];
  try {
    if (output) {
      const parsed = JSON.parse(output);
      // Transform jobs to widget-expected format
      jobs = (parsed.jobs || []).map(job => ({
        name: job.name || job.id || 'Unnamed',
        next: job.state?.nextRunAtMs 
          ? new Date(job.state.nextRunAtMs).toLocaleString('en-US', { 
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
            })
          : (job.schedule?.expr || '—'),
        enabled: job.enabled !== false,
        lastStatus: job.state?.lastStatus || null
      }));
    }
  } catch (e) {
    console.error('Failed to parse cron jobs:', e.message);
  }

  const data = { jobs };
  cronCache = { data, timestamp: now };
  return data;
}

// Response helpers
function sendSuccess(res, data) {
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ status: 'ok', data }));
}

function sendError(res, message, statusCode = 500) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ status: 'error', message }));
}

// API handlers
const API_HANDLERS = {
  '/api/status': (req, res) => {
    const data = parseStatus();
    if (!data) {
      sendError(res, 'Failed to get OpenClaw status');
      return;
    }
    sendSuccess(res, data);
  },

  '/api/cron': (req, res) => {
    const data = parseCronJobs();
    sendSuccess(res, data);
  },

  '/api/activity': (req, res) => {
    const now = Date.now();
    if (activityCache.data && (now - activityCache.timestamp) < CACHE_TTL) {
      sendSuccess(res, activityCache.data);
      return;
    }

    const cronRunsDir = path.join(os.homedir(), '.openclaw', 'cron', 'runs');
    const cronJobsFile = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
    
    // Build job ID to name mapping
    let jobMap = {};
    try {
      if (fs.existsSync(cronJobsFile)) {
        const jobsData = JSON.parse(fs.readFileSync(cronJobsFile, 'utf8'));
        jobMap = Object.fromEntries((jobsData.jobs || []).map(j => [j.id, j.name || j.id]));
      }
    } catch (e) { /* ignore */ }

    // Read all run files and merge entries
    let allRuns = [];
    try {
      if (fs.existsSync(cronRunsDir)) {
        const files = fs.readdirSync(cronRunsDir).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(cronRunsDir, file), 'utf8');
            const lines = content.trim().split('\\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (entry.ts && entry.action === 'finished') {
                  allRuns.push(entry);
                }
              } catch (e) { /* skip malformed lines */ }
            }
          } catch (e) { /* skip unreadable files */ }
        }
      }
    } catch (e) { /* ignore */ }

    // Sort by timestamp descending and take last 15
    allRuns.sort((a, b) => b.ts - a.ts);
    const recentRuns = allRuns.slice(0, 15);

    const items = recentRuns.map(run => {
      const jobName = jobMap[run.jobId] || run.jobId || 'Unknown Job';
      const duration = run.durationMs ? \`(\${Math.round(run.durationMs / 1000)}s)\` : '';
      const summary = run.summary ? \`: \${run.summary.slice(0, 50)}\` : '';
      return {
        text: \`\${jobName} \${duration}\${summary}\`,
        time: new Date(run.ts).toISOString(),
        status: run.status || 'unknown'
      };
    });

    // Fallback if no runs found
    if (items.length === 0) {
      items.push({ text: 'No recent activity', time: new Date().toISOString(), status: 'info' });
    }

    const data = { items };
    activityCache = { data, timestamp: now };
    sendSuccess(res, data);
  },

  '/api/logs': (req, res) => {
    const now = Date.now();
    if (logsCache.data && (now - logsCache.timestamp) < CACHE_TTL) {
      sendSuccess(res, logsCache.data);
      return;
    }

    const logPath = path.join(os.homedir(), '.openclaw', 'logs', 'gateway.log');
    let lines = [];

    try {
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        const rawLines = content.split('\\n').filter(l => l.trim());
        // Take last 75 lines, reverse for newest first
        const recentLines = rawLines.slice(-75).reverse();
        
        lines = recentLines.map(line => {
          // Parse format: TIMESTAMP [subsystem] message
          const match = line.match(/^(\\S+)\\s+\\[(\\w+)\\]\\s+(.*)$/);
          if (match) {
            return { time: match[1], subsystem: match[2], message: match[3] };
          }
          return { raw: line };
        });
      } else {
        lines = [{ message: 'Log file not found', subsystem: 'info' }];
      }
    } catch (e) {
      lines = [{ message: \`Error reading logs: \${e.message}\`, subsystem: 'error' }];
    }

    const data = { lines };
    logsCache = { data, timestamp: now };
    sendSuccess(res, data);
  },

  '/api/sessions': (req, res) => {
    const status = parseStatus();
    sendSuccess(res, { count: status?.sessions || 0 });
  }
};

// Static file server with path traversal protection
function serveStatic(filePath, res) {
  if (filePath === '/') filePath = '/index.html';
  const fullPath = path.resolve(__dirname, '.' + filePath);
  
  // Prevent path traversal attacks
  if (!fullPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  
  const ext = path.extname(fullPath).toLowerCase();
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://' + req.headers.host).pathname;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // API endpoints
  if (API_HANDLERS[pathname]) {
    API_HANDLERS[pathname](req, res);
    return;
  }
  
  // Static files
  serveStatic(pathname, res);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

server.listen(PORT, HOST, () => {
  console.log(\`
🦞 LobsterBoard Dashboard Server

   Dashboard: http://\${HOST}:\${PORT}
   
   API Endpoints:
   • /api/status   - Auth mode & version
   • /api/cron     - Cron jobs list  
   • /api/activity - Activity feed
   • /api/logs     - System logs
   • /api/sessions - Session count
   
\${HOST === '127.0.0.1' ? '   ✓ Bound to localhost (secure)' : '   ⚠️  Exposed to network'}

   Press Ctrl+C to stop
\`);
});
`;
}

function generateReadme() {
  const apiKeys = [];
  const needsOpenClaw = state.widgets.some(w => 
    ['openclaw-release', 'auth-status', 'activity-list', 'cron-jobs', 'system-log', 'session-count', 'token-gauge'].includes(w.type)
  );
  
  state.widgets.forEach(widget => {
    const template = WIDGETS[widget.type];
    if (template?.hasApiKey && template.apiKeyName) {
      if (!apiKeys.includes(template.apiKeyName)) {
        apiKeys.push(template.apiKeyName);
      }
    }
  });

  return `# LobsterBoard Dashboard

This dashboard was generated with LobsterBoard Dashboard Builder.

## ⚠️ Security Notice

**Never blindly trust scripts from the internet.**

Before running \`server.js\`, we recommend reviewing it for security:

\`\`\`
Hey [Your AI Assistant], please review the server.js file in this folder 
and check for any security concerns, suspicious code, or potential issues.
\`\`\`

The server.js included here uses the OpenClaw CLI to query data locally
(no network proxying). It binds to localhost by default for security. 
But always verify for yourself!

---

## Quick Start

${needsOpenClaw ? `### Running with OpenClaw widgets

Your dashboard includes widgets that connect to OpenClaw. The server uses
the OpenClaw CLI to query data, so make sure OpenClaw is installed and configured.

\`\`\`bash
# Make sure OpenClaw CLI is available:
openclaw status

# Then start the dashboard:
node server.js
\`\`\`

Open http://localhost:8080 in your browser.

### Configuration

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| \`PORT\` | 8080 | Server port |
| \`HOST\` | 127.0.0.1 | Bind address (localhost = secure) |

**Examples:**
\`\`\`bash
# Custom port
PORT=3000 node server.js

# Expose to network (trusted networks only!)
HOST=0.0.0.0 node server.js
\`\`\`

### Set It and Forget It (Auto-Start)

To have your dashboard start automatically on boot:

\`\`\`bash
# Install pm2 (process manager)
npm install -g pm2

# Start the dashboard
pm2 start server.js --name my-dashboard

# Save the process list
pm2 save

# Set up auto-start on boot
pm2 startup
# (follow the instructions it prints)
\`\`\`

**Useful pm2 commands:**
- \`pm2 status\` - Check if running
- \`pm2 logs my-dashboard\` - View logs
- \`pm2 restart my-dashboard\` - Restart
- \`pm2 stop my-dashboard\` - Stop

### Without server (static only)
` : ''}
Open \`index.html\` directly, or serve with any static file server.
Note: OpenClaw widgets won't work without the server proxy.

## Files

| File | Description |
|------|-------------|
| \`index.html\` | Dashboard page |
| \`css/style.css\` | Styles |
| \`js/dashboard.js\` | Widget logic |
| \`server.js\` | Server with OpenClaw API proxy |

${apiKeys.length > 0 ? `## API Keys

Edit \`js/dashboard.js\` and replace these placeholders:
${apiKeys.map(key => `- \`YOUR_${key}\``).join('\n')}
` : ''}
## Customization

Edit CSS variables in \`style.css\`:

\`\`\`css
:root {
  --bg-primary: #0d1117;
  --accent-blue: #58a6ff;
  /* etc */
}
\`\`\`

## Links

- LobsterBoard Builder: https://github.com/curbob/LobsterBoard
- OpenClaw: https://github.com/openclaw/openclaw

---

Generated: ${new Date().toISOString()}
`;
}

// ─── Directory Browser for Latest Image widget ───
async function openDirBrowser(startDir) {
  const browser = document.getElementById('dir-browser');
  const input = document.getElementById('prop-directorypath');
  const dir = startDir || input.value || '~';
  browser.style.display = 'block';
  browser.innerHTML = '<span style="color:var(--text-muted);">Loading...</span>';
  try {
    const res = await fetch('/api/browse-dirs?dir=' + encodeURIComponent(dir));
    const data = await res.json();
    if (data.status !== 'ok') { browser.innerHTML = `<span style="color:#f85149;">${escapeHtml(data.message)}</span>`; return; }
    let html = `<div style="margin-bottom:6px;color:var(--text-secondary);font-size:11px;word-break:break-all;">${escapeHtml(data.path)}</div>`;
    if (data.imageCount > 0) {
      html += `<div style="margin-bottom:6px;padding:4px 8px;background:var(--bg-secondary);border-radius:4px;color:#3fb950;font-size:11px;">📷 ${escapeHtml(String(data.imageCount))} image${data.imageCount !== 1 ? 's' : ''} in this folder</div>`;
    }
    // Up one level
    const parent = data.path.replace(/\/[^/]+\/?$/, '') || '/';
    if (data.path !== parent) {
      html += `<div class="dir-entry" data-path="${escapeHtml(parent)}" style="cursor:pointer;padding:3px 6px;border-radius:4px;color:var(--text-primary);" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">📁 ..</div>`;
    }
    for (const d of data.dirs) {
      const full = data.path + '/' + d;
      html += `<div class="dir-entry" data-path="${escapeHtml(full)}" style="cursor:pointer;padding:3px 6px;border-radius:4px;color:var(--text-primary);" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">📁 ${escapeHtml(d)}</div>`;
    }
    if (data.dirs.length === 0 && data.imageCount === 0) {
      html += `<div style="color:var(--text-muted);font-size:11px;padding:4px;">Empty directory</div>`;
    }
    html += `<div style="margin-top:8px;display:flex;gap:4px;">`;
    html += `<button type="button" style="flex:1;padding:4px 8px;background:var(--accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✓ Select this folder</button>`;
    html += `<button type="button" onclick="document.getElementById('dir-browser').style.display='none'" style="padding:4px 8px;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:11px;">Cancel</button>`;
    html += `</div>`;
    browser.innerHTML = html;
    // Attach select button handler safely (avoid inline onclick with path data)
    const selectBtn = browser.querySelector('button');
    if (selectBtn) selectBtn.addEventListener('click', () => selectDir(data.path));
    browser.querySelectorAll('.dir-entry').forEach(el => {
      el.addEventListener('click', () => openDirBrowser(el.dataset.path));
    });
  } catch (e) { browser.innerHTML = `<span style="color:#f85149;">Error: ${escapeHtml(e.message)}</span>`; }
}

function selectDir(dirPath) {
  const input = document.getElementById('prop-directorypath');
  input.value = dirPath;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('dir-browser').style.display = 'none';
}

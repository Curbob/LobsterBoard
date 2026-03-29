/**
 * Editor Auth Module
 * PIN authentication, public mode, edit mode toggling, widget script lifecycle
 */
(function() {
  var state = window.BuilderState;

  // ─────────────────────────────────────────────
  // PIN & PUBLIC MODE
  // ─────────────────────────────────────────────

  window.addPublicUnlockButton = function addPublicUnlockButton() {
    var unlock = document.getElementById('public-unlock');
    if (unlock) return;
    unlock = document.createElement('button');
    unlock.id = 'public-unlock';
    unlock.textContent = '\uD83D\uDD12';
    unlock.title = 'Admin';
    unlock.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;background:transparent;border:none;color:#6e7681;font-size:12px;cursor:pointer;opacity:0.3;transition:opacity .2s;padding:4px;';
    unlock.addEventListener('mouseenter', function() { unlock.style.opacity = '0.8'; });
    unlock.addEventListener('mouseleave', function() { unlock.style.opacity = '0.3'; });
    unlock.addEventListener('click', function() {
      if (state.hasPin) {
        showPinModal('verify');
      } else {
        openSecurityModal();
      }
    });
    document.body.appendChild(unlock);
  };

  window.checkAuthStatus = async function checkAuthStatus() {
    try {
      var res = await fetch('/api/auth/status');
      var data = await res.json();
      state.hasPin = data.hasPin;
      state.publicMode = data.publicMode;
      if (state.publicMode) {
        var editBtn = document.getElementById('btn-edit-layout');
        if (editBtn) editBtn.style.display = 'none';
        addPublicUnlockButton();
      }
    } catch (e) { console.error('Auth status check failed:', e); }
  };

  window.showPinModal = function showPinModal(mode) {
    var modal = document.getElementById('pin-modal');
    var title = document.getElementById('pin-modal-title');
    var input = document.getElementById('pin-input');
    var input2 = document.getElementById('pin-input-confirm');
    var currentInput = document.getElementById('pin-input-current');
    var error = document.getElementById('pin-error');
    var confirmGroup = document.getElementById('pin-confirm-group');
    var currentGroup = document.getElementById('pin-current-group');

    error.textContent = '';
    input.value = '';
    input2.value = '';
    currentInput.value = '';

    if (mode === 'verify') {
      title.textContent = '\uD83D\uDD12 Enter PIN to Edit';
      confirmGroup.style.display = 'none';
      currentGroup.style.display = 'none';
    } else if (mode === 'set') {
      title.textContent = '\uD83D\uDD10 Set Edit PIN';
      confirmGroup.style.display = 'block';
      currentGroup.style.display = 'none';
    } else if (mode === 'change') {
      title.textContent = '\uD83D\uDD04 Change PIN';
      confirmGroup.style.display = 'block';
      currentGroup.style.display = 'block';
    } else if (mode === 'remove') {
      title.textContent = '\uD83D\uDDD1\uFE0F Remove PIN';
      confirmGroup.style.display = 'none';
      currentGroup.style.display = 'block';
      input.parentElement.style.display = 'none';
    }

    modal.style.display = 'flex';
    modal.dataset.mode = mode;
    setTimeout(function() { (mode === 'change' || mode === 'remove' ? currentInput : input).focus(); }, 100);
  };

  window.closePinModal = function closePinModal() {
    var modal = document.getElementById('pin-modal');
    modal.style.display = 'none';
    document.getElementById('pin-input').parentElement.style.display = '';
    if (state._publicModeCallback) {
      state._publicModeCallback = null;
      var toggle = document.getElementById('public-mode-toggle');
      if (toggle) toggle.checked = state.publicMode;
    }
  };

  window.submitPin = async function submitPin() {
    var modal = document.getElementById('pin-modal');
    var mode = modal.dataset.mode;
    var pin = document.getElementById('pin-input').value;
    var pin2 = document.getElementById('pin-input-confirm').value;
    var currentPin = document.getElementById('pin-input-current').value;
    var error = document.getElementById('pin-error');
    error.textContent = '';

    if (mode === 'verify') {
      var res = await fetch('/api/auth/verify-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
      });
      var data = await res.json();
      if (data.valid) {
        state.pinVerified = true;
        if (state._publicModeCallback) {
          var callback = state._publicModeCallback;
          state._publicModeCallback = null;
          closePinModal();
          await callback(pin);
          return;
        }
        if (state.publicMode) {
          state.publicMode = false;
          await fetch('/api/mode', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicMode: false, pin: pin })
          });
          var editBtn = document.getElementById('btn-edit-layout');
          if (editBtn) editBtn.style.display = '';
          var unlockEl = document.getElementById('public-unlock');
          if (unlockEl) unlockEl.remove();
          var pubToggle = document.getElementById('public-mode-toggle');
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
      var res = await fetch('/api/auth/set-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
      });
      var data = await res.json();
      if (data.status === 'ok') {
        state.hasPin = true;
        state.pinVerified = true;
        closePinModal();
        setEditMode(true);
      } else { error.textContent = data.error || 'Failed to set PIN'; }
    } else if (mode === 'change') {
      if (pin !== pin2) { error.textContent = 'New PINs do not match'; return; }
      if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { error.textContent = 'PIN must be 4-6 digits'; return; }
      var res = await fetch('/api/auth/set-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin, currentPin: currentPin })
      });
      var data = await res.json();
      if (data.status === 'ok') {
        closePinModal();
        alert('PIN changed successfully');
      } else { error.textContent = data.error || 'Failed to change PIN'; }
    } else if (mode === 'remove') {
      var res = await fetch('/api/auth/remove-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: currentPin })
      });
      var data = await res.json();
      if (data.status === 'ok') {
        state.hasPin = false;
        closePinModal();
        alert('PIN removed');
      } else { error.textContent = data.error || 'Failed to remove PIN'; }
    }
  };

  window.requestEditMode = async function requestEditMode() {
    if (state.publicMode) { alert('Dashboard is in public mode. Editing is disabled.'); return; }
    if (state.hasPin && !state.pinVerified) {
      showPinModal('verify');
    } else if (!state.hasPin) {
      setEditMode(true);
    } else {
      setEditMode(true);
    }
  };

  window.openSecurityModal = function openSecurityModal() {
    var modal = document.getElementById('security-modal');
    var pinStatus = document.getElementById('pin-status');
    var setBtn = document.getElementById('sec-set-pin');
    var changeBtn = document.getElementById('sec-change-pin');
    var removeBtn = document.getElementById('sec-remove-pin');
    var publicToggle = document.getElementById('public-mode-toggle');

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
  };

  // ─────────────────────────────────────────────
  // EDIT MODE
  // ─────────────────────────────────────────────

  window.setEditMode = function setEditMode(enable) {
    state.editMode = enable;
    document.body.dataset.mode = enable ? 'edit' : 'view';

    var editLayoutBtn = document.getElementById('btn-edit-layout');
    var saveBtn = document.getElementById('btn-save');

    if (enable) {
      stopWidgetScripts();
      editLayoutBtn.style.display = 'none';
      saveBtn.textContent = '\uD83D\uDCBE Save';
      saveBtn.removeEventListener('click', exportDashboard);
      saveBtn.addEventListener('click', saveConfig);
      document.querySelector('.builder-header').style.display = 'flex';
      document.querySelector('.widget-panel').style.display = 'flex';
      document.getElementById('properties-panel').style.display = 'flex';
      document.querySelector('.canvas-info').style.display = 'flex';
      document.getElementById('canvas-wrapper').style.padding = '40px';
      document.getElementById('canvas').style.border = '2px solid var(--border)';
      document.getElementById('canvas').style.borderRadius = '8px';
      document.getElementById('canvas').style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)';
      document.querySelector('.canvas-grid').style.display = 'block';
      document.querySelector('.drop-hint').style.display = 'flex';
    } else {
      editLayoutBtn.style.display = state.publicMode ? 'none' : 'block';
      saveBtn.textContent = '\uD83D\uDCE6 Export ZIP';
      saveBtn.removeEventListener('click', saveConfig);
      saveBtn.addEventListener('click', exportDashboard);
      document.querySelector('.builder-header').style.display = 'none';
      document.querySelector('.widget-panel').style.display = 'none';
      document.getElementById('properties-panel').style.display = 'none';
      document.querySelector('.canvas-info').style.display = 'none';
      document.getElementById('canvas-wrapper').style.padding = '0';
      document.getElementById('canvas').style.border = 'none';
      document.getElementById('canvas').style.borderRadius = '0';
      document.getElementById('canvas').style.boxShadow = 'none';
      document.querySelector('.canvas-grid').style.display = 'none';
      document.querySelector('.drop-hint').style.display = 'none';
    }
    // Re-render widgets to apply new pointer-events
    state.widgets.forEach(function(widget) {
      var el = document.getElementById(widget.id);
      if (el) {
        el.querySelector('.widget-render').style.pointerEvents = enable ? 'none' : 'auto';
        el.querySelector('.resize-handle').style.display = enable ? 'block' : 'none';
        if (enable) {
          el.style.cursor = 'move';
          el.classList.add('builder-edit-mode');
        } else {
          el.style.cursor = 'default';
          el.classList.remove('builder-edit-mode');
        }
      }
    });
    selectWidget(null);
    updateEmptyState();
    if (!enable) {
      scaleCanvasToFit();
      if (state.widgets.length > 0) {
        executeWidgetScripts();
      }
    } else {
      var canvas = document.getElementById('canvas');
      canvas.style.transform = 'scale(' + state.zoom + ')';
    }
  };

  // ─────────────────────────────────────────────
  // WIDGET SCRIPT LIFECYCLE
  // ─────────────────────────────────────────────

  window.executeWidgetScripts = function executeWidgetScripts() {
    if (window._widgetIntervals) {
      window._widgetIntervals.forEach(function(id) { clearInterval(id); });
    }
    window._widgetIntervals = [];

    var origSetInterval = window.setInterval;
    window.setInterval = function(fn, ms) {
      var id = origSetInterval(fn, ms);
      window._widgetIntervals.push(id);
      return id;
    };

    state.widgets.forEach(function(widget) {
      var template = WIDGETS[widget.type];
      if (!template || !template.generateJs) return;
      var props = sanitizeProps(Object.assign({}, widget.properties, { id: 'preview-' + widget.id }));
      try {
        var js = template.generateJs(props);
        new Function(js)();
      } catch (e) {
        console.error('Widget ' + widget.type + ' script error:', e);
      }
    });

    window.setInterval = origSetInterval;
  };

  window.stopWidgetScripts = function stopWidgetScripts() {
    if (window._widgetIntervals) {
      window._widgetIntervals.forEach(function(id) { clearInterval(id); });
      window._widgetIntervals = [];
    }
    if (_statsSource) {
      _statsSource.close();
      _statsSource = null;
      _statsCallbacks = [];
    }
  };
})();

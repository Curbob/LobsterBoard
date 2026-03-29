/**
 * Editor Controls Module
 * Canvas size selector, font scale, clear, keyboard shortcuts, mouse wheel zoom
 */
(function() {
  var state = window.BuilderState;

  window.initControls = function initControls() {
    // Canvas size selector
    document.getElementById('canvas-size').addEventListener('change', function(e) {
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

        var parts = e.target.value.split('x').map(Number);
        state.canvas.width = parts[0];
        state.canvas.height = parts[1];
        updateCanvasSize();
      }
    });

    // Custom size inputs
    ['custom-width', 'custom-height'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', function() {
        state.canvas.width = parseInt(document.getElementById('custom-width').value) || 1920;
        state.canvas.height = parseInt(document.getElementById('custom-height').value) || 1080;
        updateCanvasSize();
      });
    });

    // Font scale selector
    document.getElementById('font-scale').addEventListener('change', function(e) {
      var scale = parseFloat(e.target.value) || 1;
      state.fontScale = scale;
      document.documentElement.style.setProperty('--font-scale', scale);
      state.widgets.forEach(function(w) { applyWidgetFontScale(w); });
    });

    // Clear button
    document.getElementById('btn-clear').addEventListener('click', function() {
      if (confirm('Clear all widgets?')) {
        state.widgets.forEach(function(w) {
          var el = document.getElementById(w.id);
          if (el) el.remove();
        });
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
    document.getElementById('close-preview').addEventListener('click', function() {
      document.getElementById('preview-modal').classList.remove('active');
    });

    // Edit layout button
    document.getElementById('btn-edit-layout').addEventListener('click', requestEditMode);

    // Keyboard shortcuts for zoom and edit mode
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;

      if (e.ctrlKey && e.key === 'e') {
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
    document.getElementById('canvas-wrapper').addEventListener('wheel', function(e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    }, { passive: false });
  };
})();

/**
 * Editor Config Module
 * Load/save dashboard configuration, HTML processing helpers
 */
(function() {
  var state = window.BuilderState;

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  window.processWidgetHtml = function processWidgetHtml(html, showHeader) {
    if (showHeader !== false) return html;
    var headerRegex = /<div\s+class="dash-card-head"[^>]*>[\s\S]*?<\/div>/i;
    return html.replace(headerRegex, '');
  };

  // ─────────────────────────────────────────────
  // CONFIG MANAGEMENT
  // ─────────────────────────────────────────────

  window.loadConfig = async function loadConfig() {
    try {
      var response = await fetch('/config');
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      var config = await response.json();

      state.canvas = config.canvas || { width: 1920, height: 1080 };
      state.fontScale = config.fontScale || 1;

      // Restore canvas size dropdown to match loaded config
      var sizeSelect = document.getElementById('canvas-size');
      if (state.canvas.height === 'auto') {
        sizeSelect.value = 'scrollable';
      } else {
        var sizeKey = state.canvas.width + 'x' + state.canvas.height;
        if (sizeSelect.querySelector('option[value="' + sizeKey + '"]')) {
          sizeSelect.value = sizeKey;
        } else {
          sizeSelect.value = 'custom';
        }
      }
      state.widgets = config.widgets || [];
      document.documentElement.style.setProperty('--font-scale', state.fontScale);
      var fontScaleEl = document.getElementById('font-scale');
      if (fontScaleEl) fontScaleEl.value = String(state.fontScale);
      state.idCounter = state.widgets.reduce(function(maxId, w) {
        return Math.max(maxId, parseInt(w.id.replace('widget-', '')));
      }, 0);

      updateCanvasSize(true);
      state.widgets.forEach(function(widget) {
        try {
          renderWidget(widget);
        } catch (e) {
          console.error('Failed to render widget ' + widget.id + ' (type: ' + widget.type + '):', e);
        }
      });
      updateCanvasInfo();
      if (state.widgets.length > 0) {
        document.getElementById('canvas').classList.add('has-widgets');
      }
      console.log('Dashboard config loaded successfully.');
      setEditMode(false);
      if (state.widgets.length > 0) {
        executeWidgetScripts();
      }
    } catch (error) {
      console.error('Failed to load dashboard config:', error);
      setEditMode(true);
    }
  };

  window.saveConfig = async function saveConfig() {
    try {
      var configToSave = {
        canvas: state.canvas,
        fontScale: state.fontScale || 1,
        widgets: state.widgets
      };
      var response = await fetch('/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configToSave)
      });
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      var result = await response.json();
      console.log('Dashboard config saved successfully:', result);
      alert('Dashboard layout saved!');
    } catch (error) {
      console.error('Failed to save dashboard config:', error);
      alert('Failed to save dashboard layout. See console for details.');
    }
  };
})();

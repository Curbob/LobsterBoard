/**
 * Editor State Module
 * Central state object and shared utilities
 */
(function() {
  // ─────────────────────────────────────────────
  // SECURITY HELPERS
  // ─────────────────────────────────────────────

  window.escapeHtml = function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  var state = {
    canvas: { width: 1920, height: 1080 },
    zoom: 0.5,
    widgets: [],
    selectedWidget: null,
    draggedWidget: null,
    idCounter: 0,
    fontScale: 1,
    editMode: false,
    pinVerified: false,
    hasPin: false,
    publicMode: false
  };

  window.BuilderState = state;
  window.state = state;

  // ─────────────────────────────────────────────
  // SCROLLABLE / UNLIMITED HEIGHT HELPERS
  // ─────────────────────────────────────────────

  window.isScrollableMode = function isScrollableMode() {
    return state.canvas.height === 'auto';
  };

  window.getScrollableCanvasHeight = function getScrollableCanvasHeight() {
    if (!state.widgets.length) return 1080;
    var maxBottom = 0;
    state.widgets.forEach(function(w) {
      var bottom = w.y + w.height;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    return maxBottom + 100;
  };

  window.updateEmptyState = function updateEmptyState() {
    if (state.widgets.length === 0) {
      document.body.classList.add('empty-dashboard');
    } else {
      document.body.classList.remove('empty-dashboard');
    }
  };

  window.sanitizeProps = function sanitizeProps(props) {
    var safe = Object.assign({}, props);
    for (var key of Object.keys(safe)) {
      if (typeof safe[key] === 'string') {
        safe[key] = safe[key].replace(/[`$\\]/g, '\\$&').replace(/'/g, "\\'").replace(/"/g, '\\"');
      }
    }
    return safe;
  };
})();

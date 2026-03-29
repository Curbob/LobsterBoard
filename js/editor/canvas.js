/**
 * Editor Canvas Module
 * Canvas initialization, sizing, zoom, and scaling
 */
(function() {
  var state = window.BuilderState;

  window.initCanvas = function initCanvas() {
    var canvas = document.getElementById('canvas');
    updateCanvasSize();

    // Canvas click to deselect
    canvas.addEventListener('click', function(e) {
      if (e.target === canvas || e.target.classList.contains('canvas-grid')) {
        selectWidget(null);
      }
    });
  };

  window.updateCanvasSize = function updateCanvasSize(preserveZoom) {
    if (preserveZoom === undefined) preserveZoom = false;
    var canvas = document.getElementById('canvas');
    var wrapper = document.getElementById('canvas-wrapper');
    var effectiveHeight = isScrollableMode() ? getScrollableCanvasHeight() : state.canvas.height;

    // Calculate zoom to fit (only if not preserving zoom)
    if (!preserveZoom) {
      var wrapperRect = wrapper.getBoundingClientRect();
      var maxWidth = wrapperRect.width - 80;
      var maxHeight = wrapperRect.height - 80;

      var scaleX = maxWidth / state.canvas.width;
      var scaleY = maxHeight / effectiveHeight;
      state.zoom = Math.min(scaleX, scaleY, 0.6);
    }

    canvas.style.width = state.canvas.width + 'px';
    canvas.style.height = isScrollableMode() ? effectiveHeight + 'px' : state.canvas.height + 'px';
    canvas.style.transform = 'scale(' + state.zoom + ')';
    canvas.dataset.width = state.canvas.width;
    canvas.dataset.height = isScrollableMode() ? 'auto' : state.canvas.height;

    // Toggle scrollable class on body
    document.body.classList.toggle('canvas-scrollable', isScrollableMode());

    updateCanvasInfo();
  };

  window.setZoom = function setZoom(newZoom) {
    state.zoom = Math.max(0.1, Math.min(2, newZoom));
    var canvas = document.getElementById('canvas');
    canvas.style.transform = 'scale(' + state.zoom + ')';
    updateCanvasInfo();
  };

  window.zoomIn = function zoomIn() {
    setZoom(state.zoom + 0.1);
  };

  window.zoomOut = function zoomOut() {
    setZoom(state.zoom - 0.1);
  };

  window.zoomFit = function zoomFit() {
    updateCanvasSize(false);
  };

  window.zoom100 = function zoom100() {
    setZoom(1);
  };

  window.scaleCanvasToFit = function scaleCanvasToFit() {
    var canvas = document.getElementById('canvas');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = state.canvas.width;

    if (isScrollableMode()) {
      var effectiveHeight = getScrollableCanvasHeight();
      canvas.style.height = effectiveHeight + 'px';
      var scale = vw / cw;
      canvas.style.transform = 'scale(' + scale + ')';
      canvas.style.transformOrigin = 'top left';
      var scaledW = cw * scale;
      var offsetX = Math.max(0, (vw - scaledW) / 2);
      canvas.style.marginLeft = offsetX + 'px';
      canvas.style.marginTop = '0px';
      var wrapper = document.getElementById('canvas-wrapper');
      wrapper.style.height = (effectiveHeight * scale) + 'px';
      return;
    }

    var ch = state.canvas.height;
    var scale = Math.min(vw / cw, vh / ch);
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.transformOrigin = 'top left';
    var scaledW = cw * scale;
    var scaledH = ch * scale;
    var offsetX = Math.max(0, (vw - scaledW) / 2);
    var offsetY = Math.max(0, (vh - scaledH) / 2);
    canvas.style.marginLeft = offsetX + 'px';
    canvas.style.marginTop = offsetY + 'px';
  };

  window.updateCanvasInfo = function updateCanvasInfo() {
    document.getElementById('canvas-dimensions').textContent =
      state.canvas.width + ' \u00d7 ' + (isScrollableMode() ? '\u221e (scrollable)' : state.canvas.height);
    document.getElementById('widget-count').textContent =
      state.widgets.length + ' widget' + (state.widgets.length !== 1 ? 's' : '');
    document.getElementById('zoom-level').textContent =
      Math.round(state.zoom * 100) + '%';
  };

  // Re-scale on window resize in view mode
  window.addEventListener('resize', function() {
    if (!state.editMode) scaleCanvasToFit();
  });
})();

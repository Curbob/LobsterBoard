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

  // ─────────────────────────────────────────────
  // WIDGET RENDERING AND SELECTION
  // ─────────────────────────────────────────────

  window.renderWidget = function renderWidget(widget) {
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
    el.style.position = 'absolute';

    // Widget content and wrapper
    el.innerHTML = '<div class="widget-render"></div><div class="resize-handle"></div>';
    const props = { ...widget.properties, id: widget.id };
    const widgetContent = window.processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
    el.querySelector('.widget-render').innerHTML = widgetContent;

    canvas.appendChild(el);
    window.applyWidgetFontScale(widget);

    // Add click event listener for selection
    el.addEventListener('click', function(e) {
      if (!state.editMode) return;
      e.stopPropagation();
      window.selectWidget(widget.id);
    });

    // Add drag event listener
    el.addEventListener('mousedown', function(e) {
      if (!state.editMode) return;
      if (e.target.classList.contains('resize-handle')) return;
      window.startDragWidget(e, widget);
    });

    // Add resize handle event listener
    const resizeHandle = el.querySelector('.resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', function(e) {
        if (!state.editMode) return;
        e.stopPropagation();
        window.startResizeWidget(e, widget);
      });
    }

    // Execute widget JS after HTML is in the DOM
    if (template.generateJs) {
      try {
        eval('(function() { var widget = arguments[0]; ' + template.generateJs(props) + ' })')(widget);
      } catch (e) {
        console.error(`Widget ${widget.id} JS error:`, e);
      }
    }
  };

  // Re-render a placed widget's content after a property change in the editor.
  // Restored from the pre-split builder.js; properties.js calls this on every edit.
  window.renderWidgetPreview = function renderWidgetPreview(widget) {
    const template = WIDGETS[widget.type];
    const el = document.getElementById(widget.id);
    if (!template || !el) return;

    if (widget.type === 'text-header') {
      el.dataset.showBorder = widget.properties.showBorder ? 'true' : 'false';
    }
    if (widget.type === 'pages-menu') {
      if (widget.properties.showBorder === false) el.dataset.showBorder = 'false';
      else delete el.dataset.showBorder;
    }

    const props = { ...widget.properties, id: widget.id };
    const renderDiv = el.querySelector('.widget-render');
    if (renderDiv) {
      renderDiv.innerHTML = window.processWidgetHtml(template.generateHtml(props), widget.properties.showHeader);
    }
    window.applyWidgetFontScale(widget);
  };

  window.selectWidget = function selectWidget(id) {
    // Deselect previous
    document.querySelectorAll('.placed-widget.selected').forEach(el => {
      el.classList.remove('selected');
    });

    state.selectedWidget = id ? state.widgets.find(w => w.id === id) : null;

    if (state.selectedWidget) {
      document.getElementById(id).classList.add('selected');
      window.showProperties(state.selectedWidget);
    } else {
      window.hideProperties();
    }
  };

  window.startDragWidget = function startDragWidget(e, widget) {
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
      if (window.isScrollableMode && window.isScrollableMode()) {
        widget.y = Math.max(0, widget.y);
      } else {
        widget.y = Math.max(0, Math.min(widget.y, state.canvas.height - widget.height));
      }

      el.style.left = widget.x + 'px';
      el.style.top = widget.y + 'px';

      // In scrollable mode, grow canvas to fit
      if (window.isScrollableMode && window.isScrollableMode()) {
        window.updateCanvasSize(true);
      }

      window.updatePropertyInputs();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  window.startResizeWidget = function startResizeWidget(e, widget) {
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
      if (!window.isScrollableMode || !window.isScrollableMode()) {
        widget.height = Math.min(widget.height, state.canvas.height - widget.y);
      }

      el.style.width = widget.width + 'px';
      el.style.height = widget.height + 'px';

      // In scrollable mode, grow canvas to fit
      if (window.isScrollableMode && window.isScrollableMode()) {
        window.updateCanvasSize(true);
      }

      window.updatePropertyInputs();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  window.deleteWidget = function deleteWidget(id) {
    const idx = state.widgets.findIndex(w => w.id === id);
    if (idx === -1) return;

    state.widgets.splice(idx, 1);
    document.getElementById(id)?.remove();
    window.selectWidget(null);
    window.updateCanvasInfo();
    window.updateEmptyState();

    if (state.widgets.length === 0) {
      document.getElementById('canvas').classList.remove('has-widgets');
    }
  };
})();

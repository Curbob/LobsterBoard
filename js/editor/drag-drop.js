/**
 * Editor Drag & Drop Module
 * Widget library drag-drop and widget creation
 */
(function() {
  var state = window.BuilderState;

  window.initDragDrop = function initDragDrop() {
    var canvas = document.getElementById('canvas');

    // Widget library items - add privacy badges
    document.querySelectorAll('.widget-item').forEach(function(item) {
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragend', onDragEnd);
      var widgetType = item.dataset.widget;
      var widgetDef = WIDGETS[widgetType];
      if (widgetDef && widgetDef.privacyWarning) {
        var nameEl = item.querySelector('.widget-name');
        if (nameEl && !nameEl.querySelector('.privacy-badge')) {
          var badge = document.createElement('span');
          badge.className = 'privacy-badge';
          badge.textContent = ' \u26A0\uFE0F';
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
  };

  function onDragStart(e) {
    var widgetType = e.target.dataset.widget;
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
    var canvas = document.getElementById('canvas');
    canvas.classList.remove('drag-over');

    var widgetType = e.dataTransfer.getData('widget-type');
    if (!widgetType || !WIDGETS[widgetType]) return;

    var canvasRect = canvas.getBoundingClientRect();
    var x = (e.clientX - canvasRect.left) / state.zoom;
    var y = (e.clientY - canvasRect.top) / state.zoom;

    createWidget(widgetType, x, y);
  }

  window.createWidget = function createWidget(type, x, y) {
    var template = WIDGETS[type];
    if (!template) return;

    var id = 'widget-' + (++state.idCounter);

    var widget = {
      id: id,
      type: type,
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

    if (isScrollableMode()) {
      updateCanvasSize(true);
    }
    renderWidget(widget);
    updateEmptyState();
    selectWidget(id);
    updateCanvasInfo();

    document.getElementById('canvas').classList.add('has-widgets');
  };
})();

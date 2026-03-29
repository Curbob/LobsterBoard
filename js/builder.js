/**
 * OpenClaw Dashboard Builder - Backward-Compatible Shim
 *
 * This file loads the modular editor scripts from js/editor/.
 * If the modules are already loaded (e.g. via explicit script tags in HTML),
 * this shim does nothing.
 */
(function() {
  // If BuilderState already exists, modules were loaded via script tags - skip
  if (window.BuilderState) return;

  var scripts = [
    'js/editor/state.js',
    'js/editor/canvas.js',
    'js/editor/auth.js',
    'js/editor/config.js',
    'js/editor/servers.js',
    'js/editor/drag-drop.js',
    'js/editor/widgets.js',
    'js/editor/properties.js',
    'js/editor/controls.js',
    'js/editor/export.js',
    'js/editor/modals.js',
    'js/editor/index.js'
  ];

  // Load scripts sequentially to preserve order
  function loadNext(i) {
    if (i >= scripts.length) return;
    var s = document.createElement('script');
    s.src = scripts[i];
    s.onload = function() { loadNext(i + 1); };
    s.onerror = function() {
      console.error('Failed to load editor module: ' + scripts[i]);
      loadNext(i + 1);
    };
    document.head.appendChild(s);
  }

  loadNext(0);
})();

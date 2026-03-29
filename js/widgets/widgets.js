/**
 * OpenClaw Dashboard Builder - Widget Definitions (Backward-compatible shim)
 *
 * The actual widget definitions have been split into per-category modules
 * under js/widgets/. This file exists for backward compatibility.
 *
 * In the browser, the individual modules are loaded via <script> tags in
 * app.html. Each module adds its widgets to the global window.WIDGETS object.
 *
 * Load order (browser):
 *   1. js/widgets/shared/helpers.js  - Security helpers (_esc, _isSafeUrl)
 *   2. js/widgets/shared/icons.js    - WIDGET_ICONS, renderIcon
 *   3. js/widgets/shared/stats.js    - SSE/stats system (onStats, formatters)
 *   4. js/widgets/index.js           - Initializes window.WIDGETS = {}
 *   5. js/widgets/weather.js         - Weather widgets
 *   6. js/widgets/system.js          - System monitoring widgets
 *   7. js/widgets/ai-tools.js        - AI tool usage widgets
 *   8. js/widgets/media.js           - Media/entertainment widgets
 *   9. js/widgets/productivity.js    - Productivity widgets
 *  10. js/widgets/time.js            - Time/calendar widgets
 *  11. js/widgets/layout.js          - Layout widgets (headers, lines, notes)
 *  12. js/widgets/releases.js        - Release tracking widgets
 *  13. js/widgets/misc.js            - Miscellaneous widgets
 *
 * If this file is loaded as a standalone <script> tag (legacy usage),
 * it dynamically loads all the modules above.
 */

(function() {
  // If WIDGETS is already populated by individual module script tags, nothing to do
  if (typeof window !== 'undefined' && window.WIDGETS && Object.keys(window.WIDGETS).length > 0) {
    return;
  }

  // Legacy fallback: dynamically load all modules via script injection
  if (typeof document !== 'undefined') {
    var scripts = [
      'js/widgets/shared/helpers.js',
      'js/widgets/shared/icons.js',
      'js/widgets/shared/stats.js',
      'js/widgets/index.js',
      'js/widgets/weather.js',
      'js/widgets/system.js',
      'js/widgets/ai-tools.js',
      'js/widgets/media.js',
      'js/widgets/productivity.js',
      'js/widgets/time.js',
      'js/widgets/layout.js',
      'js/widgets/releases.js',
      'js/widgets/misc.js'
    ];

    // Synchronous script injection to maintain load order
    for (var i = 0; i < scripts.length; i++) {
      document.write('<script src="' + scripts[i] + '"><\/script>');
    }
  }
})();

/**
 * LobsterBoard Search Widget
 * search — search box with DuckDuckGo-style !bangs (pure frontend, no API key)
 */
(function (WIDGETS) {
  'use strict';

  function renderIcon(name) {
    if (typeof window !== 'undefined' && window.renderIcon) return window.renderIcon(name);
    return '';
  }

  var BUILT_IN_BANGS = {
    'g':    'https://www.google.com/search?q={q}',
    'b':    'https://www.bing.com/search?q={q}',
    'yt':   'https://www.youtube.com/results?search_query={q}',
    'gh':   'https://github.com/search?q={q}',
    'r':    'https://www.reddit.com/search/?q={q}',
    'so':   'https://stackoverflow.com/search?q={q}',
    'w':    'https://en.wikipedia.org/wiki/Special:Search/{q}',
    'img':  'https://www.google.com/search?tbm=isch&q={q}',
    'maps': 'https://www.google.com/maps/search/{q}',
    'ddg':  'https://duckduckgo.com/?q={q}',
    'npm':  'https://www.npmjs.com/search?q={q}',
    'mdn':  'https://developer.mozilla.org/en-US/search?q={q}',
    'x':    'https://x.com/search?q={q}',
    'tw':   'https://x.com/search?q={q}'
  };

  var PROVIDERS = {
    duckduckgo: 'https://duckduckgo.com/?q={q}',
    google:     'https://www.google.com/search?q={q}',
    bing:       'https://www.bing.com/search?q={q}',
    brave:      'https://search.brave.com/search?q={q}'
  };

  WIDGETS['search'] = {
    name: 'Search',
    icon: '🔍',
    category: 'large',
    description: 'Search box with DuckDuckGo-style !bangs. Press S to focus, ↑ for last query.',
    defaultWidth: 460,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Search',
      placeholder: 'Search or use !bangs',
      searchEngine: 'duckduckgo',
      openInNewTab: true,
      showBangHints: true
    },
    preview: '<div style="padding:10px;">'
      + '<input style="width:100%;padding:6px 10px;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:13px;" placeholder="Search or use !bangs" readonly />'
      + '<div style="font-size:10px;color:#8b949e;margin-top:6px;">!yt YouTube &nbsp; !gh GitHub &nbsp; !r Reddit &nbsp; !so Stack Overflow</div>'
      + '</div>',
    generateHtml: function (props) {
      var hints = props.showBangHints !== false
        ? '<div id="' + props.id + '-hints" style="font-size:10px;color:#8b949e;margin-top:5px;line-height:1.6;">'
          + '<span style="opacity:.7;">!g Google &nbsp; !yt YouTube &nbsp; !gh GitHub &nbsp; !r Reddit &nbsp; !so Stack Overflow &nbsp; !w Wikipedia &nbsp; !npm npm</span>'
          + '</div>'
        : '';
      return '<div class="dash-card" id="widget-' + props.id + '" style="height:100%;">'
        + '<div class="dash-card-head">'
        + '<span class="dash-card-title">' + renderIcon('search') + ' ' + _esc(props.title || 'Search') + '</span>'
        + '</div>'
        + '<div class="dash-card-body" style="padding:8px 10px;">'
        + '<form id="' + props.id + '-form" style="display:flex;gap:6px;" onsubmit="return false;">'
        + '<input id="' + props.id + '-input" type="text"'
        + '  placeholder="' + _esc(props.placeholder || 'Search or use !bangs') + '"'
        + '  autocomplete="off" spellcheck="false"'
        + '  style="flex:1;padding:7px 11px;background:#21262d;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:13px;outline:none;" />'
        + '<button id="' + props.id + '-btn" type="submit"'
        + '  style="padding:7px 14px;background:#238636;border:none;border-radius:6px;color:#fff;font-size:13px;cursor:pointer;">Go</button>'
        + '</form>'
        + hints
        + '</div></div>';
    },
    generateJs: function (props) {
      var fn = 'initSearch_' + props.id.replace(/-/g, '_');
      var provider = PROVIDERS[props.searchEngine] || PROVIDERS.duckduckgo;
      var newTab = props.openInNewTab !== false;
      return '(function() {'
        + '  var BANGS = ' + JSON.stringify(BUILT_IN_BANGS) + ';'
        + '  var DEFAULT_URL = "' + provider + '";'
        + '  var lastQuery = "";'
        + '  function navigate(q) {'
        + '    q = q.trim();'
        + '    if (!q) return;'
        + '    lastQuery = q;'
        + '    var url = DEFAULT_URL;'
        + '    var m = q.match(/^!(\\S+)\\s*(.*)/);'
        + '    if (m) {'
        + '      var bang = m[1].toLowerCase(), rest = m[2];'
        + '      if (BANGS[bang]) { url = BANGS[bang]; q = rest || q; }'
        + '    }'
        + '    var target = url.replace("{q}", encodeURIComponent(q));'
        + '    if (' + newTab + ') { window.open(target, "_blank", "noopener"); }'
        + '    else { window.location.href = target; }'
        + '  }'
        + '  var form = document.getElementById("' + props.id + '-form");'
        + '  var input = document.getElementById("' + props.id + '-input");'
        + '  if (form) form.addEventListener("submit", function() { navigate(input.value); });'
        + '  if (input) {'
        + '    input.addEventListener("keydown", function(e) {'
        + '      if (e.key === "ArrowUp") { e.preventDefault(); input.value = lastQuery; }'
        + '    });'
        + '  }'
        + '  document.addEventListener("keydown", function(e) {'
        + '    var tag = document.activeElement && document.activeElement.tagName;'
        + '    if (e.key === "s" && tag !== "INPUT" && tag !== "TEXTAREA" && !e.ctrlKey && !e.metaKey) {'
        + '      var inp = document.getElementById("' + props.id + '-input");'
        + '      if (inp) { inp.focus(); inp.select(); e.preventDefault(); }'
        + '    }'
        + '  });'
        + '})();';
    }
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : (typeof WIDGETS !== 'undefined' ? WIDGETS : {}));

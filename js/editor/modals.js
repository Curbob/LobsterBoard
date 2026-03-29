/**
 * Editor Modals Module
 * Directory browser modal and other standalone modals
 */
(function() {
  var state = window.BuilderState;

  window.openDirBrowser = async function openDirBrowser(startDir) {
    var browser = document.getElementById('dir-browser');
    var input = document.getElementById('prop-directorypath');
    var dir = startDir || input.value || '~';
    browser.style.display = 'block';
    browser.innerHTML = '<span style="color:var(--text-muted);">Loading...</span>';
    try {
      var res = await fetch('/api/browse-dirs?dir=' + encodeURIComponent(dir));
      var data = await res.json();
      if (data.status !== 'ok') { browser.innerHTML = '<span style="color:#f85149;">' + escapeHtml(data.message) + '</span>'; return; }
      var html = '<div style="margin-bottom:6px;color:var(--text-secondary);font-size:11px;word-break:break-all;">' + escapeHtml(data.path) + '</div>';
      if (data.imageCount > 0) {
        html += '<div style="margin-bottom:6px;padding:4px 8px;background:var(--bg-secondary);border-radius:4px;color:#3fb950;font-size:11px;">\uD83D\uDCF7 ' + escapeHtml(String(data.imageCount)) + ' image' + (data.imageCount !== 1 ? 's' : '') + ' in this folder</div>';
      }
      // Up one level
      var parent = data.path.replace(/\/[^/]+\/?$/, '') || '/';
      if (data.path !== parent) {
        html += '<div class="dir-entry" data-path="' + escapeHtml(parent) + '" style="cursor:pointer;padding:3px 6px;border-radius:4px;color:var(--text-primary);" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDCC1 ..</div>';
      }
      for (var i = 0; i < data.dirs.length; i++) {
        var d = data.dirs[i];
        var full = data.path + '/' + d;
        html += '<div class="dir-entry" data-path="' + escapeHtml(full) + '" style="cursor:pointer;padding:3px 6px;border-radius:4px;color:var(--text-primary);" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDCC1 ' + escapeHtml(d) + '</div>';
      }
      if (data.dirs.length === 0 && data.imageCount === 0) {
        html += '<div style="color:var(--text-muted);font-size:11px;padding:4px;">Empty directory</div>';
      }
      html += '<div style="margin-top:8px;display:flex;gap:4px;">';
      html += '<button type="button" style="flex:1;padding:4px 8px;background:var(--accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;">\u2713 Select this folder</button>';
      html += '<button type="button" onclick="document.getElementById(\'dir-browser\').style.display=\'none\'" style="padding:4px 8px;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:11px;">Cancel</button>';
      html += '</div>';
      browser.innerHTML = html;
      // Attach select button handler safely
      var selectBtn = browser.querySelector('button');
      if (selectBtn) selectBtn.addEventListener('click', function() { selectDir(data.path); });
      browser.querySelectorAll('.dir-entry').forEach(function(el) {
        el.addEventListener('click', function() { openDirBrowser(el.dataset.path); });
      });
    } catch (e) { browser.innerHTML = '<span style="color:#f85149;">Error: ' + escapeHtml(e.message) + '</span>'; }
  };

  window.selectDir = function selectDir(dirPath) {
    var input = document.getElementById('prop-directorypath');
    input.value = dirPath;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('dir-browser').style.display = 'none';
  };
})();

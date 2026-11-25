/**
 * LobsterBoard - Media Server Widgets
 * Radarr, Sonarr, Seerr, Plex, Prowlarr and SABnzbd.
 *
 * Each widget has its own Service URL and API key (kept server-side in
 * secrets.json) and a Style option: "numbers" (stat tiles) or "visual"
 * (rings, bars, posters, speed graph). Data comes from /api/media/<service>,
 * which talks to the service; the browser never sees the key.
 *
 * Inspired by Media Server Dashboard Extended
 * (https://github.com/freelancer381/media-server-dashboard-extended, MIT).
 */
(function(WIDGETS) {

  // ─────────────────────────────────────────────
  // Shared runtime (used by the generated widget scripts)
  // ─────────────────────────────────────────────

  var M = window._lbMedia = window._lbMedia || {};
  M.timers = M.timers || {};
  M.ctx = M.ctx || {};

  var esc = function(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  M.esc = esc;

  M.num = function(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString();
  };

  M.bytes = function(n) {
    if (n == null || isNaN(n)) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'], i = 0;
    n = Number(n);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
  };

  M.speed = function(bps) { return bps == null ? '—' : M.bytes(bps) + '/s'; };

  M.when = function(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var d = t - Date.now(), a = Math.abs(d);
    var s = a < 3600000 ? Math.max(1, Math.round(a / 60000)) + 'm'
      : a < 86400000 ? Math.round(a / 3600000) + 'h'
      : Math.round(a / 86400000) + 'd';
    return d >= 0 ? 'in ' + s : s + ' ago';
  };

  M.pct = function(part, whole) { return whole ? Math.max(0, Math.min(100, Math.round(part / whole * 100))) : 0; };

  M.tiles = function(rows) {
    return '<div class="lbm-tiles">' + rows.filter(Boolean).map(function(r) {
      return '<div class="lbm-tile"><div class="lbm-tile-v"' + (r[2] ? ' style="color:' + r[2] + '"' : '') + '>' + esc(r[1]) +
        '</div><div class="lbm-tile-l">' + esc(r[0]) + '</div></div>';
    }).join('') + '</div>';
  };

  M.ring = function(pct, color, big, small) {
    var r = 30, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<div class="lbm-ring"><svg viewBox="0 0 72 72" aria-hidden="true">' +
      '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="var(--bg-tertiary,#21262d)" stroke-width="7"/>' +
      '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 36 36)"/></svg>' +
      '<div class="lbm-ring-t"><b>' + esc(big) + '</b><span>' + esc(small || '') + '</span></div></div>';
  };

  M.bar = function(pct, color) {
    return '<div class="lbm-bar"><div style="width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + color + '"></div></div>';
  };

  M.stacked = function(parts) {
    var total = parts.reduce(function(n, p) { return n + (p[1] || 0); }, 0) || 1;
    return '<div class="lbm-stack">' + parts.filter(function(p) { return p[1] > 0; }).map(function(p) {
      return '<div title="' + esc(p[0] + ': ' + p[1]) + '" style="flex:' + p[1] / total + ';background:' + p[2] + '"></div>';
    }).join('') + '</div><div class="lbm-legend">' + parts.map(function(p) {
      return '<span><i style="background:' + p[2] + '"></i>' + esc(p[0]) + ' <b>' + M.num(p[1]) + '</b></span>';
    }).join('') + '</div>';
  };

  M.spark = function(points, color) {
    if (!points || points.length < 2) return '<div class="lbm-spark"></div>';
    var max = Math.max.apply(null, points.concat([1]));
    var w = 100, h = 30, step = w / (points.length - 1);
    var pts = points.map(function(p, i) { return (i * step).toFixed(1) + ',' + (h - p / max * (h - 2) - 1).toFixed(1); });
    return '<div class="lbm-spark"><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">' +
      '<polygon points="0,30 ' + pts.join(' ') + ' 100,30" fill="' + color + '" opacity="0.15"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg></div>';
  };

  M.poster = function(item, caption) {
    var title = esc(item.title || '') + (item.year ? ' (' + esc(item.year) + ')' : '');
    // The initial sits underneath; the poster covers it, or hides itself if it fails to load.
    var img = '<div class="lbm-poster-ph">' + esc(String(item.title || '?').slice(0, 1)) + '</div>' + (item.poster
      ? '<img src="' + esc(item.poster) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      : '');
    return '<div class="lbm-poster" title="' + title + '">' + img +
      (caption ? '<div class="lbm-poster-c">' + esc(caption) + '</div>' : '') + '</div>';
  };

  M.posters = function(items, captionFn) {
    if (!items || !items.length) return '';
    return '<div class="lbm-posters">' + items.map(function(i) { return M.poster(i, captionFn ? captionFn(i) : ''); }).join('') + '</div>';
  };

  M.list = function(rows) {
    return '<div class="lbm-list">' + rows.map(function(r) {
      return '<div class="lbm-row"><span class="lbm-row-t">' + esc(r[0]) + '</span><span class="lbm-row-m">' + esc(r[1] || '') + '</span></div>';
    }).join('') + '</div>';
  };

  M.health = function(health) {
    if (!health || !health.length) return '';
    return '<div class="lbm-health">' + health.slice(0, 2).map(function(h) {
      var icon = h.level === 'error' ? '⛔' : h.level === 'info' ? 'ℹ️' : '⚠️';
      return '<div class="lbm-health-' + esc(h.level) + '" title="' + esc(h.message) + '">' + icon + ' ' + esc(h.message) + '</div>';
    }).join('') + (health.length > 2 ? '<div class="lbm-muted">+' + (health.length - 2) + ' more</div>' : '') + '</div>';
  };

  M.section = function(label, html) {
    return html ? '<div class="lbm-sec"><div class="lbm-sec-l">' + esc(label) + '</div>' + html + '</div>' : '';
  };

  M.C = {
    blue: 'var(--accent-blue,#58a6ff)', green: 'var(--accent-green,#3fb950)', orange: 'var(--accent-orange,#d29922)',
    red: 'var(--accent-red,#f85149)', purple: 'var(--accent-purple,#a371f7)', muted: 'var(--text-muted,#8b949e)'
  };

  M.renderers = M.renderers || {};

  /**
   * Fit poster grids to the widget: the grids already wrap to the width (CSS),
   * so here we hide posters from the end, a row at a time, until nothing spills
   * past the bottom of the widget body. Always keeps at least one row.
   */
  M.fit = function(body) {
    if (!body) return;
    var grids = Array.prototype.slice.call(body.querySelectorAll('.lbm-posters'));
    if (!grids.length) return;
    var sections = grids.map(function(g) { return g.closest('.lbm-sec') || g; });
    sections.forEach(function(sec) { sec.style.display = ''; });
    grids.forEach(function(g) { Array.prototype.forEach.call(g.children, function(c) { c.style.display = ''; }); });
    var visible = function(g) { return Array.prototype.filter.call(g.children, function(c) { return c.style.display !== 'none'; }); };
    var rows = function(items) {
      var tops = {};
      items.forEach(function(c) { tops[c.offsetTop] = true; });
      return Object.keys(tops).length;
    };
    for (var guard = 0; guard < 200 && body.scrollHeight > body.clientHeight + 1; guard++) {
      var target = null;
      for (var i = grids.length - 1; i >= 0 && !target; i--) {
        var vis = visible(grids[i]);
        if (vis.length && rows(vis) > 1) target = vis[vis.length - 1];
      }
      if (!target) break;
      target.style.display = 'none';
    }
    // Still spilling with one row left: drop whole poster sections (last first) instead of cutting posters in half
    for (var j = sections.length - 1; j >= 0 && body.scrollHeight > body.clientHeight + 1; j--) {
      sections[j].style.display = 'none';
    }
  };

  M.observers = M.observers || {};

  M.start = function(id, service, refreshSec, style, posterScale) {
    var scale = posterScale === '2' ? 'lbm-p2' : posterScale === '1.5' ? 'lbm-p15' : '';
    var bodyId = id + '-body';
    if (M.timers[id]) clearInterval(M.timers[id]);
    var ctx = M.ctx[id] = M.ctx[id] || {};
    var inflight = false;

    function show(html) {
      var el = document.getElementById(bodyId);
      if (!el) return false;
      el.innerHTML = html;
      M.fit(el);
      // Re-fit when the widget is resized (also while dragging its corner in the editor)
      if (typeof ResizeObserver !== 'undefined') {
        var o = M.observers[id];
        if (!o || o.el !== el) {
          if (o) o.ro.disconnect();
          var ro = new ResizeObserver(function() { M.fit(el); });
          ro.observe(el);
          M.observers[id] = { el: el, ro: ro };
        }
      }
      return true;
    }

    function tick() {
      if (!document.getElementById(bodyId)) { clearInterval(M.timers[id]); delete M.timers[id]; return; }
      if (inflight) return;
      inflight = true;
      fetch('/api/media/' + service + '?widgetId=' + encodeURIComponent(id), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.ok) {
            var setup = data && /^(not_saved|no_url|no_key|bad_url)$/.test(data.code);
            show('<div class="lbm-msg' + (setup ? '' : ' lbm-err') + '">' + (setup ? '⚙️ ' : '⚠️ ') + esc((data && data.error) || 'No data') + '</div>');
            return;
          }
          var r = M.renderers[service];
          show('<div class="lbm lbm-' + (style === 'visual' ? 'visual' : 'numbers') + (scale ? ' ' + scale : '') + '">' + r(data, style === 'visual' ? 'visual' : 'numbers', ctx) + '</div>');
        })
        .catch(function() { show('<div class="lbm-msg lbm-err">⚠️ Could not reach LobsterBoard server</div>'); })
        .then(function() { inflight = false; });
    }

    tick();
    M.timers[id] = setInterval(tick, Math.max(5, Number(refreshSec) || 60) * 1000);
  };

  // ─────────────────────────────────────────────
  // Styles (injected once)
  // ─────────────────────────────────────────────

  if (typeof document !== 'undefined' && !document.getElementById('lbm-style')) {
    var css = document.createElement('style');
    css.id = 'lbm-style';
    css.textContent = [
      '.lbm{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0}',
      '.lbm-msg{color:var(--text-muted,#8b949e);font-size:0.85em;padding:4px 0;line-height:1.4}',
      '.lbm-err{color:var(--accent-orange,#d29922)}',
      '.lbm-muted{color:var(--text-muted,#8b949e);font-size:0.8em}',
      '.lbm-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}',
      '.lbm-tile{background:var(--bg-tertiary,#21262d);border-radius:6px;padding:6px 8px;min-width:0}',
      '.lbm-tile-v{font-size:1.25em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-tile-l{font-size:0.72em;color:var(--text-muted,#8b949e);text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-top{display:flex;gap:12px;align-items:center;min-width:0}',
      '.lbm-top-side{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;font-size:0.85em}',
      '.lbm-top-side b{font-weight:600}',
      '.lbm-ring{position:relative;width:72px;height:72px;flex:none}',
      '.lbm-ring svg{width:100%;height:100%}',
      '.lbm-ring-t{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}',
      '.lbm-ring-t b{font-size:1em}.lbm-ring-t span{font-size:0.62em;color:var(--text-muted,#8b949e)}',
      '.lbm-bar{height:6px;background:var(--bg-tertiary,#21262d);border-radius:3px;overflow:hidden;flex:1;min-width:30px}',
      '.lbm-bar>div{height:100%;border-radius:3px}',
      '.lbm-stack{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--bg-tertiary,#21262d)}',
      '.lbm-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:0.75em;color:var(--text-secondary,#c9d1d9)}',
      '.lbm-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}',
      '.lbm-spark{height:34px}.lbm-spark svg{width:100%;height:100%;display:block}',
      // Posters wrap to the widget width; --lbm-pw is the smallest a poster may get (set by Poster size)
      '.lbm-posters{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--lbm-pw,54px),1fr));gap:6px;flex:none}',
      '.lbm-poster{position:relative;min-width:0;aspect-ratio:2/3;border-radius:4px;overflow:hidden;background:var(--bg-tertiary,#21262d)}',
      '.lbm-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}',
      '.lbm-poster-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.4em;color:var(--text-muted,#8b949e)}',
      '.lbm-poster-c{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);color:#fff;font-size:0.62em;padding:1px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-list{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.lbm-row{display:flex;gap:8px;justify-content:space-between;font-size:0.82em;min-width:0}',
      '.lbm-row-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.lbm-row-m{color:var(--text-muted,#8b949e);white-space:nowrap;flex:none}',
      '.lbm-sec{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.lbm-sec-l{font-size:0.7em;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted,#8b949e)}',
      '.lbm-health{display:flex;flex-direction:column;gap:2px;font-size:0.78em}',
      '.lbm-health>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-health-warning{color:var(--accent-orange,#d29922)}.lbm-health-error{color:var(--accent-red,#f85149)}.lbm-health-info{color:var(--text-muted,#8b949e)}',
      '.lbm-q{display:flex;flex-direction:column;gap:5px}',
      '.lbm-q-i{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.lbm-q-h{display:flex;justify-content:space-between;gap:8px;font-size:0.78em;min-width:0}',
      '.lbm-q-h span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.lbm-q-h span:last-child{color:var(--text-muted,#8b949e);flex:none}',
      '.lbm-big{font-size:1.6em;font-weight:600;line-height:1.1}',
      '.lbm-pill{display:inline-block;font-size:0.7em;padding:1px 6px;border-radius:8px;background:var(--bg-tertiary,#21262d);color:var(--text-secondary,#c9d1d9);vertical-align:middle}',
      '.lbm-play{display:flex;gap:8px;align-items:center;min-width:0}',
      '.lbm-play .lbm-poster{width:40px;flex:none}',
      '.lbm-p15{--lbm-pw:81px}.lbm-p15 .lbm-play .lbm-poster{width:60px}.lbm-p15 .lbm-poster-c{font-size:0.7em}',
      '.lbm-p2{--lbm-pw:108px}.lbm-p2 .lbm-play .lbm-poster{width:80px}.lbm-p2 .lbm-poster-c{font-size:0.78em}',
      '.lbm-play-i{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '.lbm-play-t{font-size:0.85em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-play-s{font-size:0.72em;color:var(--text-muted,#8b949e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-ix{display:grid;grid-template-columns:minmax(60px,auto) 1fr auto;gap:4px 8px;align-items:center;font-size:0.78em}',
      '.lbm-ix span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.lbm-ix span:last-child{color:var(--text-muted,#8b949e);white-space:nowrap}',
      '.lbm-foot{font-size:0.72em;color:var(--text-muted,#8b949e);margin-top:auto}'
    ].join('\n');
    document.head.appendChild(css);
  }

  // ─────────────────────────────────────────────
  // Renderers: (data, style, ctx) -> HTML
  // ─────────────────────────────────────────────

  var C = M.C;

  M.renderers.radarr = function(d, style) {
    var s = d.stats || {};
    var next = (d.upcoming || [])[0];
    if (style === 'numbers') {
      return M.tiles([
        ['Movies', M.num(s.movies)], ['On disk', M.num(s.onDisk), C.green], ['Missing', M.num(s.missing), s.missing ? C.orange : null],
        ['Queue', M.num(s.queue), s.queue ? C.blue : null], ['Size', M.bytes(s.sizeOnDisk)], s.freeSpace != null && ['Free', M.bytes(s.freeSpace)]
      ]) + (next ? M.list([['Next: ' + next.title, M.when(next.date)]]) : '') + M.health(d.health);
    }
    var pct = M.pct(s.onDisk, s.movies);
    return '<div class="lbm-top">' + M.ring(pct, C.green, pct + '%', 'on disk') +
      '<div class="lbm-top-side"><div><b>' + M.num(s.onDisk) + '</b> / ' + M.num(s.movies) + ' movies</div>' +
      '<div>' + M.num(s.missing) + ' missing · ' + M.num(s.queue) + ' in queue</div>' +
      '<div class="lbm-muted">' + M.bytes(s.sizeOnDisk) + (s.freeSpace != null ? ' · ' + M.bytes(s.freeSpace) + ' free' : '') + '</div></div></div>' +
      M.health(d.health) +
      M.section('Recently added', M.posters(d.recent, function(m) { return m.quality || ''; })) +
      M.section('Coming up', (d.upcoming || []).length ? M.list(d.upcoming.slice(0, 3).map(function(m) { return [m.title + (m.year ? ' (' + m.year + ')' : ''), M.when(m.date)]; })) : '');
  };

  M.renderers.sonarr = function(d, style) {
    var s = d.stats || {};
    var next = (d.upcoming || [])[0];
    if (style === 'numbers') {
      return M.tiles([
        ['Series', M.num(s.series)], ['Episodes', M.num(s.episodesOnDisk) + '/' + M.num(s.episodes), C.green],
        ['Missing', M.num(s.missing), s.missing ? C.orange : null], ['Queue', M.num(s.queue), s.queue ? C.blue : null],
        ['Size', M.bytes(s.sizeOnDisk)], s.freeSpace != null && ['Free', M.bytes(s.freeSpace)]
      ]) + (next ? M.list([['Next: ' + next.title + ' ' + next.episode, M.when(next.date)]]) : '') + M.health(d.health);
    }
    var pct = M.pct(s.episodesOnDisk, s.episodes);
    return '<div class="lbm-top">' + M.ring(pct, C.blue, pct + '%', 'episodes') +
      '<div class="lbm-top-side"><div><b>' + M.num(s.series) + '</b> series · <b>' + M.num(s.episodesOnDisk) + '</b>/' + M.num(s.episodes) + ' episodes</div>' +
      '<div>' + M.num(s.missing) + ' missing · ' + M.num(s.queue) + ' in queue</div>' +
      '<div class="lbm-muted">' + M.bytes(s.sizeOnDisk) + (s.freeSpace != null ? ' · ' + M.bytes(s.freeSpace) + ' free' : '') + '</div></div></div>' +
      M.health(d.health) +
      M.section('Recently added', M.posters(d.recent, function(e) { return e.episode || ''; })) +
      M.section('Airing soon', (d.upcoming || []).length ? M.list(d.upcoming.slice(0, 3).map(function(e) { return [e.title + ' ' + e.episode, M.when(e.date)]; })) : '');
  };

  M.renderers.seerr = function(d, style) {
    var s = d.stats || {};
    if (style === 'numbers') {
      return M.tiles([
        ['Pending', M.num(s.pending), s.pending ? C.orange : null], ['Approved', M.num(s.approved), C.blue],
        ['Processing', M.num(s.processing), C.purple], ['Available', M.num(s.available), C.green],
        ['Requests', M.num(s.total)], s.openIssues != null && ['Open issues', M.num(s.openIssues), s.openIssues ? C.red : null]
      ]) + M.health(d.health);
    }
    var dot = { pending: C.orange, approved: C.blue, declined: C.red, failed: C.red, completed: C.green };
    return M.stacked([
      ['Pending', s.pending, C.orange], ['Approved', s.approved, C.blue], ['Processing', s.processing, C.purple],
      ['Available', s.available, C.green], ['Declined', s.declined, C.red]
    ]) +
      (s.openIssues ? '<div class="lbm-muted">' + M.num(s.openIssues) + ' open issue' + (s.openIssues === 1 ? '' : 's') + '</div>' : '') +
      M.section('Latest requests', M.posters(d.recent, function(r) { return r.requestedBy || r.status; })) +
      ((d.recent || []).length ? '<div class="lbm-list">' + d.recent.slice(0, 3).map(function(r) {
        return '<div class="lbm-row"><span class="lbm-row-t"><span style="color:' + (dot[r.status] || C.muted) + '">●</span> ' + esc(r.title) +
          '</span><span class="lbm-row-m">' + esc(r.status) + ' · ' + esc(M.when(r.date)) + '</span></div>';
      }).join('') + '</div>' : '');
  };

  M.renderers.plex = function(d, style) {
    var s = d.stats || {};
    if (style === 'numbers') {
      return M.tiles([
        ['Streams', M.num(s.streams), s.streams ? C.green : null], ['Transcoding', M.num(s.transcoding), s.transcoding ? C.orange : null],
        ['Movies', M.num(s.movies)], ['Shows', M.num(s.shows)], ['Episodes', M.num(s.episodes)], s.music ? ['Artists', M.num(s.music)] : null
      ]) + ((d.playing || []).length ? M.list(d.playing.slice(0, 3).map(function(p) {
        return [(p.user ? p.user + ': ' : '') + p.title, p.progress + '%'];
      })) : '');
    }
    var playing = d.playing || [];
    var html = playing.length
      ? M.section('Now playing', '<div class="lbm-q">' + playing.slice(0, 4).map(function(p) {
          return '<div class="lbm-play">' + M.poster(p) + '<div class="lbm-play-i"><div class="lbm-play-t">' + esc(p.title) + '</div>' +
            '<div class="lbm-play-s">' + esc(p.subtitle) + '</div>' +
            '<div class="lbm-play-s">' + (p.state === 'paused' ? '⏸ ' : '▶ ') + esc([p.user, p.player].filter(Boolean).join(' · ')) +
            (p.transcode ? ' <span class="lbm-pill">transcode</span>' : '') + '</div>' +
            M.bar(p.progress, p.state === 'paused' ? C.muted : C.orange) + '</div></div>';
        }).join('') + '</div>')
      : '<div class="lbm-msg">Nothing playing right now</div>';
    return html + M.section('Recently added', M.posters(d.recent, function(r) { return r.subtitle || ''; })) +
      '<div class="lbm-foot">' + M.num(s.movies) + ' movies · ' + M.num(s.shows) + ' shows · ' + M.num(s.episodes) + ' episodes</div>';
  };

  M.renderers.prowlarr = function(d, style) {
    var s = d.stats || {};
    var failRate = s.queries ? Math.round(s.failedQueries / s.queries * 1000) / 10 : null;
    if (style === 'numbers') {
      return M.tiles([
        ['Indexers', M.num(s.enabled) + '/' + M.num(s.indexers)], ['Queries', M.num(s.queries)], ['Grabs', M.num(s.grabs), C.green],
        failRate != null && ['Failed', failRate + '%', failRate > 5 ? C.red : null]
      ]) + M.health(d.health);
    }
    var list = d.indexers || [];
    var max = Math.max.apply(null, list.map(function(i) { return i.queries; }).concat([1]));
    return M.health(d.health) +
      (list.length ? M.section('Queries per indexer', '<div class="lbm-ix">' + list.slice(0, 6).map(function(i) {
        var fail = i.queries ? Math.round(i.failedQueries / i.queries * 100) : 0;
        return '<span title="' + esc(i.name) + '">' + esc(i.name) + '</span>' + M.bar(M.pct(i.queries, max), fail > 5 ? C.orange : C.blue) +
          '<span>' + M.num(i.grabs) + ' grabs' + (fail ? ' · ' + fail + '% fail' : '') + '</span>';
      }).join('') + '</div>') : '<div class="lbm-msg">No indexer statistics yet</div>') +
      '<div class="lbm-foot">' + M.num(s.enabled) + ' of ' + M.num(s.indexers) + ' indexers enabled · ' + M.num(s.grabs) + ' grabs</div>';
  };

  M.renderers.sabnzbd = function(d, style, ctx) {
    var s = d.stats || {};
    ctx.speeds = (ctx.speeds || []).concat([s.speedBps || 0]).slice(-60);
    var status = s.paused ? 'Paused' : (s.status || 'Idle');
    if (style === 'numbers') {
      return M.tiles([
        ['Speed', s.paused ? 'Paused' : M.speed(s.speedBps), s.paused ? C.orange : C.green], ['Queue', M.num(s.queue)],
        ['Left', M.bytes(s.leftBytes)], ['Time left', s.queue ? (s.timeLeft || '—') : '—'],
        s.today != null && ['Today', M.bytes(s.today)], s.month != null && ['This month', M.bytes(s.month)],
        s.failed ? ['Failed', M.num(s.failed), C.red] : null
      ]);
    }
    return '<div class="lbm-top"><div><div class="lbm-big" style="color:' + (s.paused ? C.orange : C.green) + '">' +
      (s.paused ? 'Paused' : M.speed(s.speedBps)) + '</div><div class="lbm-muted">' + esc(status) +
      (s.queue ? ' · ' + M.num(s.queue) + ' in queue · ' + esc(s.timeLeft || '') + ' left' : '') + '</div></div></div>' +
      M.spark(ctx.speeds, s.paused ? C.orange : C.green) +
      ((d.items || []).length ? '<div class="lbm-q">' + d.items.slice(0, 4).map(function(i) {
        return '<div class="lbm-q-i"><div class="lbm-q-h"><span title="' + esc(i.name) + '">' + esc(i.name) + '</span><span>' +
          Math.round(i.percent) + '% · ' + M.bytes(i.sizeBytes) + '</span></div>' + M.bar(i.percent, i.status === 'Downloading' ? C.green : C.muted) + '</div>';
      }).join('') + '</div>' : '<div class="lbm-msg">Queue is empty</div>') +
      (s.today != null ? '<div class="lbm-foot">' + M.bytes(s.today) + ' today · ' + M.bytes(s.month) + ' this month' + (s.failed ? ' · ' + M.num(s.failed) + ' failed' : '') + '</div>' : '');
  };

  // ─────────────────────────────────────────────
  // Widget definitions
  // ─────────────────────────────────────────────

  function mediaWidget(service, o) {
    return {
      name: o.name,
      icon: o.emoji,
      category: 'large',
      description: o.description + ' Set the Service URL and API key, save the layout, then choose Numbers or Visual style.' + (o.posters ? ' Poster size enlarges the posters in Visual style.' : ''),
      defaultWidth: 360,
      defaultHeight: 260,
      hasApiKey: true,
      hideApiKeyVar: true,
      placeholders: { serviceUrl: o.placeholder },
      properties: Object.assign({
        title: o.name,
        serviceUrl: '',
        apiKey: '',
        apiKeyNote: o.keyNote,
        displayStyle: 'visual',
        refreshInterval: o.refresh
      }, o.posters ? { posterSize: '1' } : {}),
      preview: '<div style="padding:8px;font-size:11px;color:#8b949e;">' + o.emoji + ' ' + o.name + ' stats</div>',
      generateHtml: function(props) {
        return '<div class="dash-card" id="widget-' + props.id + '" style="height:100%;">' +
          '<div class="dash-card-head"><span class="dash-card-title">' + renderIcon(service) + ' ' + esc(props.title || o.name) + '</span></div>' +
          '<div class="dash-card-body" id="' + props.id + '-body"><div class="lbm-msg">Loading…</div></div></div>';
      },
      generateJs: function(props) {
        var style = props.displayStyle === 'numbers' ? 'numbers' : 'visual';
        var poster = props.posterSize === '2' ? '2' : props.posterSize === '1.5' ? '1.5' : '1';
        var refresh = Math.max(5, parseInt(props.refreshInterval, 10) || o.refresh);
        return 'window._lbMedia && window._lbMedia.start(' + JSON.stringify(String(props.id)) + ', ' + JSON.stringify(service) + ', ' + refresh + ', ' + JSON.stringify(style) + ', ' + JSON.stringify(poster) + ');';
      }
    };
  }

  WIDGETS['media-radarr'] = mediaWidget('radarr', {
    posters: true,
    name: 'Radarr', emoji: '🎬', refresh: 60, placeholder: 'http://192.168.1.20:7878',
    description: 'Movie library from Radarr: movies on disk, missing, queue, recently added and upcoming releases.',
    keyNote: 'Radarr → Settings → General → API Key'
  });

  WIDGETS['media-sonarr'] = mediaWidget('sonarr', {
    posters: true,
    name: 'Sonarr', emoji: '📺', refresh: 60, placeholder: 'http://192.168.1.20:8989',
    description: 'TV library from Sonarr: series, episodes on disk, missing, queue, recently added and airing soon.',
    keyNote: 'Sonarr → Settings → General → API Key'
  });

  WIDGETS['media-seerr'] = mediaWidget('seerr', {
    posters: true,
    name: 'Seerr', emoji: '🙋', refresh: 60, placeholder: 'http://192.168.1.20:5055',
    description: 'Requests from Seerr (also Overseerr / Jellyseerr): pending, approved, available and the latest requests.',
    keyNote: 'Seerr → Settings → General → API Key'
  });

  WIDGETS['media-plex'] = mediaWidget('plex', {
    posters: true,
    name: 'Plex', emoji: '▶️', refresh: 15, placeholder: 'http://192.168.1.20:32400',
    description: 'Plex Media Server: who is watching what, transcodes, library counts and recently added.',
    keyNote: 'Your X-Plex-Token: in Plex Web, open any item → ⋯ → Get Info → View XML, and copy the X-Plex-Token value from the address bar.'
  });

  WIDGETS['media-prowlarr'] = mediaWidget('prowlarr', {
    name: 'Prowlarr', emoji: '🔎', refresh: 120, placeholder: 'http://192.168.1.20:9696',
    description: 'Indexers from Prowlarr: enabled indexers, queries, grabs, failure rates and health.',
    keyNote: 'Prowlarr → Settings → General → API Key'
  });

  WIDGETS['media-sabnzbd'] = mediaWidget('sabnzbd', {
    name: 'SABnzbd', emoji: '⬇️', refresh: 10, placeholder: 'http://192.168.1.20:8080',
    description: 'Downloads from SABnzbd: speed graph, queue with progress, time left and totals.',
    keyNote: 'SABnzbd → Config → General → Security → API Key'
  });

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

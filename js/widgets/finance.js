/**
 * LobsterBoard Finance Widgets
 * stock-ticker  — equities via Yahoo Finance proxy (no API key required)
 * crypto-price  — cryptocurrencies via CoinGecko proxy (no API key required)
 */
(function (WIDGETS) {
  'use strict';

  function renderIcon(name) {
    if (typeof window !== 'undefined' && window.renderIcon) return window.renderIcon(name);
    return '';
  }

  function row(left, price, change, up) {
    var color = up ? '#3fb950' : '#f85149';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;">'
      + '<span style="font-weight:600;font-size:13px;">' + _esc(left) + '</span>'
      + '<span style="text-align:right;">'
      + '<span style="font-size:13px;font-weight:700;margin-right:8px;">' + _esc(price) + '</span>'
      + '<span style="font-size:11px;color:' + color + ';font-weight:600;">' + _esc(change) + '%</span>'
      + '</span></div>';
  }

  // ── Stock Ticker ──────────────────────────────────────────────────────────

  WIDGETS['stock-ticker'] = {
    name: 'Stock Ticker',
    icon: '📈',
    category: 'large',
    description: 'Live stock prices via Yahoo Finance. No API key required.',
    defaultWidth: 320,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'Stocks',
      symbols: 'AAPL,MSFT,GOOGL,AMZN',
      refreshInterval: 300
    },
    preview: '<div style="padding:6px;font-size:11px;">'
      + '<div style="display:flex;justify-content:space-between;"><span>AAPL</span><span>$182.50 <span style="color:#3fb950;">+1.24%</span></span></div>'
      + '<div style="display:flex;justify-content:space-between;"><span>MSFT</span><span>$375.20 <span style="color:#f85149;">-0.38%</span></span></div>'
      + '</div>',
    generateHtml: function (props) {
      return '<div class="dash-card" id="widget-' + props.id + '" style="height:100%;">'
        + '<div class="dash-card-head">'
        + '<span class="dash-card-title">' + renderIcon('stock') + ' ' + _esc(props.title || 'Stocks') + '</span>'
        + '<span class="dash-card-badge" id="' + props.id + '-badge">—</span>'
        + '</div>'
        + '<div class="dash-card-body" id="' + props.id + '-list" style="overflow-y:auto;padding:4px 8px;">'
        + '<div style="color:#8b949e;font-size:12px;">Loading...</div>'
        + '</div></div>';
    },
    generateJs: function (props) {
      var fn = 'update_' + props.id.replace(/-/g, '_');
      return 'async function ' + fn + '() {'
        + '  var list = document.getElementById("' + props.id + '-list");'
        + '  var badge = document.getElementById("' + props.id + '-badge");'
        + '  if (!list) return;'
        + '  try {'
        + '    var res = await fetch("/api/finance/stocks?symbols=" + encodeURIComponent("' + (props.symbols || 'AAPL,MSFT') + '"));'
        + '    if (!res.ok) throw new Error("HTTP " + res.status);'
        + '    var data = await res.json();'
        + '    var ok = data.filter(function(d) { return !d.error; });'
        + '    list.innerHTML = data.map(function(d) {'
        + '      if (d.error) return \'<div style="padding:5px 0;border-bottom:1px solid #21262d;color:#8b949e;font-size:12px;">\' + _esc(d.symbol) + \' — \' + _esc(d.error) + \'</div>\';'
        + '      var color = d.up ? "#3fb950" : "#f85149";'
        + '      return \'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;">\''
        + '        + \'<span style="font-weight:600;font-size:13px;">\' + _esc(d.symbol) + \'</span>\''
        + '        + \'<span style="text-align:right;">\''
        + '        + \'<span style="font-size:13px;font-weight:700;margin-right:8px;">$\' + _esc(d.price) + \'</span>\''
        + '        + \'<span style="font-size:11px;color:\' + color + \';font-weight:600;">\' + _esc(d.pctChange) + \'%</span>\''
        + '        + \'</span></div>\';'
        + '    }).join("");'
        + '    if (badge) badge.textContent = ok.length + " stocks";'
        + '  } catch (e) {'
        + '    console.error("Stock ticker error:", e);'
        + '    if (list) list.innerHTML = \'<div style="color:#f85149;font-size:12px;">Failed to load</div>\';'
        + '  }'
        + '}'
        + fn + '();'
        + 'setInterval(' + fn + ', ' + ((props.refreshInterval || 300) * 1000) + ');';
    }
  };

  // ── Crypto Price ──────────────────────────────────────────────────────────

  WIDGETS['crypto-price'] = {
    name: 'Crypto Price',
    icon: '₿',
    category: 'large',
    description: 'Live crypto prices via CoinGecko. No API key required.',
    defaultWidth: 320,
    defaultHeight: 280,
    hasApiKey: false,
    properties: {
      title: 'Crypto',
      coins: 'bitcoin,ethereum,solana',
      currency: 'usd',
      refreshInterval: 300
    },
    preview: '<div style="padding:6px;font-size:11px;">'
      + '<div style="display:flex;justify-content:space-between;"><span>Bitcoin</span><span>$67,240 <span style="color:#3fb950;">+2.1%</span></span></div>'
      + '<div style="display:flex;justify-content:space-between;"><span>Ethereum</span><span>$3,521 <span style="color:#f85149;">-0.8%</span></span></div>'
      + '</div>',
    generateHtml: function (props) {
      return '<div class="dash-card" id="widget-' + props.id + '" style="height:100%;">'
        + '<div class="dash-card-head">'
        + '<span class="dash-card-title">' + renderIcon('crypto') + ' ' + _esc(props.title || 'Crypto') + '</span>'
        + '<span class="dash-card-badge" id="' + props.id + '-badge">—</span>'
        + '</div>'
        + '<div class="dash-card-body" id="' + props.id + '-list" style="overflow-y:auto;padding:4px 8px;">'
        + '<div style="color:#8b949e;font-size:12px;">Loading...</div>'
        + '</div></div>';
    },
    generateJs: function (props) {
      var fn = 'update_' + props.id.replace(/-/g, '_');
      var currency = (props.currency || 'usd').toUpperCase();
      return 'async function ' + fn + '() {'
        + '  var list = document.getElementById("' + props.id + '-list");'
        + '  var badge = document.getElementById("' + props.id + '-badge");'
        + '  if (!list) return;'
        + '  try {'
        + '    var res = await fetch("/api/finance/crypto?coins=" + encodeURIComponent("' + (props.coins || 'bitcoin,ethereum') + '") + "&currency=' + (props.currency || 'usd') + '");'
        + '    if (!res.ok) throw new Error("HTTP " + res.status);'
        + '    var data = await res.json();'
        + '    list.innerHTML = data.map(function(d) {'
        + '      var color = d.up ? "#3fb950" : "#f85149";'
        + '      return \'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #21262d;">\''
        + '        + \'<span style="font-weight:600;font-size:13px;">\' + _esc(d.name) + \'</span>\''
        + '        + \'<span style="text-align:right;">\''
        + '        + \'<span style="font-size:13px;font-weight:700;margin-right:8px;">' + currency + ' \' + _esc(d.price) + \'</span>\''
        + '        + \'<span style="font-size:11px;color:\' + color + \';font-weight:600;">\' + _esc(d.pctChange) + \'%</span>\''
        + '        + \'</span></div>\';'
        + '    }).join("");'
        + '    if (badge) badge.textContent = data.length + " coins";'
        + '  } catch (e) {'
        + '    console.error("Crypto price error:", e);'
        + '    if (list) list.innerHTML = \'<div style="color:#f85149;font-size:12px;">Failed to load</div>\';'
        + '  }'
        + '}'
        + fn + '();'
        + 'setInterval(' + fn + ', ' + ((props.refreshInterval || 300) * 1000) + ');';
    }
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : (typeof WIDGETS !== 'undefined' ? WIDGETS : {}));

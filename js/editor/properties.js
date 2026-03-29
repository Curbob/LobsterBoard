/**
 * Editor Properties Module
 * Properties panel: init, show/hide, update inputs, change handlers, quick links, images
 */
(function() {
  var state = window.BuilderState;

  // Properties already handled by hardcoded UI groups
  var HANDLED_PROPS = new Set([
    'title', 'showHeader', 'refreshInterval', 'endpoint', 'server', 'path',
    'fontSize', 'fontColor', 'textAlign', 'fontWeight',
    'showBorder', 'lineColor', 'lineThickness', 'columns', 'feedUrl', 'layout',
    'location', 'locations', 'units', 'format24h',
    'targetDate', 'showHours', 'showMinutes',
    'workMinutes', 'breakMinutes',
    'imagePath', 'imageUrl', 'images', 'links',
    'embedUrl', 'repo', 'currentVersion', 'openclawUrl',
    'apiKey', 'apiKeyNote', 'username',
    'widgetFontScale', 'widgetFontAdjust', 'symbols',
    'directoryPath'
  ]);

  // Known select/dropdown options for specific properties
  var PROP_OPTIONS = {
    period: ['today', 'week', 'month', 'year'],
    units: ['F', 'C'],
    maxLength: ['0', '50', '100', '150', '200', '300'],
  };

  var PROP_LABELS = {
    maxLength: { '0': 'No limit', '50': '50 chars', '100': '100 chars', '150': '150 chars', '200': '200 chars', '300': '300 chars' },
  };

  window.initProperties = function initProperties() {
    ['prop-x', 'prop-y', 'prop-width', 'prop-height'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', onPropertyChange);
    });

    document.getElementById('prop-title').addEventListener('input', onPropertyChange);
    document.getElementById('prop-location').addEventListener('input', onPropertyChange);
    document.getElementById('prop-locations').addEventListener('input', onPropertyChange);
    document.getElementById('prop-units').addEventListener('change', onPropertyChange);
    document.getElementById('prop-api-key').addEventListener('input', onPropertyChange);
    document.getElementById('prop-api-key-value').addEventListener('input', onPropertyChange);
    document.getElementById('prop-endpoint').addEventListener('input', onPropertyChange);
    if (document.getElementById('prop-server')) {
      document.getElementById('prop-server').addEventListener('change', onPropertyChange);
    }
    if (document.getElementById('prop-directorypath')) {
      document.getElementById('prop-directorypath').addEventListener('input', onPropertyChange);
      document.getElementById('btn-browse-dir').addEventListener('click', function() { openDirBrowser(); });
    }
    document.getElementById('prop-refresh').addEventListener('change', onPropertyChange);
    document.getElementById('prop-widgetfontscale').addEventListener('change', onPropertyChange);
    document.getElementById('prop-timeformat').addEventListener('change', onPropertyChange);
    document.getElementById('prop-show-header').addEventListener('change', onPropertyChange);
    document.getElementById('prop-targetdate').addEventListener('change', onPropertyChange);
    document.getElementById('prop-show-hours').addEventListener('change', onPropertyChange);
    document.getElementById('prop-show-minutes').addEventListener('change', onPropertyChange);
    document.getElementById('prop-work-minutes').addEventListener('change', onPropertyChange);
    document.getElementById('prop-break-minutes').addEventListener('change', onPropertyChange);
    document.getElementById('prop-showborder').addEventListener('change', onPropertyChange);
    document.getElementById('prop-columns').addEventListener('change', onPropertyChange);
    document.getElementById('prop-feedurl').addEventListener('change', onPropertyChange);
    document.getElementById('prop-layout').addEventListener('change', onPropertyChange);
    document.getElementById('prop-fontsize').addEventListener('change', onPropertyChange);
    document.getElementById('prop-fontcolor').addEventListener('input', onPropertyChange);
    document.getElementById('prop-textalign').addEventListener('change', onPropertyChange);
    document.getElementById('prop-fontweight').addEventListener('change', onPropertyChange);
    document.getElementById('prop-linecolor').addEventListener('input', onPropertyChange);
    document.getElementById('prop-linethickness').addEventListener('change', onPropertyChange);
    document.getElementById('prop-imagepath').addEventListener('input', onPropertyChange);
    document.getElementById('prop-imagefile').addEventListener('change', onImageFileSelect);
    document.getElementById('prop-imageurl').addEventListener('input', onPropertyChange);
    document.getElementById('prop-imagelist-file').addEventListener('change', onRandomImageFilesSelect);
    document.getElementById('prop-link-add').addEventListener('click', onAddQuickLink);
    document.getElementById('prop-embedurl').addEventListener('input', onPropertyChange);
    document.getElementById('prop-repo').addEventListener('input', onPropertyChange);
    document.getElementById('prop-currentversion').addEventListener('input', onPropertyChange);
    if (document.getElementById('prop-gh-username')) document.getElementById('prop-gh-username').addEventListener('input', onPropertyChange);
    if (document.getElementById('prop-gh-repo')) document.getElementById('prop-gh-repo').addEventListener('input', onPropertyChange);
    if (document.getElementById('prop-gh-apikey')) document.getElementById('prop-gh-apikey').addEventListener('input', onPropertyChange);
    document.getElementById('prop-openclawurl').addEventListener('input', onPropertyChange);

    document.getElementById('btn-delete-widget').addEventListener('click', function() {
      if (state.selectedWidget) {
        deleteWidget(state.selectedWidget.id);
      }
    });
  };

  window.showProperties = function showProperties(widget) {
    var template = WIDGETS[widget.type];

    document.querySelector('.no-selection').style.display = 'none';
    document.getElementById('properties-form').style.display = 'block';

    document.getElementById('prop-type').value = template.name;
    document.getElementById('prop-title').value = widget.properties.title || '';
    document.getElementById('prop-show-header').checked = widget.properties.showHeader !== false;

    updatePropertyInputs();

    // Hide all optional groups first
    document.getElementById('prop-api-group').style.display = 'none';
    document.getElementById('prop-endpoint-group').style.display = 'none';
    if (document.getElementById('prop-server-group')) document.getElementById('prop-server-group').style.display = 'none';
    if (document.getElementById('prop-directorypath-group')) document.getElementById('prop-directorypath-group').style.display = 'none';
    document.getElementById('prop-location-group').style.display = 'none';
    document.getElementById('prop-locations-group').style.display = 'none';
    document.getElementById('prop-units-group').style.display = 'none';
    document.getElementById('prop-timeformat-group').style.display = 'none';
    document.getElementById('prop-targetdate-group').style.display = 'none';
    document.getElementById('prop-countdown-options-group').style.display = 'none';
    document.getElementById('prop-pomodoro-group').style.display = 'none';
    document.getElementById('prop-imagepath-group').style.display = 'none';
    document.getElementById('prop-imageurl-group').style.display = 'none';
    document.getElementById('prop-imagelist-group').style.display = 'none';
    document.getElementById('prop-quicklinks-group').style.display = 'none';
    document.getElementById('prop-embedurl-group').style.display = 'none';
    document.getElementById('prop-release-group').style.display = 'none';
    if (document.getElementById('prop-github-group')) document.getElementById('prop-github-group').style.display = 'none';
    document.getElementById('prop-openclawurl-group').style.display = 'none';
    document.getElementById('prop-title-hint').style.display = 'none';
    document.getElementById('prop-fontsize-group').style.display = 'none';
    document.getElementById('prop-fontcolor-group').style.display = 'none';
    document.getElementById('prop-textalign-group').style.display = 'none';
    document.getElementById('prop-fontweight-group').style.display = 'none';
    document.getElementById('prop-linecolor-group').style.display = 'none';
    document.getElementById('prop-linethickness-group').style.display = 'none';
    document.getElementById('prop-showborder-group').style.display = 'none';
    document.getElementById('prop-columns-group').style.display = 'none';
    document.getElementById('prop-feedurl-group').style.display = 'none';
    document.getElementById('prop-layout-group').style.display = 'none';

    // Show layout field (pages-menu)
    if (widget.properties.layout !== undefined) {
      document.getElementById('prop-layout-group').style.display = 'block';
      document.getElementById('prop-layout').value = widget.properties.layout || 'vertical';
    }

    // Show text header fields
    if (widget.properties.fontSize !== undefined) {
      document.getElementById('prop-fontsize-group').style.display = 'block';
      document.getElementById('prop-fontsize').value = widget.properties.fontSize || 24;
      document.getElementById('prop-fontcolor-group').style.display = 'block';
      document.getElementById('prop-fontcolor').value = widget.properties.fontColor || '#e6edf3';
      document.getElementById('prop-textalign-group').style.display = 'block';
      document.getElementById('prop-textalign').value = widget.properties.textAlign || 'left';
      document.getElementById('prop-fontweight-group').style.display = 'block';
      document.getElementById('prop-fontweight').value = widget.properties.fontWeight || 'bold';
    }

    // Show border toggle
    if (widget.properties.showBorder !== undefined) {
      document.getElementById('prop-showborder-group').style.display = 'block';
      document.getElementById('prop-showborder').checked = widget.properties.showBorder || false;
    }

    // Show line fields
    if (widget.properties.lineColor !== undefined) {
      document.getElementById('prop-linecolor-group').style.display = 'block';
      document.getElementById('prop-linecolor').value = widget.properties.lineColor || '#30363d';
      document.getElementById('prop-linethickness-group').style.display = 'block';
      document.getElementById('prop-linethickness').value = widget.properties.lineThickness || 2;
    }

    // Show columns field
    var tpl = WIDGETS[widget.type];
    if (widget.properties.columns !== undefined || (tpl && tpl.properties && tpl.properties.columns !== undefined)) {
      document.getElementById('prop-columns-group').style.display = 'block';
      document.getElementById('prop-columns').value = widget.properties.columns || (tpl && tpl.properties && tpl.properties.columns) || 1;
    }

    // Show feed URL field
    var tplFeed = WIDGETS[widget.type];
    if (widget.properties.feedUrl !== undefined || (tplFeed && tplFeed.properties && tplFeed.properties.feedUrl !== undefined)) {
      document.getElementById('prop-feedurl-group').style.display = 'block';
      document.getElementById('prop-feedurl').value = widget.properties.feedUrl || (tplFeed && tplFeed.properties && tplFeed.properties.feedUrl) || '';
    }

    // Show location field (single)
    if (widget.properties.location !== undefined) {
      document.getElementById('prop-location-group').style.display = 'block';
      document.getElementById('prop-location').value = widget.properties.location || '';
    }

    // Show locations field (multi)
    if (widget.properties.locations !== undefined) {
      document.getElementById('prop-locations-group').style.display = 'block';
      document.getElementById('prop-locations').value = widget.properties.locations || '';
    }

    // Show units field
    if (widget.properties.units !== undefined) {
      document.getElementById('prop-units-group').style.display = 'block';
      document.getElementById('prop-units').value = widget.properties.units || 'F';
    }

    // Show time format field
    if (widget.properties.format24h !== undefined) {
      document.getElementById('prop-timeformat-group').style.display = 'block';
      document.getElementById('prop-timeformat').value = widget.properties.format24h ? '24h' : '12h';
    }

    // Show countdown-specific fields
    if (widget.properties.targetDate !== undefined) {
      document.getElementById('prop-targetdate-group').style.display = 'block';
      document.getElementById('prop-targetdate').value = widget.properties.targetDate || '';
      document.getElementById('prop-countdown-options-group').style.display = 'block';
      document.getElementById('prop-show-hours').checked = widget.properties.showHours || false;
      document.getElementById('prop-show-minutes').checked = widget.properties.showMinutes || false;
      document.getElementById('prop-title-hint').textContent = 'Name what you\'re counting down to';
      document.getElementById('prop-title-hint').style.display = 'block';
    }

    // Show pomodoro-specific fields
    if (widget.properties.workMinutes !== undefined) {
      document.getElementById('prop-pomodoro-group').style.display = 'block';
      document.getElementById('prop-work-minutes').value = widget.properties.workMinutes || 25;
      document.getElementById('prop-break-minutes').value = widget.properties.breakMinutes || 5;
    }

    // Show local image fields
    if (widget.properties.imagePath !== undefined) {
      document.getElementById('prop-imagepath-group').style.display = 'block';
      var pathInput = document.getElementById('prop-imagepath');
      var pathHint = document.querySelector('#prop-imagepath-group small');
      if (widget.properties.imagePath && widget.properties.imagePath.startsWith('data:')) {
        pathInput.style.display = 'none';
        pathHint.style.display = 'none';
      } else {
        pathInput.style.display = 'block';
        pathInput.value = widget.properties.imagePath || '';
        pathHint.style.display = 'block';
      }
    }

    // Show web image fields
    if (widget.properties.imageUrl !== undefined) {
      document.getElementById('prop-imageurl-group').style.display = 'block';
      document.getElementById('prop-imageurl').value = widget.properties.imageUrl || '';
    }

    // Show random image fields
    if (widget.properties.images !== undefined || widget.type === 'image-random') {
      document.getElementById('prop-imagelist-group').style.display = 'block';
      if (!widget.properties.images) widget.properties.images = [];
      renderRandomImageList();
    }

    // Show directory path for latest image
    if (widget.type === 'image-latest' && document.getElementById('prop-directorypath-group')) {
      document.getElementById('prop-directorypath-group').style.display = 'block';
      document.getElementById('prop-directorypath').value = widget.properties.directoryPath || '';
    }

    if (widget.type === 'quick-links') {
      document.getElementById('prop-quicklinks-group').style.display = 'block';
      if (!widget.properties.links) widget.properties.links = [];
      renderQuickLinksList();
    }

    // Show iframe embed fields
    if (widget.properties.embedUrl !== undefined) {
      document.getElementById('prop-embedurl-group').style.display = 'block';
      document.getElementById('prop-embedurl').value = widget.properties.embedUrl || '';
    }

    // Show release widget fields
    if (widget.properties.repo !== undefined) {
      document.getElementById('prop-release-group').style.display = 'block';
      document.getElementById('prop-repo').value = widget.properties.repo || '';
      document.getElementById('prop-currentversion').value = widget.properties.currentVersion || '';
    }

    // Show GitHub stats fields
    if (widget.type === 'github-stats') {
      document.getElementById('prop-github-group').style.display = 'block';
      document.getElementById('prop-gh-username').value = widget.properties.username || '';
      document.getElementById('prop-gh-repo').value = widget.properties.repo || '';
      document.getElementById('prop-gh-apikey').value = widget.properties.apiKey || '';
    }

    // Show OpenClaw URL field
    if (widget.properties.openclawUrl !== undefined) {
      document.getElementById('prop-openclawurl-group').style.display = 'block';
      document.getElementById('prop-openclawurl').value = widget.properties.openclawUrl || '';
    }

    // Show API fields
    if (template.hasApiKey) {
      document.getElementById('prop-api-group').style.display = 'block';
      var apiKeyVarEl = document.getElementById('prop-api-key');
      var apiKeyVarLabel = apiKeyVarEl.previousElementSibling;
      if (template.hideApiKeyVar) {
        apiKeyVarEl.style.display = 'none';
        if (apiKeyVarLabel) apiKeyVarLabel.style.display = 'none';
      } else {
        apiKeyVarEl.style.display = '';
        if (apiKeyVarLabel) apiKeyVarLabel.style.display = '';
        apiKeyVarEl.value = template.apiKeyName || '';
      }
      document.getElementById('prop-api-key-value').value = widget.properties.apiKey || '';
      var noteEl = document.getElementById('prop-api-note');
      if (noteEl) {
        noteEl.textContent = template.properties?.apiKeyNote || '';
        noteEl.style.display = template.properties?.apiKeyNote ? 'block' : 'none';
      }
    }

    // Show endpoint field
    if (widget.properties.endpoint !== undefined) {
      document.getElementById('prop-endpoint-group').style.display = 'block';
      document.getElementById('prop-endpoint').value = widget.properties.endpoint || '';
    }

    // Show server dropdown for system/remote widgets
    var systemWidgets = ['uptime-monitor', 'docker-containers', 'disk-usage', 'network-speed', 'cpu-memory', 'ai-usage', 'openclaw-release', 'auth-status', 'cron-jobs', 'system-log', 'session-count', 'activity-list'];
    var serverGroup = document.getElementById('prop-server-group');
    if (serverGroup && systemWidgets.includes(widget.type)) {
      serverGroup.style.display = 'block';
      populateServerDropdown(widget.properties.server || 'local');
    } else if (serverGroup) {
      serverGroup.style.display = 'none';
    }

    document.getElementById('prop-refresh').value = widget.properties.refreshInterval || 60;

    // Widget font scale (per-widget override)
    document.getElementById('prop-widgetfontscale').value = widget.properties.widgetFontAdjust || '0';

    // Render dynamic extra properties
    renderExtraProperties(widget, template);

    // Show widget description
    var descEl = document.getElementById('prop-description');
    if (template.description) {
      descEl.textContent = template.description;
      document.getElementById('prop-description-group').style.display = 'block';
    } else {
      document.getElementById('prop-description-group').style.display = 'none';
    }

    // Show privacy warning for sensitive widgets
    var privWarn = document.getElementById('prop-privacy-warning');
    if (!privWarn) {
      privWarn = document.createElement('div');
      privWarn.id = 'prop-privacy-warning';
      privWarn.style.cssText = 'background:#2d1b00;border:1px solid #d29922;border-radius:6px;padding:8px 10px;margin:8px 0;font-size:11px;color:#d29922;display:none;line-height:1.4;';
      var descGroup = document.getElementById('prop-description-group');
      descGroup.parentNode.insertBefore(privWarn, descGroup.nextSibling);
    }
    if (template.privacyWarning) {
      privWarn.innerHTML = '\u26A0\uFE0F <strong>Privacy Warning:</strong> This widget may display sensitive data (API keys, credentials, personal info) to anyone viewing your dashboard. Public Mode and PIN protection only prevent editing \u2014 they do <strong>not</strong> hide widget content.';
      privWarn.style.display = 'block';
    } else {
      privWarn.style.display = 'none';
    }
  };

  window.renderExtraProperties = function renderExtraProperties(widget, template) {
    var container = document.getElementById('prop-extra-container');
    container.innerHTML = '';

    var templateProps = template.properties || {};
    var allKeys = new Set([].concat(Object.keys(templateProps), Object.keys(widget.properties)));

    for (var key of allKeys) {
      if (HANDLED_PROPS.has(key)) continue;

      var defaultVal = templateProps[key];
      var currentVal = widget.properties[key] !== undefined ? widget.properties[key] : defaultVal;
      if (currentVal === undefined) continue;

      var group = document.createElement('div');
      group.className = 'prop-group';

      var label = document.createElement('label');
      label.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, function(s) { return s.toUpperCase(); });

      var input;

      if (PROP_OPTIONS[key]) {
        input = document.createElement('select');
        PROP_OPTIONS[key].forEach(function(opt) {
          var option = document.createElement('option');
          option.value = opt;
          option.textContent = (PROP_LABELS[key] && PROP_LABELS[key][opt]) || opt.charAt(0).toUpperCase() + opt.slice(1);
          if (String(currentVal) === String(opt)) option.selected = true;
          input.appendChild(option);
        });
      } else if (typeof currentVal === 'boolean' || typeof defaultVal === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!currentVal;
        label.style.display = 'inline';
        label.style.marginLeft = '6px';
        group.appendChild(input);
        group.appendChild(label);
        input.dataset.extraProp = key;
        input.dataset.extraType = 'boolean';
        input.addEventListener('change', onExtraPropertyChange);
        container.appendChild(group);
        continue;
      } else if (typeof currentVal === 'number' || typeof defaultVal === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.value = currentVal;
      } else if (typeof currentVal === 'string') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal;
      } else {
        continue;
      }

      input.dataset.extraProp = key;
      input.dataset.extraType = typeof (defaultVal !== undefined ? defaultVal : currentVal);
      input.addEventListener('change', onExtraPropertyChange);
      input.addEventListener('input', onExtraPropertyChange);

      group.appendChild(label);
      group.appendChild(input);
      container.appendChild(group);
    }
  };

  function onExtraPropertyChange(e) {
    if (!state.selectedWidget) return;
    var key = e.target.dataset.extraProp;
    var type = e.target.dataset.extraType;

    if (type === 'boolean') {
      state.selectedWidget.properties[key] = e.target.checked;
    } else if (type === 'number') {
      state.selectedWidget.properties[key] = parseFloat(e.target.value) || 0;
    } else {
      state.selectedWidget.properties[key] = e.target.value;
    }
    renderWidgetPreview(state.selectedWidget);
  }

  window.hideProperties = function hideProperties() {
    document.querySelector('.no-selection').style.display = 'block';
    document.getElementById('properties-form').style.display = 'none';
  };

  window.updatePropertyInputs = function updatePropertyInputs() {
    if (!state.selectedWidget) return;

    document.getElementById('prop-x').value = state.selectedWidget.x;
    document.getElementById('prop-y').value = state.selectedWidget.y;
    document.getElementById('prop-width').value = state.selectedWidget.width;
    document.getElementById('prop-height').value = state.selectedWidget.height;
  };

  // ─────────────────────────────────────────────
  // IMAGE HANDLING
  // ─────────────────────────────────────────────

  function onImageFileSelect(e) {
    if (!state.selectedWidget) return;
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(event) {
      state.selectedWidget.properties.imagePath = event.target.result;
      document.getElementById('prop-imagepath').style.display = 'none';
      document.querySelector('#prop-imagepath-group small').style.display = 'none';
      renderWidgetPreview(state.selectedWidget);
    };
    reader.readAsDataURL(file);
  }

  function onRandomImageFilesSelect(e) {
    if (!state.selectedWidget) return;
    var files = Array.from(e.target.files);
    if (!files.length) return;

    if (!state.selectedWidget.properties.images) {
      state.selectedWidget.properties.images = [];
    }

    var loaded = 0;
    files.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(event) {
        state.selectedWidget.properties.images.push({
          name: file.name,
          data: event.target.result
        });
        loaded++;
        if (loaded === files.length) {
          renderRandomImageList();
          document.getElementById('prop-imagelist-file').value = '';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  window.renderRandomImageList = function renderRandomImageList() {
    if (!state.selectedWidget) return;
    var container = document.getElementById('prop-imagelist-items');
    var images = state.selectedWidget.properties.images || [];

    if (images.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px 0;">No images added yet</div>';
      return;
    }

    container.innerHTML = images.map(function(img, i) {
      return '\n    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);">\n      <img src="' + escapeHtml(img.data) + '" style="width:32px;height:32px;object-fit:cover;border-radius:4px;">\n      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(img.name) + '</span>\n      <button onclick="removeRandomImage(' + i + ')" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:14px;" title="Remove">\u00d7</button>\n    </div>';
    }).join('');
  };

  window.removeRandomImage = function(index) {
    if (!state.selectedWidget || !state.selectedWidget.properties.images) return;
    state.selectedWidget.properties.images.splice(index, 1);
    renderRandomImageList();
  };

  // ─────────────────────────────────────────────
  // QUICK LINKS
  // ─────────────────────────────────────────────

  function onAddQuickLink() {
    if (!state.selectedWidget) return;
    var nameInput = document.getElementById('prop-link-name');
    var urlInput = document.getElementById('prop-link-url');

    var name = nameInput.value.trim();
    var url = urlInput.value.trim();

    if (!name || !url) return;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (!state.selectedWidget.properties.links) {
      state.selectedWidget.properties.links = [];
    }

    state.selectedWidget.properties.links.push({ name: name, url: url });
    renderQuickLinksList();
    renderWidgetPreview(state.selectedWidget);

    nameInput.value = '';
    urlInput.value = '';
    nameInput.focus();
  }

  window.renderQuickLinksList = function renderQuickLinksList() {
    if (!state.selectedWidget) return;
    var container = document.getElementById('prop-quicklinks-items');
    var links = state.selectedWidget.properties.links || [];

    if (links.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px 0;">No links added yet</div>';
      return;
    }

    container.innerHTML = links.map(function(link, i) {
      var domain = '';
      try { domain = new URL(link.url).hostname; } catch(e) {}
      var favicon = domain ? 'https://www.google.com/s2/favicons?sz=16&domain=' + encodeURIComponent(domain) : '';
      return '\n    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);">\n      ' + (favicon ? '<img src="' + escapeHtml(favicon) + '" style="width:16px;height:16px;">' : '') + '\n      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(link.name) + '</span>\n      <button onclick="removeQuickLink(' + i + ')" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:14px;" title="Remove">\u00d7</button>\n    </div>';
    }).join('');
  };

  window.removeQuickLink = function(index) {
    if (!state.selectedWidget || !state.selectedWidget.properties.links) return;
    state.selectedWidget.properties.links.splice(index, 1);
    renderQuickLinksList();
    renderWidgetPreview(state.selectedWidget);
  };

  // ─────────────────────────────────────────────
  // PROPERTY CHANGE HANDLER
  // ─────────────────────────────────────────────

  function onPropertyChange(e) {
    if (!state.selectedWidget) return;

    var widget = state.selectedWidget;
    var el = document.getElementById(widget.id);

    switch (e.target.id) {
      case 'prop-x':
        widget.x = parseInt(e.target.value) || 0;
        el.style.left = widget.x + 'px';
        break;
      case 'prop-y':
        widget.y = parseInt(e.target.value) || 0;
        el.style.top = widget.y + 'px';
        break;
      case 'prop-width':
        widget.width = parseInt(e.target.value) || 100;
        el.style.width = widget.width + 'px';
        break;
      case 'prop-height':
        widget.height = parseInt(e.target.value) || 60;
        el.style.height = widget.height + 'px';
        break;
      case 'prop-title':
        widget.properties.title = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-show-header':
        widget.properties.showHeader = e.target.checked;
        renderWidgetPreview(widget);
        break;
      case 'prop-showborder':
        widget.properties.showBorder = e.target.checked;
        var widgetEl = document.getElementById(widget.id);
        if (widgetEl) widgetEl.dataset.showBorder = e.target.checked ? 'true' : 'false';
        renderWidgetPreview(widget);
        break;
      case 'prop-layout':
        widget.properties.layout = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-location':
        widget.properties.location = e.target.value;
        break;
      case 'prop-locations':
        widget.properties.locations = e.target.value;
        break;
      case 'prop-units':
        widget.properties.units = e.target.value;
        break;
      case 'prop-timeformat':
        widget.properties.format24h = e.target.value === '24h';
        break;
      case 'prop-targetdate':
        widget.properties.targetDate = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-show-hours':
        widget.properties.showHours = e.target.checked;
        break;
      case 'prop-show-minutes':
        widget.properties.showMinutes = e.target.checked;
        break;
      case 'prop-work-minutes':
        widget.properties.workMinutes = parseInt(e.target.value) || 25;
        renderWidgetPreview(widget);
        break;
      case 'prop-break-minutes':
        widget.properties.breakMinutes = parseInt(e.target.value) || 5;
        break;
      case 'prop-imagepath':
        widget.properties.imagePath = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-imageurl':
        widget.properties.imageUrl = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-embedurl':
        widget.properties.embedUrl = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-repo':
        widget.properties.repo = e.target.value;
        break;
      case 'prop-currentversion':
        widget.properties.currentVersion = e.target.value;
        break;
      case 'prop-gh-username':
        widget.properties.username = e.target.value;
        break;
      case 'prop-gh-repo':
        widget.properties.repo = e.target.value;
        break;
      case 'prop-gh-apikey':
        widget.properties.apiKey = e.target.value;
        break;
      case 'prop-openclawurl':
        widget.properties.openclawUrl = e.target.value;
        break;
      case 'prop-api-key-value':
        widget.properties.apiKey = e.target.value;
        break;
      case 'prop-endpoint':
        widget.properties.endpoint = e.target.value;
        break;
      case 'prop-server':
        widget.properties.server = e.target.value;
        break;
      case 'prop-directorypath':
        widget.properties.directoryPath = e.target.value;
        break;
      case 'prop-refresh':
        widget.properties.refreshInterval = parseInt(e.target.value) || 60;
        break;
      case 'prop-widgetfontscale':
        var adj = parseInt(e.target.value) || 0;
        if (adj !== 0) {
          widget.properties.widgetFontAdjust = adj;
        } else {
          delete widget.properties.widgetFontAdjust;
        }
        delete widget.properties.widgetFontScale;
        applyWidgetFontScale(widget);
        break;
      case 'prop-fontsize':
        widget.properties.fontSize = parseInt(e.target.value) || 24;
        renderWidgetPreview(widget);
        break;
      case 'prop-fontcolor':
        widget.properties.fontColor = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-textalign':
        widget.properties.textAlign = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-fontweight':
        widget.properties.fontWeight = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-linecolor':
        widget.properties.lineColor = e.target.value;
        renderWidgetPreview(widget);
        break;
      case 'prop-linethickness':
        widget.properties.lineThickness = parseInt(e.target.value) || 2;
        renderWidgetPreview(widget);
        break;
      case 'prop-columns':
        widget.properties.columns = parseInt(e.target.value) || 1;
        renderWidgetPreview(widget);
        break;
      case 'prop-feedurl':
        widget.properties.feedUrl = e.target.value;
        break;
    }
  }

  window.onPropertyChange = onPropertyChange;
})();

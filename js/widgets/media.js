/**
 * OpenClaw Dashboard Builder - Media Widgets
 */
(function(WIDGETS) {

  WIDGETS['now-playing'] = {
    name: 'Now Playing',
    icon: '🎵',
    category: 'large',
    description: 'Shows currently playing music from Spotify/music service API.',
    defaultWidth: 350,
    defaultHeight: 120,
    hasApiKey: true,
    apiKeyName: 'SPOTIFY_TOKEN',
    properties: {
      title: 'Now Playing',
      endpoint: '/api/spotify/now-playing',
      refreshInterval: 10
    },
    preview: `<div style="display:flex;gap:12px;padding:8px;align-items:center;">
      <div style="width:50px;height:50px;background:#282828;border-radius:4px;"></div>
      <div style="font-size:11px;">
        <div style="color:#fff;">Song Title</div>
        <div style="color:#8b949e;">Artist Name</div>
      </div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('music')} ${props.title || 'Now Playing'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;gap:12px;">
          <div class="np-art" id="${props.id}-art"></div>
          <div class="np-info">
            <div class="np-title" id="${props.id}-title">Not Playing</div>
            <div class="np-artist" id="${props.id}-artist">—</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Now Playing Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('${props.endpoint || '/api/spotify/now-playing'}');
          const data = await res.json();
          if (data.is_playing) {
            document.getElementById('${props.id}-title').textContent = data.item?.name || 'Unknown';
            document.getElementById('${props.id}-artist').textContent = data.item?.artists?.map(a => a.name).join(', ') || '';
            if (data.item?.album?.images?.[0]?.url) {
              document.getElementById('${props.id}-art').style.backgroundImage = 'url(' + data.item.album.images[0].url + ')';
            }
          }
        } catch (e) {
          console.error('Spotify error:', e);
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 10) * 1000});
    `
  };

  WIDGETS['quote-of-day'] = {
    name: 'Quote of Day',
    icon: '💭',
    category: 'large',
    description: 'Displays daily inspirational quote from public API.',
    defaultWidth: 400,
    defaultHeight: 150,
    hasApiKey: false,
    properties: {
      title: 'Quote',
      maxLength: 0,
      refreshInterval: 3600
    },
    preview: `<div style="padding:8px;font-size:12px;font-style:italic;">
      "The only way to do great work is to love what you do."
      <div style="font-size:11px;color:#8b949e;margin-top:4px;">— Steve Jobs</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('quote')} ${props.title || 'Quote'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;flex-direction:column;justify-content:center;">
          <div class="quote-text" id="${props.id}-text" style="font-style:italic;">Loading quote...</div>
          <div class="quote-author" id="${props.id}-author" style="margin-top:8px;color:var(--text-muted);font-size:calc(11px * var(--font-scale, 1));">—</div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Quote of Day Widget: ${props.id}
      async function update_${props.id.replace(/-/g, '_')}() {
        const maxLen = ${props.maxLength || 0};
        const maxRetries = maxLen > 0 ? 5 : 1;
        try {
          for (let i = 0; i < maxRetries; i++) {
            const res = await fetch('/api/quote');
            const data = await res.json();
            const quote = data[0];
            if (!maxLen || quote.q.length <= maxLen) {
              document.getElementById('${props.id}-text').textContent = '\\u201c' + quote.q + '\\u201d';
              document.getElementById('${props.id}-author').textContent = '— ' + quote.a;
              return;
            }
          }
          // All retries exceeded maxLength, use last one anyway
          const res = await fetch('/api/quote');
          const data = await res.json();
          document.getElementById('${props.id}-text').textContent = '\\u201c' + data[0].q + '\\u201d';
          document.getElementById('${props.id}-author').textContent = '— ' + data[0].a;
        } catch (e) {
          document.getElementById('${props.id}-text').textContent = '\\u201cStay hungry, stay foolish.\\u201d';
          document.getElementById('${props.id}-author').textContent = '— Steve Jobs';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 3600) * 1000});
    `
  };

  WIDGETS['image-local'] = {
    name: 'Image',
    icon: '🖼️',
    category: 'large',
    description: 'Displays a local image file. Embedded as base64 for portable exports.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Image',
      imagePath: ''
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🖼️ Local Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image')} ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imagePath 
            ? `<img src="${props.imagePath}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('image')} No image path</span>`
          }
        </div>
      </div>`,
    generateJs: (props) => `
      // Local Image Widget: ${props.id}
      // Static image - no JS needed
    `
  };

  WIDGETS['image-random'] = {
    name: 'Random Image',
    icon: '🎲',
    category: 'large',
    description: 'Rotates through multiple images. Pick files to add to rotation.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Random Image',
      images: [],
      refreshInterval: 30
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🎲 Random Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image-random')} ${props.title || 'Random Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          <img id="${props.id}-img" src="" style="width:100%;height:100%;object-fit:contain;display:none;">
          <span id="${props.id}-placeholder" style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('image-random')} No images added</span>
        </div>
      </div>`,
    generateJs: (props) => {
      const images = (props.images || []).map(img => img.data);
      return `
      // Random Image Widget: ${props.id}
      (function() {
        const images = ${JSON.stringify(images)};
        
        const imgEl = document.getElementById('${props.id}-img');
        const placeholder = document.getElementById('${props.id}-placeholder');
        
        function showRandomImage() {
          if (images.length === 0) return;
          const randomIndex = Math.floor(Math.random() * images.length);
          imgEl.src = images[randomIndex];
          imgEl.style.display = 'block';
          placeholder.style.display = 'none';
        }
        
        if (images.length > 0) {
          showRandomImage();
          setInterval(showRandomImage, ${(props.refreshInterval || 30) * 1000});
        }
      })();
    `;
    }
  };

  WIDGETS['image-latest'] = {
    name: 'Latest Image',
    icon: '🆕',
    category: 'large',
    description: 'Shows the newest image from a directory. Auto-refreshes.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Latest Image',
      directoryPath: '',
      refreshInterval: 60
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🆕 Latest Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('image-new')} ${props.title || 'Latest Image'}</span>
          <span id="${props.id}-filename" style="font-size:11px;color:var(--text-muted);margin-left:auto;"></span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          <img id="${props.id}-img" src="" style="width:100%;height:100%;object-fit:contain;display:none;">
          <span id="${props.id}-placeholder" style="color:var(--text-muted);font-size:12px;">${renderIcon('image-new')} ${props.directoryPath ? 'Loading...' : 'No directory set'}</span>
        </div>
      </div>`,
    generateJs: (props) => `
      // Latest Image Widget: ${props.id}
      (function() {
        const dir = ${JSON.stringify(props.directoryPath || '')};
        const imgEl = document.getElementById('${props.id}-img');
        const placeholder = document.getElementById('${props.id}-placeholder');
        const filenameEl = document.getElementById('${props.id}-filename');
        
        async function loadLatest() {
          if (!dir) return;
          try {
            const res = await fetch('/api/latest-image?dir=' + encodeURIComponent(dir));
            const data = await res.json();
            if (data.status === 'ok' && data.image) {
              imgEl.src = data.image.dataUrl;
              imgEl.style.display = 'block';
              placeholder.style.display = 'none';
              if (filenameEl) filenameEl.textContent = data.image.name;
            } else {
              placeholder.textContent = data.message || 'No images found';
            }
          } catch (e) {
            placeholder.textContent = 'Error loading image';
          }
        }
        
        loadLatest();
        setInterval(loadLatest, ${(props.refreshInterval || 60) * 1000});
      })();
    `
  };

  WIDGETS['image-embed'] = {
    name: 'Web Image',
    icon: '🌐',
    category: 'large',
    description: 'Displays an image from a web URL.',
    defaultWidth: 300,
    defaultHeight: 220,
    hasApiKey: false,
    properties: {
      title: 'Image',
      imageUrl: ''
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🌐 Web Image
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('embed')} ${props.title || 'Image'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);">
          ${props.imageUrl 
            ? `<img src="${props.imageUrl}" style="width:100%;height:100%;object-fit:contain;">`
            : `<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">${renderIcon('embed')} No image URL</span>`
          }
        </div>
      </div>`,
    generateJs: (props) => `
      // Web Image Widget: ${props.id}
      // Static image - no JS needed
    `
  };

  WIDGETS['quick-links'] = {
    name: 'Quick Links',
    icon: '🔗',
    category: 'large',
    description: 'Grid of clickable links with auto-fetched favicons.',
    defaultWidth: 300,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Quick Links',
      columns: 1,
      links: []
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div style="padding:4px 0;">🔗 Google</div>
      <div style="padding:4px 0;">🔗 GitHub</div>
      <div style="padding:4px 0;">🔗 Reddit</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('links')} ${props.title || 'Quick Links'}</span>
        </div>
        <div class="dash-card-body links-list" id="${props.id}-links">
          ${(props.links || []).length === 0 ? '<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">No links added</span>' : ''}
        </div>
      </div>`,
    generateJs: (props) => {
      const links = props.links || [];
      return `
      // Quick Links Widget: ${props.id}
      (function() {
        const links = ${JSON.stringify(links)};
        const container = document.getElementById('${props.id}-links');
        
        if (links.length === 0) {
          container.innerHTML = '<span style="color:var(--text-muted);font-size:calc(12px * var(--font-scale, 1));">No links added</span>';
          return;
        }
        
        const cols = ${props.columns || 1};
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        container.style.gap = '4px';
        container.innerHTML = links.filter(link => _isSafeUrl(link.url)).map(link => {
          const domain = new URL(link.url).hostname;
          const favicon = 'https://www.google.com/s2/favicons?sz=32&domain=' + _esc(domain);
          return '<a href="' + _esc(link.url) + '" class="quick-link" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;padding:6px 4px;text-decoration:none;color:var(--text-primary);border-bottom:1px solid var(--border);overflow:hidden;">' +
            '<img src="' + favicon + '" style="width:16px;height:16px;flex-shrink:0;" onerror="this.style.display=\\'none\\'">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(link.name) + '</span>' +
          '</a>';
        }).join('');
      })();
    `;
    }
  };

  WIDGETS['iframe-embed'] = {
    name: 'Iframe Embed',
    icon: '🌐',
    category: 'large',
    description: 'Embeds any webpage in an iframe. Some sites may block embedding.',
    defaultWidth: 500,
    defaultHeight: 350,
    hasApiKey: false,
    properties: {
      title: 'Embed',
      embedUrl: 'https://example.com',
      allowFullscreen: true
    },
    preview: `<div style="background:#21262d;height:100%;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:11px;">
      🌐 Embedded Content
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('embed')} ${props.title || 'Embed'}</span>
        </div>
        <div class="dash-card-body" style="padding:0;overflow:hidden;">
          <iframe src="${_isSafeUrl(props.embedUrl) ? props.embedUrl : 'about:blank'}" style="width:100%;height:100%;border:none;" ${props.allowFullscreen ? 'allowfullscreen' : ''}></iframe>
        </div>
      </div>`,
    generateJs: (props) => `
      // Iframe Embed Widget: ${props.id}
      // Configure the embed URL in widget properties
    `
  };

  WIDGETS['rss-ticker'] = {
    name: 'RSS Ticker',
    icon: '📡',
    category: 'bar',
    description: 'Scrolling RSS feed headlines. Add any RSS feed URL.',
    defaultWidth: 1920,
    defaultHeight: 40,
    hasApiKey: false,
    properties: {
      title: 'RSS',
      feedUrl: 'https://example.com/feed.xml',
      maxItems: 10,
      refreshInterval: 600
    },
    preview: `<div style="background:#161b22;padding:8px;font-size:11px;overflow:hidden;">
      📡 Latest headlines scrolling by...
    </div>`,
    generateHtml: (props) => `
      <section class="news-ticker-wrap" id="widget-${props.id}">
        <span class="ticker-label lb-icon" data-icon="rss">📡</span>
        <div class="ticker-track">
          <div class="ticker-content" id="${props.id}-ticker">Loading feed...</div>
        </div>
      </section>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        var el = document.getElementById('${props.id}-ticker');
        if (!el) el = document.querySelector('.ticker-content');
        if (!el) return;
        try {
          var feedUrl = '${props.feedUrl || ''}';
          if (!feedUrl || feedUrl === 'https://example.com/feed.xml') {
            el.textContent = 'Set a Feed URL in Edit Mode (Ctrl+E)';
            return;
          }
          var res = await fetch('/api/rss?url=' + encodeURIComponent(feedUrl));
          if (!res.ok) { el.textContent = 'Feed error: ' + res.status; return; }
          var xml = await res.text();
          var parser = new DOMParser();
          var doc = parser.parseFromString(xml, 'text/xml');
          var items = Array.from(doc.querySelectorAll('item')).slice(0, ${props.maxItems || 10});
          if (!items.length) { el.textContent = 'No items found in feed'; return; }
          el.innerHTML = items.map(function(item) {
            var title = (item.querySelector('title') ? item.querySelector('title').textContent : '').replace(/</g,'&lt;');
            var link = item.querySelector('link') ? item.querySelector('link').textContent : '#';
            return '<a href="' + link + '" target="_blank" class="ticker-link">' + title + '</a>';
          }).join('<span class="ticker-sep"> \\u2022\\u2022\\u2022 </span>');
        } catch (e) {
          if (el) el.textContent = 'Failed to load feed';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  };

  WIDGETS['pages-menu'] = {
    name: 'Pages Menu',
    icon: '📑',
    category: 'small',
    description: 'Navigation links to all discovered LobsterBoard pages. Supports vertical or horizontal layout.',
    defaultWidth: 220,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'Pages',
      layout: 'vertical',
      showBorder: true,
      refreshInterval: 60
    },
    preview: `<div style="padding:6px;font-size:11px;color:#8b949e;">
      <div>📝 Notes</div>
      <div>📋 Board</div>
      <div>📅 Calendar</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('pages')} ${props.title || 'Pages'}</span>
        </div>
        <div class="dash-card-body pages-menu ${props.layout === 'horizontal' ? 'pages-menu-horizontal' : 'pages-menu-vertical'}" id="${props.id}-list">
          <span class="pages-menu-item">Loading…</span>
        </div>
      </div>
      <style>
        .pages-menu-vertical { display:flex; flex-direction:column; gap:4px; overflow-y:auto; }
        .pages-menu-horizontal { display:flex; flex-direction:row; flex-wrap:wrap; gap:6px; align-items:center; }
        .pages-menu-item {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border-radius:6px;
          background:#21262d; color:#c9d1d9;
          text-decoration:none; font-size:calc(13px * var(--font-scale, 1));
          transition: background .15s, color .15s;
        }
        .pages-menu-item:hover { background:#30363d; color:#58a6ff; }
        .pages-menu-item .pages-menu-icon { font-size:calc(15px * var(--font-scale, 1)); }
      </style>`,
    generateJs: (props) => `
      async function update_${props.id.replace(/-/g, '_')}() {
        try {
          const res = await fetch('/api/pages');
          const pages = await res.json();
          const list = document.getElementById('${props.id}-list');
          if (!pages.length) { list.innerHTML = '<span class="pages-menu-item">No pages found</span>'; return; }
          list.innerHTML = pages.map(p =>
            '<a class="pages-menu-item" href="/pages/' + p.id + '" title="' + (p.description || p.title || p.name || '') + '">' +
            '<span class="pages-menu-icon">' + (p.icon || '📄') + '</span>' +
            '<span>' + (p.title || p.name || p.id) + '</span></a>'
          ).join('');
        } catch (e) {
          console.error('Pages menu widget error:', e);
          document.getElementById('${props.id}-list').innerHTML = '<span class="pages-menu-item">Error loading pages</span>';
        }
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
    `
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});

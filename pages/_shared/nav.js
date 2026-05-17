// Shared navigation for LobsterBoard pages
// Include via <script src="/pages/_shared/nav.js"></script>
// Requires <nav id="page-nav"></nav> in the page HTML

(function() {
  const navEl = document.getElementById('page-nav');
  if (!navEl) return;

  const currentPath = window.location.pathname;

  function buildNav(links) {
    const nav = document.createElement('div');
    nav.className = 'lb-nav';

    const left = document.createElement('div');
    left.className = 'lb-nav-left';

    links.forEach(link => {
      const anchor = document.createElement('a');
      const href = String(link.href || '/');
      anchor.href = href;
      anchor.className = 'lb-nav-link';
      if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
        anchor.classList.add('active');
      }
      anchor.textContent = `${link.icon || ''} ${link.title || 'Untitled'}`.trim();
      left.appendChild(anchor);
    });

    nav.appendChild(left);
    navEl.replaceChildren(nav);
  }

  fetch('/api/pages')
    .then(r => r.json())
    .then(pages => {
      const links = [
        { href: '/', icon: '🦞', title: 'Dashboard' }
      ].concat(pages.map(p => ({
        href: '/pages/' + encodeURIComponent(p.id),
        icon: p.icon,
        title: p.title
      })));

      buildNav(links);
    })
    .catch(() => {
      buildNav([{ href: '/', icon: '🦞', title: 'Dashboard' }]);
    });

  // Inject nav styles if not already present
  if (!document.getElementById('lb-nav-styles')) {
    const style = document.createElement('style');
    style.id = 'lb-nav-styles';
    style.textContent = `
      .lb-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #161b22;
        border-bottom: 1px solid #30363d;
        padding: 0 1rem;
        height: 42px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .lb-nav-left {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }
      .lb-nav-link {
        color: #8b949e;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 10px;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
      }
      .lb-nav-link:hover {
        color: #e6edf3;
        background: #21262d;
      }
      .lb-nav-link.active {
        color: #e6edf3;
        background: #30363d;
      }
    `;
    document.head.appendChild(style);
  }
})();

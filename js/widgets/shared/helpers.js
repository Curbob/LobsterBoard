/**
 * OpenClaw Dashboard Builder - Security Helpers
 * Shared utilities for HTML escaping and URL validation
 */

// ─────────────────────────────────────────────
// Security helpers (available to generated widget scripts via window)
// ─────────────────────────────────────────────

function _escHtmlGlobal(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
if (typeof window !== 'undefined') window._esc = _escHtmlGlobal;

function _isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (e) {
    return false;
  }
}
if (typeof window !== 'undefined') window._isSafeUrl = _isSafeUrl;

// CommonJS export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _escHtmlGlobal, _isSafeUrl };
}

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

/**
 * Compact weekly pace line for usage widgets (Claude Code, Codex CLI).
 * Compares how far through the 7-day window we are with how much of the weekly
 * limit is used. Week-progress idea from James Tsetsekas's fork.
 * Returns '' when there is no usable reset time.
 */
function _weekPaceLine(resetsAt, used) {
  if (!resetsAt) return '';
  const resetMs = new Date(resetsAt).getTime();
  if (isNaN(resetMs)) return '';
  const weekMs = 7 * 24 * 3600000;
  const wp = Math.min(100, Math.max(0, (Date.now() - (resetMs - weekMs)) / weekMs * 100));
  const u = Math.min(100, Math.max(0, used || 0));
  const diff = wp - u;
  const status = diff > 15 ? '⚡ Ahead of pace' : diff >= 0 ? '✅ On track' : diff > -10 ? '⚠️ Slightly behind' : '🔴 Behind pace';
  const color = diff >= 0 ? '#3fb950' : diff > -10 ? '#d29922' : '#f85149';
  const rd = new Date(resetMs);
  const when = rd.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + rd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return '<div class="lb-week-pace-line" style="display:flex;justify-content:space-between;gap:6px;font-size:10px;margin:-1px 0 4px;white-space:nowrap;overflow:hidden;">' +
    '<span style="color:' + color + ';overflow:hidden;text-overflow:ellipsis;">' + status + ' · ' + wp.toFixed(0) + '% of week</span>' +
    '<span style="color:var(--text-muted,#8b949e);">resets ' + when + '</span></div>';
}
if (typeof window !== 'undefined') window._weekPaceLine = _weekPaceLine;

// CommonJS export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { _escHtmlGlobal, _isSafeUrl, _weekPaceLine };
}

/**
 * OpenClaw Dashboard Builder - Icon System
 * Themeable widget icons with emoji and Phosphor icon support
 */

// ─────────────────────────────────────────────
// Icon System - Themeable widget icons
// ─────────────────────────────────────────────
const WIDGET_ICONS = {
  // Weather
  'weather': { emoji: '🌡️', phosphor: 'thermometer' },
  'weather-sunny': { emoji: '☀️', phosphor: 'sun' },
  'weather-cloudy': { emoji: '⛅', phosphor: 'cloud-sun' },
  'weather-rainy': { emoji: '🌧️', phosphor: 'cloud-rain' },
  'weather-snowy': { emoji: '❄️', phosphor: 'snowflake' },
  'world-weather': { emoji: '🌍', phosphor: 'globe' },

  // Time
  'clock': { emoji: '🕐', phosphor: 'clock' },
  'countdown': { emoji: '⏳', phosphor: 'hourglass' },
  'cron': { emoji: '⏰', phosphor: 'timer' },
  'pomodoro': { emoji: '🎯', phosphor: 'crosshair' },
  'world-clock': { emoji: '🌍', phosphor: 'globe' },

  // System
  'cpu': { emoji: '💻', phosphor: 'cpu' },
  'memory': { emoji: '🧠', phosphor: 'brain' },
  'disk': { emoji: '💾', phosphor: 'hard-drive' },
  'network': { emoji: '🌐', phosphor: 'wifi-high' },
  'docker': { emoji: '🐳', phosphor: 'cube' },
  'uptime': { emoji: '📡', phosphor: 'broadcast' },
  'system-log': { emoji: '🔧', phosphor: 'wrench' },

  // Auth / Security
  'auth': { emoji: '🔐', phosphor: 'lock-key' },
  'sleep': { emoji: '😴', phosphor: 'moon' },

  // Releases
  'lobster': { emoji: '🦞', phosphor: 'package' },
  'release': { emoji: '📦', phosphor: 'package' },

  // Lists / Activity
  'activity': { emoji: '📋', phosphor: 'list' },
  'calendar': { emoji: '📅', phosphor: 'calendar' },
  'notes': { emoji: '📝', phosphor: 'note' },
  'todo': { emoji: '✅', phosphor: 'check-square' },
  'pages': { emoji: '📑', phosphor: 'files' },

  // AI / Monitoring
  'ai-usage': { emoji: '🤖', phosphor: 'robot' },
  'claude-code': { emoji: '🟣', phosphor: 'circle' },
  'codex-cli': { emoji: '🟢', phosphor: 'circle' },
  'github-copilot': { emoji: '⚫', phosphor: 'circle' },
  'cursor': { emoji: '🔵', phosphor: 'circle' },
  'gemini-cli': { emoji: '🔷', phosphor: 'diamond' },
  'amp-code': { emoji: '⚡', phosphor: 'lightning' },
  'factory': { emoji: '🏭', phosphor: 'factory' },
  'kimi-code': { emoji: '🌙', phosphor: 'moon' },
  'jetbrains-ai': { emoji: '🧠', phosphor: 'brain' },
  'minimax': { emoji: '🔶', phosphor: 'diamond' },
  'zai': { emoji: '🇿', phosphor: 'sparkle' },
  'antigravity': { emoji: '🪐', phosphor: 'planet' },
  'ai-claude': { emoji: '🟣', phosphor: 'circle' },
  'ai-cost': { emoji: '💰', phosphor: 'currency-dollar' },
  'api-status': { emoji: '🔄', phosphor: 'arrows-clockwise' },
  'sessions': { emoji: '💬', phosphor: 'chat-dots' },
  'tokens': { emoji: '📊', phosphor: 'chart-bar' },
  'claude-usage': { emoji: '🤖', phosphor: 'robot' },

  // Finance
  'stock': { emoji: '📈', phosphor: 'chart-line-up' },
  'crypto': { emoji: '₿', phosphor: 'currency-btc' },

  // Productivity
  'email': { emoji: '📧', phosphor: 'envelope' },
  'github': { emoji: '🐙', phosphor: 'git-branch' },

  // Smart Home
  'home': { emoji: '🏠', phosphor: 'house' },
  'camera': { emoji: '📷', phosphor: 'camera' },
  'power': { emoji: '🔌', phosphor: 'plug' },

  // Media
  'music': { emoji: '🎵', phosphor: 'music-notes' },
  'quote': { emoji: '💭', phosphor: 'quotes' },

  // Images
  'image': { emoji: '🖼️', phosphor: 'image' },
  'image-random': { emoji: '🎲', phosphor: 'shuffle' },
  'image-new': { emoji: '🆕', phosphor: 'sparkle' },

  // Links / Embeds
  'links': { emoji: '🔗', phosphor: 'link' },
  'embed': { emoji: '🌐', phosphor: 'browser' },
  'rss': { emoji: '📡', phosphor: 'rss' },

  // Layout
  'header': { emoji: '🔤', phosphor: 'text-aa' },
  'line-h': { emoji: '➖', phosphor: 'minus' },
  'line-v': { emoji: '│', phosphor: 'line-vertical' },
};

/**
 * Renders a themeable icon span
 * @param {string} iconId - Key from WIDGET_ICONS
 * @returns {string} HTML span element with data-icon attribute
 */
function renderIcon(iconId) {
  const icon = WIDGET_ICONS[iconId];
  const emoji = icon ? icon.emoji : '●';
  return `<span class="lb-icon" data-icon="${iconId}">${emoji}</span> `;
}

// Expose for external use
if (typeof window !== 'undefined') {
  window.renderIcon = renderIcon;
  window.WIDGET_ICONS = WIDGET_ICONS;
}

// CommonJS export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WIDGET_ICONS, renderIcon };
}

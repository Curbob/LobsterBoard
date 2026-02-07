# LobsterBoard Widget Status

## ✅ Works Out of Box (no API needed)
- [x] weather - wttr.in (free, no key) - **VERIFIED**
- [x] weather-multi - wttr.in (free, no key) - **VERIFIED**
- [x] clock - pure JS - **VERIFIED**
- [ ] world-clock - pure JS
- [ ] countdown - pure JS
- [ ] pomodoro - pure JS
- [ ] image-embed - static display
- [ ] quick-links - static links
- [ ] iframe-embed - embeds URL
- [ ] battery-status - browser Battery API
- [ ] release - GitHub public API

## 🔑 User Provides API Key
- [ ] news-ticker - NewsAPI
- [ ] stock-ticker - Finnhub
- [ ] crypto-price - various free APIs
- [ ] github-stats - optional token for rate limits

## 🦞 Needs OpenClaw Running
- [ ] auth-status - /api/status
- [ ] activity-list - /api/activity
- [ ] cron-jobs - /api/cron
- [ ] system-log - /api/logs
- [ ] session-count - /api/sessions
- [ ] token-gauge - /api/usage/tokens
- [ ] api-status - checks OpenClaw + external

## ⚠️ Needs Backend (Custom Setup Required)
- [ ] ai-usage-claude - proxy to Anthropic usage API
- [ ] ai-usage-openai - proxy to OpenAI usage API
- [ ] ai-usage-gemini - proxy to Google usage API
- [ ] ai-usage-multi - combines above
- [ ] ai-cost-tracker - aggregate costs endpoint
- [ ] cpu-memory - /api/system (system stats)
- [ ] disk-usage - /api/system (system stats)
- [ ] network-speed - system stats
- [ ] uptime-monitor - needs monitoring backend
- [ ] docker-containers - Docker API proxy
- [ ] todo-list - needs storage backend
- [ ] notes - needs storage backend
- [ ] email-count - email API proxy
- [ ] calendar - calendar API
- [ ] indoor-climate - smart home API
- [ ] power-usage - smart home API
- [ ] camera-feed - camera stream URL
- [ ] now-playing - music service API
- [ ] rss-ticker - may need CORS proxy
- [ ] rss-feed - may need CORS proxy
- [ ] sleep-ring - health data API
- [ ] stat-card - generic, depends on endpoint
- [ ] topbar - depends on configuration

---

## Notes
- Checkmarks in widget library indicate **VERIFIED** (tested and working)
- "Works Out of Box" = no backend needed, runs entirely in browser
- "User Provides API Key" = works if user adds their own API key
- "Needs OpenClaw" = requires OpenClaw gateway running locally
- "Needs Backend" = requires custom API endpoints to be built/configured

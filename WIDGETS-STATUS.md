# LobsterBoard Widget Status

## ✅ Works Out of Box (no API needed)
- [x] weather - wttr.in (free, no key) - **VERIFIED**
- [x] weather-multi - wttr.in (free, no key) - **VERIFIED**
- [x] clock - pure JS - **VERIFIED**
- [x] world-clock - uses wttr.in for timezone - **VERIFIED**
- [x] countdown - date picker, hours/minutes options - **VERIFIED**
- [x] pomodoro - work/break times, sound notification - **VERIFIED**
- [x] image-local - file picker, embedded base64 - **VERIFIED**
- [x] image-embed - web URL input - **VERIFIED** (renamed to "Web Image")
- [x] image-random - multi-file picker, visual list, delete - **VERIFIED**
- [x] quick-links - add/delete interface, auto-favicons - **VERIFIED**
- [x] iframe-embed - URL field in properties - **VERIFIED**
- [x] release - GitHub public API, repo + version fields - **VERIFIED**

## ❤️ Health
- [ ] sleep-ring (Sleep Score) - health data API (Garmin, etc.)

## 🔑 User Provides API Key
- [ ] news-ticker - NewsAPI
- [ ] stock-ticker - Finnhub
- [ ] crypto-price - various free APIs
- [ ] github-stats - optional token for rate limits

## 🦞 OpenClaw Widgets (⚠️ Needs Custom API Backend)
- [ ] openclaw-release - fetches running version from /api/status + GitHub
- [ ] auth-status - /api/status
- [ ] activity-list - /api/activity
- [ ] cron-jobs - /api/cron
- [ ] system-log - /api/logs
- [ ] session-count - /api/sessions
- [ ] token-gauge - /api/usage/tokens
- [ ] api-status - checks OpenClaw + external

**⚠️ Note:** OpenClaw doesn't expose REST API endpoints. These widgets require a custom backend bridge that translates OpenClaw's WebSocket/CLI data to REST JSON. The `server.js` proxy alone is not enough.

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
- [x] stat-card - REMOVED (static only, not useful)
- [ ] topbar - depends on configuration

---

## Notes
- Checkmarks in widget library indicate **VERIFIED** (tested and working)
- "Works Out of Box" = no backend needed, runs entirely in browser
- "User Provides API Key" = works if user adds their own API key
- "Needs OpenClaw" = requires OpenClaw gateway running locally
- "Needs Backend" = requires custom API endpoints to be built/configured

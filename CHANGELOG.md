# Changelog

## [0.9.4] - 2026-11-28

### Added
- **Docker install (optional).** A `Dockerfile`, `docker-compose.yml` and a published image (`ghcr.io/curbob/lobsterboard`, amd64 + arm64). App code lives in the image and everything you create lives in a `/data` volume, so updates are `docker compose pull && docker compose up -d`. Runs as a non-root user (`PUID`/`PGID`), has a health check, and optionally reads the Docker socket for the Docker Containers widget. See **Docker** in the README. The npm install is unchanged ([#46](https://github.com/Curbob/LobsterBoard/pull/46))
- `LOBSTERBOARD_TEMPLATES_DIR` setting: save exported templates to a folder outside the app. Bundled templates are still listed. When it isn't set, templates work exactly as before

### Fixed
- Built-in pages (like Claude Usage) lost their shared navigation script when a `pages/` folder existed in the working directory. `/pages/_shared/` now falls back to the bundled files

## [0.9.3] - 2026-11-27

### Added
- **Youtarr** widget in the 🎬 Media Server set, contributed by Youtarr's maintainer. [Youtarr](https://github.com/DialmasterOrg/Youtarr) downloads YouTube channels and playlists for Plex, Jellyfin and Emby; the widget shows the library (channels, videos, storage), what is downloading and queued, the last run result and recent downloads as thumbnails, in the same Visual and Numbers styles as the other media widgets. It needs Youtarr 1.94.0 or newer and a **read-only status key**, which stays on your server ([#40](https://github.com/Curbob/LobsterBoard/pull/40))

### Docs
- Website: Youtarr added to the media server lists

## [0.9.2] - 2026-11-27

### Added
- **Now Playing** is back in the widget picker (🎵 Entertainment). It needs its **Endpoint** setting pointed at a music service that returns now-playing data ([#43](https://github.com/Curbob/LobsterBoard/pull/43))

### Docs
- README: new **Add-ons** section featuring [🏢 Lobster Tower](https://github.com/Curbob/lobsterboard-tower), a cutaway building of your dashboard where every widget is a room with an avatar showing what the service is doing. It installs as a custom page: `git clone https://github.com/Curbob/lobsterboard-tower pages/tower` ([#42](https://github.com/Curbob/LobsterBoard/pull/42))

## [0.9.1] - 2026-11-25

### Added
- **Week progress / pace** — see whether you're ahead of or behind pace for your weekly AI limits ([#38](https://github.com/Curbob/LobsterBoard/pull/38))
  - **Claude Usage** page and widget: a Week Progress meter showing how far through the 7-day window you are against how much of the weekly limit is used, with a pace label (⚡ Ahead of pace / ✅ On track / ⚠️ Slightly behind / 🔴 Behind pace) and the reset date
  - **Claude Code** and **Codex CLI** widgets: a compact pace line under the Weekly bar
  - Idea and pace logic from James Tsetsekas's fork

### Fixed
- **OpenClaw release check** — if `openclaw --version` prints no version, fall back to the installed package instead of showing a false "Update available" ([#38](https://github.com/Curbob/LobsterBoard/pull/38))

### Docs
- README and website: media server widgets, 60+ widget count, current file structure; removed widgets that are no longer in the picker (Indoor Climate, Camera Feed, Power Usage, Now Playing) ([#38](https://github.com/Curbob/LobsterBoard/pull/38))

## [0.9.0] - 2026-11-25

### Added
- **🎬 Media Server widgets** — six new widgets in their own picker section: **Radarr, Sonarr, Seerr, Plex, Prowlarr and SABnzbd** ([#36](https://github.com/Curbob/LobsterBoard/pull/36))
  - Each widget has its own **Service URL** and **API key**, so you only add the services you run. Keys stay on the server (`secrets.json`) and never reach the browser.
  - **Style** option: **Visual** (rings, bars, poster strips, live speed graph, now-playing cards) or **Numbers** (stat tiles)
  - **Poster size** option (Normal, 1.5×, 2×) for Radarr, Sonarr, Seerr and Plex; posters wrap to fit the widget and re-fit when it is resized
  - Radarr: movies on disk, missing, queue, size and free space, recently added, upcoming releases, health warnings
  - Sonarr: series and episodes on disk, missing, queue, recently added (one poster per series), airing soon, health warnings
  - Seerr (also Overseerr / Jellyseerr): requests by status, open issues, latest requests
  - Plex: now playing (user, player, progress, transcode), library counts, recently added
  - Prowlarr: enabled indexers, queries, grabs and failure rate per indexer, health
  - SABnzbd: live speed graph, queue with progress, time left, today / month totals
  - New endpoint `GET /api/media/:service?widgetId=` (read-only, behind the dashboard login)

## [0.8.7] - 2026-11-25

### Added
- **Config validation** — `POST /config` now validates the dashboard config (canvas size, font scale, widget ids/types/positions, property sizes) and rejects malformed configs with a clear error; request bodies for todos, notes, server profiles and template import/export are validated too ([#23](https://github.com/Curbob/LobsterBoard/pull/23))
- **Security headers** — Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` on all responses; external iframes, media and the html2canvas CDN script remain allowed ([#23](https://github.com/Curbob/LobsterBoard/pull/23))

### Fixed
- **Widget edits not showing in the editor** — restored the `renderWidgetPreview()` function lost in the module split, so title and other property changes update the canvas as you type ([#31](https://github.com/Curbob/LobsterBoard/pull/31))
- **Remote Disk Usage ring stuck at 0%** — the remote stats normalizer now passes the agent's disk percent through — fixes [#29](https://github.com/Curbob/LobsterBoard/issues/29) ([#32](https://github.com/Curbob/LobsterBoard/pull/32))
- **"Show" header toggle that did nothing** — hidden for widgets without a header bar (Header/Text, Horizontal/Vertical Line, RSS Ticker) ([#33](https://github.com/Curbob/LobsterBoard/pull/33))

### Security
- **`systeminformation` 5.30.8 → 5.33.26** — fixes Linux command-injection, path-traversal and prototype-pollution advisories in the stats backend ([#30](https://github.com/Curbob/LobsterBoard/pull/30))
- **`@rollup/plugin-terser` 0.4 → 1.x** and other dev tooling updates — `npm audit` now reports 0 vulnerabilities ([#30](https://github.com/Curbob/LobsterBoard/pull/30), [#34](https://github.com/Curbob/LobsterBoard/pull/34))

### Technical
- `package-lock.json` is back in sync with `package.json`, so `npm ci` works and `npm install` no longer rewrites the lockfile ([#30](https://github.com/Curbob/LobsterBoard/pull/30))
- Building (`npm run build`) now requires Node 20+; running the dashboard is unchanged

## [0.8.6] - 2026-05-06

### Fixed
- **Search widget restored** — reinstated the PR27 Search widget in the picker with DuckDuckGo-style `!bangs`, keyboard focus shortcut, and query recall
- **Finance widgets restored** — reinstated the PR27 Stock Ticker and Crypto Price widgets plus their server-side finance routes
- **npm package contents** — ensured the published package includes required runtime server files and restored PR27 widget assets
- **Remote stats cleanup** — improved remote stats poller teardown to avoid stale pollers and overlapping requests

## [0.8.5] - 2026-05-06

### Fixed
- **npm package contents** — restored missing `server/` runtime files in the published package so `npx lobsterboard` and `node server.cjs` no longer crash with `Cannot find module './server/config.cjs'`

## [0.8.3] - 2026-04-02

### Fixed
- **Widget interaction** — Restored missing click-to-select, drag-to-move, and resize functionality lost in module splitting — fixes [#24](https://github.com/Curbob/LobsterBoard/issues/24)
- **Widget deletion** — Fixed non-functional delete button in properties panel by adding missing `deleteWidget()` function
- **JavaScript execution** — Fixed widget scripts not running by correcting DOM element ID matching (`widget-X` vs `preview-widget-X`)
- **Edit mode controls** — Fixed "Done" button and edit mode state management after module refactoring

### Technical
- Added complete widget event system (click, mousedown, resize handles)
- Added `startDragWidget()` and `startResizeWidget()` functions with grid snapping
- Added `deleteWidget()` function with proper state cleanup
- Fixed widget script execution timing and element targeting
- Restored full editor interactivity matching pre-0.8.1 functionality

## [0.8.2] - 2026-04-02

### Fixed
- **Critical module loading** — Fixed missing `js/widgets/index.js` and `js/editor/widgets.js` entry files after v0.8.1 module splitting, resolving 404 errors that prevented editor from loading — fixes [#24](https://github.com/Curbob/LobsterBoard/issues/24)

### Technical  
- Added widget registry initialization module (`js/widgets/index.js`)
- Added editor widget library functionality (`js/editor/widgets.js`)
- Ensures clean git clone + `npm install` + `node server.cjs` works without errors

## [0.8.1] - 2026-03-29

### Fixed
- **Module organization** — Split monolithic files into focused modules for better maintainability

## [0.8.0] - 2026-03-24

### Added
- **Claude Usage widget** — Real-time Claude Code subscription monitoring with 5-hour session, 7-day weekly, Opus/Sonnet limits, and extra usage tracking — thanks @JamesTsetsekas!
- **Claude Usage standalone page** — Full-page dashboard for detailed usage analysis at `/pages/claude-usage/`

### Fixed
- **OpenClaw version detection** — Widget now correctly parses `openclaw --version` output to fix false "Update available" notifications — thanks @JamesTsetsekas!

### Technical
- Auto-refreshes expired Claude OAuth tokens via CLI
- Reads from standard `~/.claude/.credentials.json` location
- Comprehensive error handling for rate limits and authentication issues

## [0.7.0] - 2026-03-17

### Added
- **Enhanced Gemini CLI integration** — auto-detect all available Gemini CLI quota buckets (including new 3.x models) instead of hardcoded 2.x allowlist — thanks @mastash3ff!
- **Auto-refresh OAuth tokens** — Gemini CLI tokens now automatically refresh to survive multi-machine rotation, preventing authentication failures — thanks @mastash3ff!

### Changed
- **Future-proof model support** — Gemini CLI collector now automatically surfaces new quota windows when Google adds them

## [0.3.1] - 2026-02-28

### Fixed
- **Edit mode header clutter** — page navigation links now hide when entering edit mode to reduce header crowding

## [0.3.0] - 2026-02-28

### Added
- **Theme switcher** — 5 themes: Default (dark), Feminine (pastel pink/lavender), Feminine Dark, Terminal (green CRT), Paper (cream/sepia)
- **Phosphor icon system** — themed widgets use Phosphor icons; Default theme keeps emoji
- **Theme selector dropdown** in edit mode header
- Theme persists to localStorage and dashboard config
- **Themes showcase** on website and README with lightbox gallery

## [0.2.6] - 2026-02-23

### Fixed
- **Version suffix comparison** — versions like `2026.2.22-2` (npm post-release patches) now correctly match GitHub tags like `v2026.2.22`, fixing false "Update available" indicators — thanks @JamesTsetsekas!

## [0.2.5] - 2026-02-19

### Fixed
- **iCal timezone parsing** — calendar events now display at correct times regardless of timezone (TZID parameter support) — thanks @jlgrimes!

### Added
- **Clickable URLs in calendar** — Zoom/Teams links in event summaries and locations are now hyperlinks — thanks @jlgrimes!

## [0.2.4] - 2026-02-17

### Fixed
- SSRF vulnerability in RSS feed proxy (thanks @jlgrimes for the security report!)

## [0.2.3] - 2026-02-16

### Added
- **PIN-locked edit mode** — set a 4-6 digit PIN to prevent unauthorized editing (SHA-256 hashed, server-side only)
- **Server-side secrets store** — API keys, calendar URLs, and tokens stored in `secrets.json`, never sent to browser
- **Public Mode** — hides edit button and blocks config APIs; subtle 🔒 unlock button for admin access
- **Privacy warnings** on sensitive widgets (System Log, Activity List, Cron Jobs, Calendar, Todo List) — ⚠️ badge in widget panel + orange warning in properties panel
- **Community Widgets** — contribution guide, templates, and PR checklist for community widget submissions

### Fixed
- Private calendar URLs (Google Calendar, iCloud CalDAV) no longer leak in template exports
- Template export `stripSensitive()` now detects URLs with auth tokens
- Public mode toggle uses masked PIN modal instead of plain-text `prompt()`
- `closePinModal()` no longer kills pending callbacks

### Security
- `auth.json` and `secrets.json` added to `.gitignore`
- Pre-commit hook blocks private data patterns in template files

## [0.2.2] - 2026-02-16

### Fixed
- Removed private Google Calendar URL accidentally included in template config
- Fixed `stripSensitive()` to detect and blank URLs with embedded auth tokens

## [0.2.1] - 2026-02-15

### Fixed
- Minor bug fixes and stability improvements

## [0.2.0] - 2026-02-15

### Added
- **Template Gallery** — export, import, and share dashboard layouts with auto-screenshot previews
  - `js/templates.js` — new template gallery UI and export system
  - Templates API: list, get, preview, import (merge/replace), export, delete
  - `templates/` directory with bundled starter templates
  - Template modal with search, preview lightbox, and import options
- **Notes widget** — persistent rich-text notes with auto-save via `/api/notes`
- **Browse button** for directory selection in image widgets (Image, Random Image, Latest Image)
- **GitHub Stats widget rework** — profile contributions, stars, and activity with property bindings
- **LobsterBoard Release widget** — version update checker via `/api/lb-release`
- **SSE streaming** for system stats (`/api/stats/stream`)
- **Browse directories API** (`/api/browse-dirs`) for server-side directory picker
- Sidebar reorder, verified checkmarks, delete button, tooltips in editor
- html2canvas-based dashboard screenshot export
- Scrollable canvas mode

### Changed
- Stock Ticker widget — fixed `hasApiKey` check
- Builder — contenteditable keyboard fix, null-checks throughout
- License changed from MIT to BSL-1.1
- Widget count: 47 → 50

### Removed
- GPT Usage widget (standalone) — use AI Cost Tracker or Claude Usage instead

## [0.1.6] - 2025-02-14

- Initial public npm release
- 47 widgets, drag-and-drop editor, custom pages system
- SSRF protection for proxy endpoints

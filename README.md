# 🦞 LobsterBoard

A self-hosted, drag-and-drop dashboard builder with 60+ widgets, a template gallery, custom pages, and zero cloud dependencies. One Node.js server, no frameworks, no build step needed.

**Works standalone or with [OpenClaw](https://github.com/openclaw/openclaw).** LobsterBoard is a general-purpose dashboard — use it to monitor your homelab, track stocks, display weather, manage todos, or anything else. OpenClaw users get bonus widgets (auth status, cron jobs, activity logs), but they're completely optional.

![LobsterBoard](lobsterboard-logo-final.png)

![LobsterBoard Dashboard](lobsterboard-screenshot.jpg)

## Quick Start

```bash
npm install lobsterboard
cd node_modules/lobsterboard
node server.cjs
```

Or clone it:

```bash
git clone https://github.com/Curbob/LobsterBoard.git
cd LobsterBoard
npm install
node server.cjs
```

Open **http://localhost:8080** → press **Ctrl+E** to enter edit mode → drag widgets from the sidebar → click **💾 Save**.

![Edit Mode](lobsterboard-editor.jpg)

## Features

- **Drag-and-drop editor** — visual layout with 20px snap grid, resize handles, property panel
- **60+ widgets** — system monitoring, weather, calendars, RSS, smart home, finance, AI/LLM tracking, notes, and more
- **Template Gallery** — export, import, and share dashboard layouts with auto-screenshot previews; import as merge or full replace
- **Custom pages** — extend your dashboard with full custom pages (notes, kanban boards, anything)
- **Canvas sizes** — preset resolutions (1920×1080, 2560×1440, etc.) or custom sizes
- **Live data** — system stats stream via Server-Sent Events, widgets auto-refresh
- **5 themes** — Default (dark), Terminal (CRT green), Feminine (pastel pink), Feminine Dark, Paper (sepia)
- **No cloud** — everything runs locally, your data stays yours

## Themes

LobsterBoard ships with 5 built-in themes. Switch themes from the dropdown in edit mode — your choice persists across sessions.

| Default | Terminal | Paper |
|---------|----------|-------|
| ![Default](site-assets/themes/theme-default.png) | ![Terminal](site-assets/themes/theme-terminal.png) | ![Paper](site-assets/themes/theme-paper.png) |

| Feminine | Feminine Dark |
|----------|---------------|
| ![Feminine](site-assets/themes/theme-feminine.png) | ![Feminine Dark](site-assets/themes/theme-feminine-dark.png) |

- **Default** — dark theme with emoji icons (the classic look)
- **Terminal** — green CRT aesthetic with scanlines and Phosphor icons
- **Paper** — warm cream/sepia tones, serif fonts, vintage feel
- **Feminine** — soft pink and lavender pastels with subtle glows
- **Feminine Dark** — pink/purple accents on a dark background

## Remote Server Monitoring

Monitor multiple servers from a single dashboard using [lobsterboard-agent](https://www.npmjs.com/package/lobsterboard-agent).

### Setup Remote Server

On your VPS/remote server:

```bash
npm install -g lobsterboard-agent
lobsterboard-agent init     # Generates API key - save it!
lobsterboard-agent serve    # Starts on port 9090
```

### Add to LobsterBoard

1. Click **🖥️ Servers** in the header
2. Enter server name, URL (`http://your-server-ip:9090`), and API key
3. Click **Test Connection** to verify
4. Add widgets (Uptime Monitor, Docker, CPU/Memory, etc.)
5. Select your remote server from the **Server** dropdown in widget properties

### Supported Widgets

These widgets support remote server data:

| Widget | What It Shows |
|--------|---------------|
| **Uptime Monitor** | System uptime, CPU, memory |
| **CPU / Memory** | CPU usage + RAM usage |
| **Disk Usage** | Disk space with ring chart |
| **Network Speed** | Upload/download throughput |
| **Docker Containers** | Container list and status |

### Multi-Server Dashboard

Add multiple widgets and select different servers for each — monitor your entire infrastructure from one dashboard.

## Configuration

```bash
PORT=3000 node server.cjs              # Custom port
HOST=0.0.0.0 node server.cjs           # Expose to network
```

Widget settings are edited in the right-hand panel during edit mode. All configuration saves to `config.json`.

## Template Gallery

![Template Gallery](lobsterboard-templates.jpg)

LobsterBoard includes a built-in template system for sharing and reusing dashboard layouts.

![Template Import](lobsterboard-template-detail.jpg)

- **Export** your current dashboard as a template (auto-captures a screenshot preview)
- **Browse** the template gallery to discover pre-built layouts
- **Import** templates in two modes:
  - **Replace** — swap your entire dashboard for the template
  - **Merge** — append the template's widgets below your existing layout
- Templates are stored in the `templates/` directory and can be shared as folders

![Dashboard Example](lobsterboard-dashboard-2.jpg)

## Widgets

### 🖥️ System Monitoring
| Widget | Description |
|--------|-------------|
| CPU / Memory | Real-time CPU load and memory usage |
| Disk Usage | Disk space with ring gauge |
| Network Speed | Upload/download throughput |
| Uptime Monitor | System uptime, CPU load, memory summary |
| Docker Containers | Container list with status |

### 🌤️ Weather
| Widget | Description |
|--------|-------------|
| Local Weather | Current conditions for your city |
| World Weather | Multi-city weather overview |

### ⏰ Time & Productivity
| Widget | Description |
|--------|-------------|
| Clock | Analog/digital clock |
| World Clock | Multiple time zones |
| Countdown | Timer to a target date |
| Todo List | Persistent task list |
| Pomodoro Timer | Work/break timer |
| Notes | Persistent rich-text notes with auto-save |

### 📰 Media & Content
| Widget | Description |
|--------|-------------|
| RSS Ticker | Scrolling feed from any RSS/Atom URL |
| Calendar | iCal feed display (Google, Apple, Outlook) |
| Now Playing | Currently playing media |
| Quote of Day | Random inspirational quotes |
| Quick Links | Bookmark grid |

### 🤖 AI / LLM Monitoring

Track your AI coding subscriptions in real-time. Inspired by [OpenUsage](https://github.com/robinebers/openusage) by Robin Ebers.

| Widget | Description | Setup |
|--------|-------------|-------|
| AI Usage | Combined view of all providers | — |
| Claude Code | Session, weekly, Opus limits | Run `claude` once |
| Codex CLI | Session, weekly, code reviews | Run `codex` once |
| GitHub Copilot | Premium, chat, completions | Run `gh auth login` |
| Cursor | Credits, usage breakdown | Just use Cursor IDE |
| Gemini CLI | All available Gemini CLI quota buckets | Run `gemini` once |
| Amp | Free tier, credits | Run `amp` once |
| Factory / Droid | Standard, premium tokens | Run `factory` once |
| Kimi Code | Session, weekly | Run `kimi` once |
| JetBrains AI | Quota tracking | Sign in via IDE |
| Antigravity | Gemini 3, Claude via Google | Run `antigravity-usage login` |
| MiniMax | Coding plan session | Set `MINIMAX_API_KEY` |
| Z.ai | Session, weekly | Set `ZAI_API_KEY` |
| AI Cost Tracker | Monthly cost breakdown | — |
| API Status | Provider availability | — |
| Active Sessions | OpenClaw session monitor | — |
| Token Gauge | Context window usage | — |

### 💰 Finance
| Widget | Description |
|--------|-------------|
| Stock Ticker | Live stock prices (requires API key) |
| Crypto Price | Cryptocurrency tracker |

### 🏠 Smart Home
| Widget | Description |
|--------|-------------|
| Indoor Climate | Temperature/humidity sensors |
| Camera Feed | IP camera stream |
| Power Usage | Energy monitoring |

### 🔗 Embeds & Media
| Widget | Description |
|--------|-------------|
| Image / Random Image / Web Image / Latest Image | Static, rotating, remote, or latest images (with browse button for directory selection) |
| Iframe Embed | Embed any webpage |

### 🔧 Utility
| Widget | Description |
|--------|-------------|
| Auth Status | Authentication status display |
| Sleep Score | Garmin sleep score widget |
| GitHub Stats | Repository stats — stars, forks, open issues, open PRs |
| Unread Emails | Email inbox counter |
| System Log | Recent system log entries |
| Activity List | Activity timeline |
| Cron Jobs | Cron job status monitor |
| LobsterBoard Release | Version update checker |
| OpenClaw Release | OpenClaw version checker |
| Release | Generic release tracker |

### 🎨 Layout
| Widget | Description |
|--------|-------------|
| Header / Text | Custom text with formatting |
| Horizontal Line | Divider |
| Vertical Line | Vertical divider |
| Pages Menu | Navigation for custom pages |

## Custom Pages

LobsterBoard includes a pages system for adding full custom pages beyond the widget dashboard. Pages get their own route, nav entry, and optional server-side API.

```
pages/
└── my-page/
    ├── page.json       # Metadata (title, icon, order)
    ├── index.html      # Page UI
    └── api.cjs         # Optional: server-side API routes
```

Pages are auto-discovered on startup. Drop a folder in `pages/`, restart the server, and it appears in the nav.

👉 **Full guide with examples:** [`pages/README.md`](pages/README.md)

## Run on Boot

### macOS (launchd)

```bash
cat > ~/Library/LaunchAgents/com.lobsterboard.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.lobsterboard</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/node</string>
      <string>/path/to/lobsterboard/server.cjs</string>
    </array>
    <key>WorkingDirectory</key><string>/path/to/lobsterboard</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PORT</key><string>8080</string>
      <key>HOST</key><string>0.0.0.0</string>
    </dict>
  </dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.lobsterboard.plist
```

Update the paths to match your install location and Node.js binary (`which node`).

### Linux (systemd)

```bash
sudo cat > /etc/systemd/system/lobsterboard.service << 'EOF'
[Unit]
Description=LobsterBoard Dashboard
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/lobsterboard
ExecStart=/usr/bin/node server.cjs
Environment=PORT=8080 HOST=0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable lobsterboard
sudo systemctl start lobsterboard
```

### pm2 (any OS)

```bash
npm install -g pm2
cd /path/to/lobsterboard
PORT=8080 HOST=0.0.0.0 pm2 start server.cjs --name lobsterboard
pm2 save
pm2 startup
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET/POST | Load/save dashboard layout |
| `/api/stats/stream` | GET | Live system stats (SSE) |
| `/api/pages` | GET | List custom pages |
| `/api/todos` | GET/POST | Todo list data |
| `/api/notes` | GET/POST | Notes widget data |
| `/api/templates` | GET | List available templates |
| `/api/templates/:id` | GET | Get template config |
| `/api/templates/:id/preview` | GET | Template preview image |
| `/api/templates/import` | POST | Import a template (merge/replace) |
| `/api/templates/export` | POST | Export current dashboard as template |
| `/api/calendar?url=` | GET | Proxy iCal feed |
| `/api/rss?url=` | GET | Proxy RSS/Atom feed |
| `/api/lb-release` | GET | LobsterBoard version check |

## File Structure

```
lobsterboard/
├── server.cjs          # Node.js server
├── app.html            # Dashboard builder
├── config.json         # Your saved layout
├── js/
│   ├── builder.js      # Editor: drag-drop, zoom, config I/O
│   ├── widgets.js      # All 50 widget definitions
│   └── templates.js    # Template gallery & export system
├── css/
│   └── builder.css     # Dark theme styles
├── templates/          # Dashboard templates
│   ├── templates.json  # Template index
│   └── */              # Individual template folders
├── pages/              # Custom pages (auto-discovered)
│   └── README.md       # Page creation guide
└── package.json
```

## Community Widgets

Community contributions are welcome! Build your own widget and share it with the LobsterBoard community.

- 📖 **[Contributing Guide](CONTRIBUTING.md)** — how to create and submit a widget
- 📁 **[Community Widgets](community-widgets/)** — browse contributed widgets and the starter template

## License

This project is licensed under the **Business Source License 1.1 (BSL-1.1)**.

You are free to use, modify, and self-host LobsterBoard for **non-commercial purposes**. Commercial use requires a separate license. See [LICENSE](LICENSE) for full terms.

## Commercial Licensing

For commercial use, OEM licensing, or enterprise deployments, contact:

📧 **curbob** on GitHub — [github.com/Curbob](https://github.com/Curbob)

---

Made with 🦞 by [Curbob](https://github.com/Curbob)

# Teddy Homebase Architecture

Last updated: 2026-05-18

## Purpose

Teddy Homebase is Dan's private Mac mini and home-stack cockpit. It should stay calm, ranked, and evidence-backed.

The first screen should answer:

1. Is the house stack steady?
2. What should Dan check first?
3. What changed in a meaningful way?

## Runtime Boundary

Inside this repo:

- LobsterBoard server: `server.cjs`
- Homebase page: `pages/teddy-house/`
- Homebase API: `pages/teddy-house/api.cjs`
- Homebase log view: `pages/teddy-house/logs/`
- Auth and trusted-device handling: `server/auth.cjs`
- Route and static-file handling: `server.cjs`

Outside this repo:

- OpenClaw gateway and logs.
- Homebridge and Homebridge accessory cache.
- AdGuard DNS/admin surface.
- Tailscale Serve/Funnel.
- macOS update and diagnostic logs.
- BlueBubbles public Funnel on `:8443`.

## Public And Private Routes

Expected public Funnel routes:

- `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/` -> local Homebase server on `127.0.0.1:8080`
- `https://openclaw-mac-mini.tail02a3b6.ts.net:8443/` -> BlueBubbles on `127.0.0.1:1234`

Tailnet-only/local surfaces include:

- AdGuard on `:3001`
- OpenClaw root route
- `/pages/teddy-house`
- `/api/pages/teddy-house`
- `/ipad-drop`

Do not mutate Tailscale Serve/Funnel without explicit Dan approval.

## Data Contract

Homebase stores operational evidence in `data/teddy-house/`.

| File | Purpose |
| --- | --- |
| `snapshot.json` | Latest drift baseline for change detection |
| `timeline.json` | Persistent event history |
| `visual-evidence.json` | Evidence of what the dashboard rendered and why |
| `service-logs.json` | Latest normalized redacted service-log snapshot |
| `vitals-history.json` | Real local vitals samples used for CPU peak summaries |
| `ask-history.json` | Ask Teddy responses and fallback answers |
| `manual-verifications.json` | Short-lived human verification notes |

Rules:

- Keep histories bounded in code.
- Do not show raw `/data/...` files directly in the browser.
- New persisted signals need source, confidence, retention, and tests.

## Signal Model

Homebase separates daily state from evidence.

Daily state:

- `outside-access`
- `network`
- `smart-home`
- `mac-mini`

Evidence stays lower on the page:

- service probes
- DNS block stats
- Homebridge accessory/log/version checks
- Tailscale public route state
- WAN quality
- service logs
- app/macOS/system updates
- Mac mini vitals
- grouped recent changes

Eufy lock state is degraded evidence only. It must not become trusted daily house state until the source is fixed or replaced.

## Auth Model

Remote and Tailscale access stays passworded.

Loopback probes may access a narrow surface for health checks:

- `GET /pages/teddy-house/`
- `GET /pages/_shared/nav.js`
- `GET /api/pages`
- `GET /api/pages/teddy-house/health`
- `GET /api/pages/teddy-house/logs`
- `POST /api/pages/teddy-house/ask`
- Teddy Homebase static assets

Public, LAN, tailnet, and Funnel-looking hosts must remain passworded. Direct `/data/...` access must return not found.

## Ask Teddy

Ask Teddy should answer quickly from the dashboard context by default.

The live OpenClaw/Teddy bridge is opt-in with:

```bash
TEDDY_HOMEBASE_ASK_AGENT=1
```

No write action should run from Ask Teddy without explicit approval, dry-run behavior, and tests.

## Quality Gates

Required check:

```bash
npm run check -- --runInBand
```

Rendered UI proof is required when changing:

- layout
- copy
- loading states
- auth/login flow
- mobile behavior
- routes or static assets

Live proof should include:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

For public/Funnel changes, also verify the Tailscale URL while authenticated.

## Release And Rollback

Homebase runs as a local LaunchAgent:

```bash
launchctl kickstart -k gui/$(id -u)/com.teddy.house-lobsterboard
```

Rollback is git-first:

- Keep commits scoped.
- Do not reset dirty user work.
- For route/auth changes, prefer reverting the specific commit and restarting the LaunchAgent.

## Current Hardening Backlog

1. Add CI for `npm run check -- --runInBand`.
2. Add a one-command local + Tailscale smoke script.
3. Add explicit retention checks for `data/teddy-house/*history*.json` and `visual-evidence.json`.
4. Add guarded, dry-run-first action hooks for update tasks.
5. Keep the daily screen quiet as new evidence sources arrive.

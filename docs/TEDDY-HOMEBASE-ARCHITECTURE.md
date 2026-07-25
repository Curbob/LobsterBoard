# Teddy Homebase Architecture

Last updated: 2026-07-25

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

- Hermes gateway and logs.
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
- Hermes root route
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
| `boot-history.json` | Current and recent Mac mini boot sessions used for restart summaries |
| `wan-history.json` | Real WAN latency samples used for 24h internet-quality summaries |
| `public-access-history.json` | Accepted and unexpected public route states with last-change evidence |
| `automation-log-history.json` | Current Homebridge/accessory log state with first-seen and last-seen evidence |
| `ask-history.json` | Ask Teddy responses and fallback answers |
| `manual-verifications.json` | Short-lived human verification notes |

Rules:

- Keep histories bounded in code.
- Do not show raw `/data/...` files directly in the browser.
- New persisted signals need source, confidence, retention, and tests.

## Signal Model

Homebase separates daily state from evidence.

The daily model is incident-led:

1. Probes and persisted histories produce source-backed signals.
2. Signals become named incidents when they need Dan's attention.
3. Incidents carry lifecycle state: new, recurring, known, resolved, ignored, or active.
4. The story engine chooses one primary house story, one first action, and one affected zone.
5. Ask Teddy receives that same story, so the page, API, replay fixtures, and Ask answer agree.

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
- persisted memory summaries for boot sessions, WAN latency, public access, automation logs, CPU peaks, and house changes
- app/macOS/system updates
- Mac mini vitals
- grouped recent changes

Eufy lock state is degraded evidence only. It must not become trusted daily house state until the source is fixed or replaced.

Source labels are not decoration. The UI shows trust labels only when they change Dan's interpretation: `Cached`, `Needs login`, `Degraded source`, or `Manual verified`. Routine live data stays visually quiet.

## First-Screen Contract

The first screen is a decision surface, not a widget gallery.

Top-level order:

1. Status band: current house story.
2. Daily Decision Strip: `Now`, `Watch`, `Later`.
3. Review lane when something needs Dan.
4. Affected house zone before raw evidence.
5. Mac mini vitals before deep evidence in incident states.
6. Ask Teddy.
7. Evidence, signals, logs, and grouped changes.

Rules:

- `Now` uses current health response data only.
- `Watch` may mention non-urgent context.
- `Later` is for optional maintenance.
- Healthy first screens must not show raw ports, IPs, package counts, stale labels, degraded labels, or ignored lock evidence as truth.
- Active warning states must name the first useful check in house language.
- Phone first-viewport copy is budgeted in QA. A useful Homebase screen should be readable at a glance, not a compressed log report.
- Reboot-aware Mac mini evidence must use persisted samples scoped to the current boot session; do not draw fake trends.

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

Teddy runs on Hermes. Production Ask Teddy uses the live bridge, with the local dashboard-context answer retained as the failure fallback:

```bash
TEDDY_HOMEBASE_ASK_AGENT=1
TEDDY_HOMEBASE_ASK_LOCAL_ONLY=0
TEDDY_HOMEBASE_HERMES_BIN=/Users/teddyclaw/.local/bin/hermes
HERMES_HOME=/Volumes/MacMiniWork/Hermes
```

The bridge runs `hermes chat` with source `homebase`, the restricted `session_search` toolset, four maximum tool turns, and the existing Homebase read-only prompt guard. The browser API remains `POST /api/pages/teddy-house/ask`; Hermes failures return the labeled local fallback. Set `TEDDY_HOMEBASE_ASK_AGENT=0` and `TEDDY_HOMEBASE_ASK_LOCAL_ONLY=1` only for deliberate local-only recovery.

No write action should run from Ask Teddy without explicit approval, dry-run behavior, and tests.

## Quality Gates

Required check:

```bash
npm run check -- --runInBand
npm run check:homebase
```

`npm run check:homebase` is the canonical Homebase release gate. It covers the full test suite, replayed house-state fixtures, local page/health/log route smokes, first-screen copy blacklist checks, rendered first-screen assertions, phone/iPad/desktop screenshot capture, persisted evidence retention checks, and public Funnel auth smoke when reachable.

The current release gate also proves:

- 24 curated replay stories.
- API, rendered page, and Ask Teddy story agreement.
- Redacted recorded incident replay.
- Parser golden fixtures for Homebridge logs, Govee grouping, Eufy ignored evidence, macOS diagnostics, Tailscale route drift, timestamp freshness, and AdGuard stats.
- Homebridge Guard spec coverage.
- Daily Decision Strip spec coverage.
- Nightly Truth Suite spec coverage.
- Scenario Replay Pack spec coverage.
- Level-up roadmap spec coverage.
- Source contracts for trust, freshness, confidence, source, and first-screen eligibility.
- Phone copy budget and trust-label visibility rules.

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

1. Add CI for `npm run check -- --runInBand` and `npm run check:homebase`.
2. Add guarded, dry-run-first action hooks for update tasks.
3. Add new recorded incident bundles whenever Dan catches a genuinely new failure mode.
4. Keep the daily screen quiet as new evidence sources arrive.

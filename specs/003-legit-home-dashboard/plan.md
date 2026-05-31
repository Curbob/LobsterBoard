# Legit Home Dashboard Plan

## Phase 1: Fix The Domain Model

Move from source-based warnings to house-domain warnings.

- Split `serviceLogs` into domain-specific rollups:
  - `automationLogs`: Homebridge, Govee, TP-Link, accessory/plugin loops.
  - `macMiniLogs`: Homebase process, OpenClaw gateway, macOS/system diagnostics.
  - `networkLogs`: Tailscale, AdGuard, WAN/DNS failures.
- Keep the raw grouped logs view unchanged as evidence.
- Update `houseState` so each zone only consumes signals from its domain.
- Rename generic review items:
  - `Service Logs: Govee connection degraded` -> `Govee connection degraded`
  - `Homebridge Log: needs review` -> `Homebridge log needs review`
  - `System Logs: 2` -> `Mac restart incident`

## Phase 2: Add Replayable Home States

Create a lightweight replay harness so scary states can be tested on demand.

- Store redacted fixtures for:
  - healthy house
  - Govee/Homebridge loop
  - Mac restart/panic
  - public exposure drift
  - WAN/DNS degradation
  - Teddy bridge fallback
- Add API/design tests that feed each fixture through the same derivation code used by live health.
- Capture expected visible copy and zone order for each state.

## Phase 3: Add Real Historical Summaries

Turn persisted evidence into useful small trends.

- Keep no fake sparklines.
- Add real summaries only where data exists:
  - WAN latency: current, 6h max, 24h worst.
  - Mac mini: uptime, current boot, restart count in 7d.
  - Homebridge: current loop source, first seen, last seen, count window.
  - Public access: current accepted routes and last route change.
- Keep charts low on the page unless they explain the top warning.

## Phase 4: Add Guided Action Without Auto-Mutation

Make the dashboard useful when something is wrong.

- Add `Explain` and `Prepare fix` actions for review items.
- `Explain` asks Teddy for a plain-language diagnosis using current health context.
- `Prepare fix` asks Codex/Teddy for a dry-run plan and required approvals.
- No button should restart services, update packages, change Tailscale, or edit Homebridge without an explicit separate approval step.

## Phase 5: Harden QA And Release

Make regressions hard to ship.

- Add a one-command Homebase QA script:
  - lint/tests
  - local health/logs/ask smoke
  - public auth smoke
  - mobile/iPad/desktop screenshot capture
  - copy blacklist
- Keep proof artifacts under `artifacts/qa/` only when they document a shipped change.
- Add CI or a local pre-push check for `npm run check -- --runInBand`.

## Recommended First Slice

Build Phase 1 and the replay harness first.

Reason: the current live dashboard already proves the issue. Govee/Homebridge noise should be an `Automations` story, not a `Mac mini` story. Fixing that domain model makes every later chart, Ask Teddy answer, and action button more trustworthy.

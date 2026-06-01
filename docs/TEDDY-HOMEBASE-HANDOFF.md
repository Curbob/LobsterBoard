# Teddy Homebase Handoff

Recorded: 2026-05-17 05:38:53 PDT
Updated: 2026-06-01

Dan said "Tell Teddy" after fixing the Homebase health-check issues.

## Current Contract

- Local health-check automation may probe Homebase without a browser session only from loopback host plus loopback socket.
- The unauthenticated local probe surface is intentionally narrow:
  - `/pages/teddy-house/`
  - `GET /api/pages/teddy-house/health`
  - `POST /api/pages/teddy-house/ask`
- Public, tailnet, LAN, and Funnel-looking hosts stay passworded.
- Set `TEDDY_HOMEBASE_LOCAL_PROBES=0` to disable the local probe bypass.
- Direct `/data/...` routes stay blocked.
- Eufy/door-lock state stays ignored/degraded until there is a trusted lock source.
- Optional Homebridge UI, app, and macOS updates stay in maintenance unless they are truly urgent.

## First Screen

- The page should answer what Dan should check first, not ask him to interpret telemetry.
- The Daily Decision Strip is the primary five-second read: `Now`, `Watch`, `Later`.
- `Now` uses current health data only.
- Evidence-only or optional maintenance states stay out of `Now`.
- Review items must map to the first warned house zone.
- Raw ports, IPs, package counts, stale labels, degraded labels, and ignored lock evidence do not belong on the healthy first screen.

## Ask Teddy

- Ask Teddy should answer from dashboard context by default.
- The live OpenClaw/Teddy bridge is opt-in only with `TEDDY_HOMEBASE_ASK_AGENT=1`.
- If Ask reports timeout or fallback, first check whether the bridge was explicitly enabled and slow. Local dashboard-context answers are the expected normal path.

## Verification Notes

- Updated files:
  - `/Users/teddyclaw/teddy-house-lobsterboard/server.cjs`
  - `/Users/teddyclaw/teddy-house-lobsterboard/pages/teddy-house/api.cjs`
  - `/Users/teddyclaw/teddy-house-lobsterboard/tests/auth.test.js`
  - `/Users/teddyclaw/teddy-house-lobsterboard/tests/teddy-house.test.js`
- `node --check server.cjs` passed.
- `node --check pages/teddy-house/api.cjs` passed.
- `npm run lint` passed.
- Socket-based Vitest server suites could not run in the 2026-05-17 Codex sandbox because binding `127.0.0.1` failed with `EPERM`.

## Current SDLC Checkpoint

- Latest Homebase commit at this handoff update: `ac23311` (`Add daily decision strip QA gate`).
- Current full proof command: `npm run check:homebase`.
- Latest checked result during this pass: static lint passed, 132 unit tests passed, and Homebase QA passed with 23 replay stories.
- `AGENTS.md` is now the operational contract for future Codex work.
- Architecture map: `docs/TEDDY-HOMEBASE-ARCHITECTURE.md`.

## Current QA Gates

`npm run check:homebase` proves:

- Live local page, health, logs, and Ask route smokes.
- Public Funnel auth boundary when reachable.
- Cached login behavior in an isolated browser context.
- API, rendered page, and Ask Teddy agree on the first action.
- Ask Teddy fallback is labeled honestly.
- 23 curated replay stories.
- Redacted recorded incident replay.
- Phone, iPad, and desktop screenshot contracts.
- Source contracts for trust, freshness, confidence, and first-screen eligibility.
- Homebridge Guard spec coverage.
- Daily Decision Strip spec coverage.
- Nightly Truth Suite spec coverage.
- Scenario Replay Pack spec coverage.

## Product Decisions To Preserve

- Empty Review lane stays hidden when there are no review items.
- Mac mini vitals appear before Ask Teddy and raw evidence.
- Memory card shows macOS memory pressure/free percentage, not scary cache-heavy used RAM as the primary value.
- CPU card may show recent peaks only from persisted `vitals-history.json`.
- Changes timeline groups repeat events instead of showing the same warning over and over.
- Direct `/data/...` routes stay blocked.

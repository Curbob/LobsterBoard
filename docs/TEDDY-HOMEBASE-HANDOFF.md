# Teddy Homebase Handoff

Recorded: 2026-05-17 05:38:53 PDT
Updated: 2026-07-25

## 2026-07-25 Hermes Runtime Port

- Teddy remains the agent; Hermes now owns his runtime.
- Homebase service health checks `ai.hermes.gateway`, service-log evidence reads Hermes gateway logs, and the service/source model now uses `hermes`.
- Production Ask Teddy now runs an isolated Hermes `homebase` session in safe
  mode with no tools and preserves the local fallback. The loaded LaunchAgent
  uses `TEDDY_HOMEBASE_ASK_AGENT=1` and `TEDDY_HOMEBASE_ASK_LOCAL_ONLY=0`.
- The `openclaw-mac-mini` Tailscale hostname is unchanged; it is network identity, not the agent runtime.
- Codex token preflight is now vendored under this repo and reads Hermes memory roots, so the development gate no longer executes code from the retired OpenClaw workspace.

## 2026-07-25 Android Route Repair

- Root cause: the Android device-lab launcher omitted Homebase's approved `:10000` Funnel port, so Chrome reached the tailnet root service and rendered `Not found`.
- The shared Android route helper now owns the canonical `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/` URL and normalizes the known portless legacy URL.
- Physical-device proof on Dan's A15 confirmed the trusted login persisted, Homebase rendered score 100, and the Tailscale Serve/Funnel map stayed unchanged.
- Fresh release proof: live Hermes Ask returned `source: teddy`; `npm run check:homebase` passed 212 tests, 24 replay stories, six responsive screenshots, and enforced public auth.

## 2026-07-18 Ask And First-Screen Update (superseded runtime settings)

- At that time Ask Teddy used the local-only path. The current production
  settings are authoritative in the 2026-07-25 section above.
- The first-screen order is now readiness, `Now / Watch / Later`, then House State and Ask Teddy. Home Stats and Mac mini vitals are supporting context below the action surface.
- Desktop uses a readable House State and Ask Teddy split; phone and tablet layouts stack without horizontal overflow.
- Fresh rendered proof: Ask Teddy answered in about 0.36 seconds at 1280x720, and the layout passed direct 1280x720 and 390x844 browser checks.
- Fresh release proof: `npm run check:homebase` passed 207 tests, six responsive screenshots, public auth, story agreement, fallback honesty, and all trust gates. Verdict: `Homebase is useful`; first action: `Nothing needs Dan.`

## 2026-07-17 Trust And Exposure Update

- Root `:443` is no longer a public Funnel. Approved public routes remain BlueBubbles `:8443` and passworded Teddy Homebase `:10000`.
- Unauthenticated loopback access remains available for read-only Homebase page, health, logs, and local Ask probes. Incident capture and mark-known writes now require authenticated same-origin requests.
- The release gate returns nonzero when Homebase acceptance fails.
- Dependency audits are clean and the declared Node range matches the active toolchain.
- Fresh proof after service restart: `npm run check:homebase` passed 207 tests, six responsive rendered lanes, public auth, story agreement, incident mutation auth, and all trust gates. Verdict: `Homebase is useful`; first action: `Nothing needs Dan.`

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

- Ask Teddy should answer through Teddy on Hermes using the supplied dashboard context.
- Production uses `TEDDY_HOMEBASE_ASK_AGENT=1` and `TEDDY_HOMEBASE_ASK_LOCAL_ONLY=0`.
- If Hermes times out or leaves the Homebase scope, the response must be labeled `local-fallback`; local dashboard-context answers remain the recovery path.

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

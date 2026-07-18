# Implementation Notes

## 2026-06-28 TeddyCam And Stack Update Receipt

### What Changed

- Added TeddyCam as a first-class Teddy Homebase service and evidence signal.
- The health API reads the existing TeddyCam video-lane receipt plus local app/HLS ports, but only exposes privacy-light status: active state, codec/size, freshness, route names, and privacy flags.
- Added TeddyCam and TeddyCam Lite private tailnet shortcuts to Local Links; Homebase does not embed the camera feed.
- Added a local persisted operator-update receipt covering the OpenClaw, Homebridge, BlueBubbles, reboot inspection, update watcher, TeddyCam, and token-budget work.
- Extended source contracts, visual evidence, change tracking, and Ask Teddy’s compact context so TeddyCam status is available without stream URLs or credentials.

### Proof

- `npm run test -- tests/teddy-house.test.js tests/teddy-house-design.test.js`: 108/108 passing.
- `npm run check:homebase`: static lint passed, 179/179 tests passing, Homebase QA `status=ok`, `acceptanceStatus=ok`, 6 responsive screenshots captured.
- Latest QA artifact: `artifacts/qa/homebase-latest.json`, generated `2026-06-28T00:20:53.194Z`.

### Current Limits

- Live Homebase verdict still has one source-backed review item: network service logs, first action `Check network service logs first.`
- `data/teddy-house/operator-update.json` is local persisted Homebase evidence in the ignored data area, matching the existing evidence-file pattern.

## 2026-06-28 Homebase Noise Cleanup

### What Changed

- AdGuard stats login failures now enter a 6-hour backoff after a rejected Teddy service login instead of retrying on every health refresh.
- Homebase service-log parsing ignores local AdGuard `/control/login` 403/429 noise from its own stats attempts; DNS health and AdGuard stats trust still remain visible separately.
- Optional macOS updates now stay in maintenance unless the update text looks security, critical, urgent, required, or restart-related.
- First-screen review copy now names AdGuard logs directly instead of collapsing that warning into generic internet copy.
- Homebase QA now requires the live TeddyCam contract: private-camera service, public stream false, stream URLs omitted, visual evidence present, and source-contract first-screen ineligible.
- Added unit coverage for AdGuard login backoff, optional macOS update classification, and stale/broken TeddyCam receipts.

### Proof

- `npm run test -- tests/teddy-house.test.js tests/teddy-house-design.test.js`: 110/110 passing.
- `npm run check:homebase`: static lint passed, 181/181 tests passing, Homebase QA `status=ok`, `acceptanceStatus=ok`, truth verdict `Homebase is useful`.
- Restarted `com.teddy.house-lobsterboard`; live API reports score `100`, `needsDan=[]`, `Network service logs` quiet, optional macOS update in maintenance, and TeddyCam `ok`.

## 2026-06-28 Fast First Load And Dan-First Priority Surface

### What Changed

- Removed the duplicate TeddyCam probe from the health build. Homebase now checks the private camera lane once and reuses that result for service cards, evidence, source contracts, and Teddy context.
- Kept the first screen steady on normal days, but when the Now decision is warn/bad the top readiness action now mirrors that priority so Dan sees the most important action first.
- Preserved the current first-screen order and TeddyCam privacy guard instead of adding more visual weight or extra fetches.

### Proof

- `npm run test -- tests/teddy-house.test.js tests/teddy-house-design.test.js`: 110/110 passing.
- `npm run check:homebase`: static lint passed, 181/181 tests passing, Homebase QA `status=ok`, `acceptanceStatus=ok`, truth verdict `Homebase is useful`, first action `Nothing needs Dan.`, 6 screenshots captured.
- Restarted `com.teddy.house-lobsterboard`; live health response times were `3.25s` cold-ish, then `0.01s` and `0.00s` cached.
- Live API reports score `100`, `needsDan=[]`, headline `Dan's house is steady.`, and TeddyCam `ok` with public stream false and stream URLs omitted.

## 2026-06-14 Homebase Cleanup, AdGuard, Ecobee, And Optimizations

### What Changed

- Homebase now keeps the first screen ordered by decision value: status, Mac mini vitals, Now/Watch/Later, Review, Home Stats, House State, Ask Teddy, then evidence.
- `/api/pages/teddy-house/health` has a short live cache outside tests so slow probes do not make every page load wait on the full stack.
- Ask Teddy receives a compact dashboard context instead of the full health payload.
- AdGuard stats now use the Teddy Keychain credential, keep the session cookie in memory, and label auth failures as `Needs login`, `Login failed`, or `Rate limited`.
- Home Stats now prefers Ecobee MCP climate resources, falls back to fresh Homebridge climate sensors, then local weather for outside context.
- Public access copy is deduped on the first screen while structured route evidence remains available in Review/evidence.

### Proof

- `npm run test -- tests/teddy-house.test.js tests/teddy-house-design.test.js`: 102/102 passing.
- `npm run check:homebase`: lint, 171 tests, local route smoke, public auth smoke, phone/iPad/desktop screenshots, visual contracts, source contracts, and QA gates passing.
- `npm run homebase:test-ladder`: latest QA ok; live Teddy bridge proof ok; real-device saved-login proof was later refreshed by the Homebase QA mobile-login smoke.

### Current Limits

- AdGuard config is root-owned. The Teddy Keychain credential exists, but AdGuard still returns `401` for `/control/stats`; adding the real local AdGuard users requires an admin-backed config update and service restart.
- Ecobee MCP is running and authenticated at the MCP layer, but its configured credential file is missing: `/Users/teddyclaw/.config/ecobee-mcp/credentials.json`.
- Homebase now reports these states clearly instead of treating missing stats or climate as fake blanks.

## 2026-06-14 Mobile And Large-Display Proof Repair

### What Changed

- Added structural visual-baseline lanes for `desktop-4k` (`3840x2160@1x`) and `retina` (`1440x1000@2x`).
- Updated Homebase QA so giant monitors still prove ordering, overflow, and story-surface copy without pretending every visible lower evidence section is part of the daily decision surface.
- Captured real Android Chrome proof over USB ADB and saved it as `artifacts/qa/homebase-mobile-proof-latest.json`.
- Tightened mobile proof validation so Android requires a screenshot artifact plus viewport/density metadata.

### Proof

- `npm run check:homebase`: 174/174 tests, five responsive screenshots, visual baseline ok, public auth enforced.
- `npm run homebase:visual-baseline`: `phone`, `ipad`, `desktop`, `desktop-4k`, and `retina` all ok.
- `npm run homebase:mobile-proof`: partial only because `iphone-pwa` and `ipad-pwa` artifacts are still missing; `android-chrome` is proved.
- Android screenshot: `artifacts/qa/mobile/homebase-android-chrome-latest.png`.

### Current Limits

- The older Dan trust gauntlet was partial until real iPhone and iPad saved-login/PWA proof artifacts were captured; the current QA mobile-login smoke now reports those lanes as ok.

## 2026-06-14 Portrait And Landscape Screenshot Proof

### What Changed

- Added an explicit `phone-landscape` visual-baseline lane alongside phone portrait, iPad, desktop, 4K, and Retina.
- The QA screenshot capture now records orientation and reads each PNG header to prove the captured image dimensions match viewport and device scale.
- Added short-screen landscape CSS so Homebase stays compact and readable when a phone is rotated.

### Proof

- `npm run test -- tests/homebase-proof-gates.test.js`: 2/2 passing.
- `npm run lint`: static lint passed.
- `npm run check:homebase`: 174/174 tests, six responsive screenshots, visual contracts ok, acceptance ok.
- `npm run homebase:visual-baseline`: `phone`, `phone-landscape`, `ipad`, `desktop`, `desktop-4k`, and `retina` all ok.
- In-app browser smoke at `http://127.0.0.1:8080/pages/teddy-house/`: loaded Homebase headline, no horizontal overflow, no console warnings/errors.

## 2026-06-14 Ask Teddy To Fix Button

### What Changed

- Added a first-screen `Ask Teddy to Fix` button in the Homebase readiness card.
- The button targets the first ranked review item and sends `action: "prepare-fix"` with `clicked.type: "primary-fix"`.
- The flow is dry-run only: it asks Teddy for a safe fix plan and keeps all service, file, route, and settings mutations behind explicit approval.
- Healthy state shows `Nothing to fix` and disables the button.
- Ask now shows a small progress rail while Teddy is planning: context gathered, Teddy planning, then the approval gate. The rail is honest about fallback/failure and does not imply an automatic repair ran.

### Proof

- `npm run lint`: static lint passed.
- `npm run test -- tests/teddy-house.test.js tests/teddy-house-design.test.js`: 105/105 passing.
- `npm run check:homebase`: 176/176 tests, acceptance ok, six responsive screenshots captured.
- `npm run homebase:visual-baseline`: phone, phone landscape, iPad, desktop, 4K, and Retina all ok.
- In-app browser smoke at `http://127.0.0.1:8080/pages/teddy-house/`: button enabled for the first review item, no horizontal overflow, no console warnings/errors.
- Latest proof after the progress rail: `npm run test -- tests/teddy-house-design.test.js tests/teddy-house.test.js` passed 108/108, and live in-app browser click showed `Planning` mid-flight and `Answered` from `teddy` after completion.

## 2026-06-29 Token Preflight Guard

- Added `npm run token:preflight`, reusing the global OpenClaw Codex cost preflight with `--cwd .`.
- Updated `AGENTS.md` so future Teddy Homebase work starts with compact cost proof before broad/log-heavy inspection.
- Proof: `npm run --silent token:preflight` passed with `sessions=31`, `tokens=13225558`, `localPreflight=yes`, and `warnings=0`.

## 2026-07-17 Nightly Error Repair

- Removed the stale `--runInBand` pass-through from `npm run check:homebase`; current Vitest runs cleanly without it.
- Shortened recurring public-access incident summary copy from `Recurring public access issue.` to `Recurring public access.` so the 4K first-screen copy budget stays under `2700`.
- Proof: `npx vitest run tests/teddy-house.test.js tests/teddy-house-design.test.js` passed 110/110.
- Proof: `npm run homebase:nightly` passed; latest QA `acceptanceStatus=ok`, `publicAuth=enforced`, `visual-baseline=ok`, archive `30/30`, verdict `Homebase needs Dan` with first action `Check public access first.`

## 2026-07-17 Homebase Trust And Exposure Closeout

- Removed the unexpected root `:443` Tailscale Funnel configuration. Public Funnel exposure is now limited to approved BlueBubbles `:8443` and passworded Teddy Homebase `:10000`; the OpenClaw root remains tailnet-only.
- Removed incident capture and mark-known writes from the unauthenticated loopback probe allowlist. Both routes now require a valid dashboard session or trusted-device login plus a matching `Origin` or `Referer` host.
- Updated the Homebase QA mutation smoke to log in explicitly and added local, remote-looking Host, cross-origin, same-origin, authenticated-session, and trusted-device regression coverage.
- Homebase QA now sets a failing process exit code when `acceptanceStatus` is not `ok`, so a failed visual or trust gate cannot leave the release command green.
- Upgraded Rollup, Vitest, coverage, jsdom, terser, and `systeminformation`; aligned the declared Node engine with the toolchain's supported Node 20.19+, 22.12+, and 24+ ranges.
- Proof: full and production-only `npm audit` report zero vulnerabilities; `npm run build` passed; `npm run check:homebase` passed 207 tests and every acceptance/trust gate.
- Fresh live verdict: `Homebase is useful`, readiness `100`, `Nothing needs Dan.`, public auth `enforced`, no failed gates/checks, and 4K first-screen copy `2238/2700`.

## 2026-07-18 AdGuard Credential And Service Copy Repair

- Repointed Homebase's AdGuard stats login to the existing `AdGuardHome` Keychain entry and account instead of the stale Teddy-only credential. No plaintext password was added to files or LaunchAgents.
- Changed the healthy DNS card from the misleading `AdGuard stats are locked` text to `AdGuard admin requires login`; authenticated intelligence still reports live blocked-query stats.
- Fixed a decision-copy bug where an incomplete Homebridge UI version check was falsely labeled as a patch update; the Later slot now requires the explicit `optional UI update` signal.
- Live proof after restart: readiness `100`, `needsDan=[]`, AdGuard DNS `ok`, and AdGuard intelligence `ok` with live query/block totals.
- `npx vitest run tests/teddy-house.test.js`: `106/106` passing, including the incomplete-version regression.
- `npm run check:homebase`: static lint passed, `208/208` tests passed, acceptance `ok`, public auth enforced, six responsive screenshots captured, and truth verdict `Homebase is useful`.

## 2026-07-18 Cold Health Load Guard

- Found a TeddyCam `latest.json` receipt that allowed metadata reads but blocked indefinitely when its contents were opened. A cold Homebase health request therefore never reached Dan's first decision even though every primary house service was healthy.
- Isolated TeddyCam receipt reads in a short-lived helper with a `500 ms` hard kill deadline. An unhealthy camera receipt now becomes degraded, evidence-only context and cannot consume Homebase's filesystem workers or delay the primary service story.
- Live cold-load proof after restart: the full health payload returned in about `4 seconds`, readiness `100`, `needsDan=[]`, Now `Nothing needs Dan.`, live AdGuard blocked-query totals, and Homebridge `ok`.
- Final proof: focused Teddy House tests passed `106/106`; `npm run check:homebase` passed static lint, `208/208` tests, acceptance `ok`, public auth enforced, six responsive screenshots, and truth verdict `Homebase is useful`.

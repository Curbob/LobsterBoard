# Implementation Notes

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
- `npm run homebase:test-ladder`: latest QA ok; live Teddy bridge proof ok; real-device saved-login proof still partial until a fresh device artifact exists.

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

- The Dan trust gauntlet remains `partial` until real iPhone and iPad saved-login/PWA proof artifacts are captured.

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

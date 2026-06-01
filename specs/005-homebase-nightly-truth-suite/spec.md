# Homebase Nightly Truth Suite Spec

## Decision

Make Teddy Homebase prove itself every night as a real house dashboard, not just when Dan asks Codex to inspect it.

The nightly suite should answer one question:

**Can Dan trust the first screen tomorrow morning?**

## User Outcome

Dan should be able to open Homebase on phone, iPad, or Mac and see a calm, ranked answer:

- what happened
- what matters now
- what can wait
- whether Teddy is live or fallback
- whether any source is stale, locked, ignored, or degraded

## Contract

The nightly suite is read-only. It must not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw, or app credentials.

It should run the same trust path Dan uses:

1. Load live local Homebase.
2. Smoke the public Funnel auth boundary.
3. Replay curated warning fixtures.
4. Replay recorded incident bundles.
5. Compare API, rendered page, and Ask Teddy story agreement.
6. Capture phone, iPad, and desktop screenshots.
7. Verify source contracts and freshness labels.
8. Verify login persistence and keep the manual Android/iOS checklist current.
9. Write one plain-English verdict: `Homebase is useful`, `Homebase is lying`, or `Homebase needs Dan`.

## Acceptance Criteria

- The suite has one canonical proof command: `npm run check:homebase`.
- The suite has one operator-facing nightly command: `npm run homebase:nightly`.
- The report is written to `artifacts/qa/homebase-latest.json`.
- The report includes acceptance gates, trust checks, screenshot metadata, rendered replay metadata, source contracts, recorded incident replay, and public auth status.
- A warning state fails if the API, rendered first screen, and Ask Teddy disagree about the first action.
- A healthy state fails if stale, cached, degraded, ignored, raw port, raw IP, or package-count evidence appears as first-screen truth.
- Ask Teddy fails if fallback is hidden or presented as live Teddy.
- Public auth fails if a remote-looking request can read private health or logs without login.
- Source trust fails if a new house-state source lacks owner, freshness, confidence, trusted/ignored status, and first-screen eligibility.
- Visual trust fails if phone, iPad, or desktop layouts overflow or bury the first action below evidence.
- The suite can be scheduled later without new product code.

## Non-Goals

- No automatic repair actions.
- No Homebridge, Tailscale, AdGuard, macOS, or OpenClaw mutations.
- No fake trend generation.
- No trusted door-lock state until a reliable source exists.
- No public unauthenticated shortcuts for easier QA.

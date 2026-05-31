# Homebase Next-Level QA Tasks

## Phase 1: Black-Box Story Agreement

- [x] Add a live local QA helper that compares API health, rendered first viewport, and Ask Teddy using the same context.
- [x] Assert API headline, rendered headline, first zone, and Ask Teddy first action agree for the live local Homebase smoke.
- [x] Extend story-agreement assertions to replayed health states.
- [x] Assert replayed first review item, first zone, and Ask Teddy first action agree.
- [x] Assert Teddy fallback copy is visibly labeled when the live bridge is unavailable.
- [x] Save a compact story-agreement report in `artifacts/qa/homebase-latest.json`.

## Phase 2: Recorded Incident Bundles

- [x] Define the redacted incident bundle schema.
- [x] Add a WindowServer/system restart bundle.
- [x] Add a Govee/Homebridge noisy loop bundle.
- [x] Add a Teddy bridge fallback bundle.
- [x] Add a public access drift bundle.
- [x] Assert each bundle has source paths, timestamps, expected top story, and expected action.

## Phase 3: Parser Golden Fixtures

- [x] Add Homebridge log fixtures that distinguish dated entries from stack continuations.
- [x] Add Govee grouping fixtures.
- [x] Add Eufy ignored/degraded fixtures.
- [x] Add macOS diagnostic freshness fixtures.
- [x] Add Tailscale route drift fixtures.
- [x] Add AdGuard locked/live fixtures.

## Phase 4: Visual Contract Tests

- [x] Add DOM-level first-viewport assertions for phone, iPad, and desktop.
- [ ] Assert warning state shows Status, Now/Watch/Later, Review, affected zone, Vitals, Ask, Evidence.
- [x] Assert healthy state stays quiet and free of raw telemetry.
- [x] Assert no duplicated recent-change rows appear in rendered QA.
- [x] Keep screenshots as proof artifacts.

## Phase 5: Login Persistence Smoke

- [x] Add local browser-context cached-login smoke.
- [ ] Document Android Chrome manual smoke.
- [ ] Document iPhone/iPad PWA manual smoke.
- [x] Assert public auth still protects direct API access.

## Phase 6: Source Contract

- [x] Add a source contract checklist template.
- [x] Require every new home-state source to state trusted/degraded/ignored/needs-login status.
- [x] Require every new source to state first-screen eligibility.
- [x] Add a lint or QA assertion that unknown source states cannot render as trusted house state.

# Homebase Next-Level QA Tasks

## Phase 1: Black-Box Story Agreement

- [x] Add a live local QA helper that compares API health, rendered first viewport, and Ask Teddy using the same context.
- [x] Assert API headline, rendered headline, first zone, and Ask Teddy first action agree for the live local Homebase smoke.
- [x] Extend story-agreement assertions to replayed health states.
- [x] Assert replayed first review item, first zone, and Ask Teddy first action agree.
- [ ] Assert Teddy fallback copy is visibly labeled when the live bridge is unavailable.
- [x] Save a compact story-agreement report in `artifacts/qa/homebase-latest.json`.

## Phase 2: Recorded Incident Bundles

- [x] Define the redacted incident bundle schema.
- [x] Add a WindowServer/system restart bundle.
- [x] Add a Govee/Homebridge noisy loop bundle.
- [ ] Add a Teddy bridge fallback bundle.
- [ ] Add a public access drift bundle.
- [x] Assert each bundle has source paths, timestamps, expected top story, and expected action.

## Phase 3: Parser Golden Fixtures

- [ ] Add Homebridge log fixtures that distinguish dated entries from stack continuations.
- [ ] Add Govee grouping fixtures.
- [ ] Add Eufy ignored/degraded fixtures.
- [ ] Add macOS diagnostic freshness fixtures.
- [ ] Add Tailscale route drift fixtures.
- [ ] Add AdGuard locked/live fixtures.

## Phase 4: Visual Contract Tests

- [ ] Add DOM-level first-viewport assertions for phone, iPad, and desktop.
- [ ] Assert warning state shows Status, Now/Watch/Later, Review, affected zone, Vitals, Ask, Evidence.
- [ ] Assert healthy state shows Status, Review clear, House State, Vitals, Ask, Evidence.
- [ ] Assert no duplicated recent-change rows appear in rendered QA.
- [ ] Keep screenshots as proof artifacts.

## Phase 5: Login Persistence Smoke

- [ ] Add local browser-context cached-login smoke.
- [ ] Document Android Chrome manual smoke.
- [ ] Document iPhone/iPad PWA manual smoke.
- [ ] Assert public auth still protects direct API access.

## Phase 6: Source Contract

- [ ] Add a source contract checklist template.
- [ ] Require every new home-state source to state trusted/degraded/ignored/needs-login status.
- [ ] Require every new source to state first-screen eligibility.
- [ ] Add a lint or QA assertion that unknown source states cannot render as trusted house state.

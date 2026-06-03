# Homebase Visual Baseline Spec

## Decision

Add a structural visual baseline for Teddy Homebase.

This is not pixel-perfect museum testing. The baseline protects the parts that make the dashboard useful:

- the first story is visible
- the first action is visible
- the affected house zone is marked
- healthy evidence stays quiet
- warning evidence stays below the decision surface
- no horizontal overflow on phone, iPad, or desktop
- first-viewport copy stays within a budget
- raw telemetry stays out of the daily surface

## User Outcome

Dan can keep iterating fast without the dashboard quietly getting ugly or noisy again.

## Acceptance Criteria

- `npm run homebase:visual-baseline` reads `artifacts/qa/homebase-latest.json`.
- The baseline uses `tests/fixtures/teddy-house/visual-baseline.json`.
- Phone, iPad, and desktop viewports must all be present.
- The command fails on overflow, missing first story, missing first action, failed visual contracts, or first-screen copy over budget.
- The baseline is structural and tolerant of changing live house state.

## Non-Goals

- No pixel-perfect screenshots.
- No fake screenshots.
- No mutation of Homebase or house services.

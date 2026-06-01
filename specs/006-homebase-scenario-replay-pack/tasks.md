# Homebase Scenario Replay Pack Tasks

## Phase 1: Spec And Coverage

- [x] Define the eight canonical curated scenarios.
- [x] Define the API, rendered page, and Ask Teddy agreement contract.
- [x] Define recorded incident bundle requirements.
- [x] Add QA coverage that fails if the scenario replay pack spec drifts.

## Phase 2: Current Harness

- [x] Verify curated fixtures replay through `npm run check:homebase`.
- [x] Verify rendered replay screenshots are captured for warning fixtures.
- [x] Verify recorded incident bundles replay through story agreement.
- [x] Verify healthy first-screen copy blocks raw telemetry and stale source language.

## Phase 3: Next Hardening

- [ ] Add a power outage or post-reboot recovery replay when real evidence exists.
- [x] Add a Homebridge-down replay for the Mac-healthy automation outage case.
- [x] Add an AdGuard-DNS-down replay for local DNS failure while WAN is otherwise normal.
- [ ] Add a Tailscale-Funnel-missing replay when real evidence exists.
- [ ] Add stale Android proof-node replay that confirms it stays evidence-only.

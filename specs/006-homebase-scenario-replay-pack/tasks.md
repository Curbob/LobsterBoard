# Homebase Scenario Replay Pack Tasks

## Phase 1: Spec And Coverage

- [x] Define the fifteen canonical curated scenarios.
- [x] Define the API, rendered page, and Ask Teddy agreement contract.
- [x] Define recorded incident bundle requirements.
- [x] Add QA coverage that fails if the scenario replay pack spec drifts.

## Phase 2: Current Harness

- [x] Verify curated fixtures replay through `npm run check:homebase`.
- [x] Verify rendered replay screenshots are captured for warning fixtures.
- [x] Verify recorded incident bundles replay through story agreement.
- [x] Verify healthy first-screen copy blocks raw telemetry and stale source language.

## Phase 3: Next Hardening

- [x] Add a post-reboot recovery replay that confirms low uptime alone stays calm.
- [x] Add a post-outage Homebridge-down replay when automations are still down after recovery.
- [x] Add a post-outage DNS-down replay when local DNS is still down after recovery.
- [x] Add a post-outage public-access replay when Funnel is still down after recovery.
- [x] Add a post-outage Tailscale-node-offline replay when the Mac mini drops from Tailscale after recovery.
- [ ] Add a post-outage OpenClaw-bridge-degraded replay when the dashboard is up but Ask Teddy is degraded after recovery.
- [x] Add a Homebridge-down replay for the Mac-healthy automation outage case.
- [x] Add an AdGuard-DNS-down replay for local DNS failure while WAN is otherwise normal.
- [x] Add a Tailscale-Funnel-missing replay for tailnet-online but public-route-missing state.
- [x] Add stale Android proof-node replay that confirms it stays evidence-only.

# Homebase Scenario Replay Pack Plan

## Phase 1: Canonical Stories

Keep the curated pack small and high-signal:

- `healthy`: Dan should see a quiet morning.
- `stale-android-proof`: Dan should not see stale phone/proof-node evidence as trusted house state.
- `post-reboot-recovered`: Dan should not see a scary restart story when uptime is low but services and system logs are healthy.
- `post-outage-homebridge-down`: Dan should check Homebridge first when the Mac mini is back but automations are still down.
- `post-outage-dns-down`: Dan should check DNS first when the Mac mini is back but local DNS is still down.
- `post-outage-funnel-missing`: Dan should check public access first when the Mac mini is back but the Homebase public route is still missing.
- `post-outage-tailscale-offline`: Dan should check Tailscale first when the Mac mini is back locally but missing from the tailnet.
- `post-outage-openclaw-bridge-degraded`: Dan should check OpenClaw first when Homebase is up but Ask Teddy is degraded after recovery.
- `post-outage-macos-update-required`: Dan should review macOS maintenance first when a critical update remains after recovery.
- `post-outage-system-logs-warning`: Dan should review system logs when generic log warnings remain after recovery without panic evidence.
- `post-outage-resource-pressure`: Dan should check Mac mini load first when CPU or memory remains elevated after recovery.
- `post-outage-adguard-stats-unavailable`: Dan should see a steady house when DNS works but AdGuard blocker stats need login.
- `post-outage-homebridge-ui-patch`: Dan should see a steady house with the Homebridge UI patch parked in Later maintenance.
- `post-outage-optional-app-update`: Dan should see a steady house with optional app updates parked in Later maintenance.
- `homebridge-down`: Dan should check Homebridge first while Mac, internet, and public access stay scoped correctly.
- `adguard-dns-down`: Dan should check DNS first while WAN quality remains scoped separately.
- `tailscale-funnel-missing`: Dan should see public access first when the tailnet is online but the expected Funnel route is missing.
- `mac-panic`: Dan should see the Mac restart first.
- `govee-loop`: Dan should see one automation issue, not raw log spam.
- `public-exposure-drift`: Dan should see public access first when routes drift.
- `wan-dns-degraded`: Dan should see internet quality first.
- `teddy-bridge-fallback`: Dan should see the Teddy bridge issue honestly.

## Phase 2: Agreement Contract

For every scenario, compare:

- API-derived `houseState`
- rendered first viewport
- Ask Teddy dashboard summary

The first action must match across all three.

## Phase 3: Visual Contract

Rendered replay screenshots must prove:

- top story visible
- Review lane visible when warning exists
- affected zone before evidence
- vitals before deep evidence in incident states
- no horizontal overflow
- raw telemetry out of the healthy first screen

## Phase 4: Recorded Incidents

Recorded incident bundles turn real bad days into regression tests.

Required bundle shape:

- redacted source snapshots
- redacted log excerpts
- expected story fields
- fixture pointer

Start with the existing WindowServer restart, public access drift, Govee loop, and Teddy bridge fallback bundles.

## Phase 5: Next Additions

Add a new replay scenario only when it changes Dan's first decision:

- post-outage macOS optional update after recovery

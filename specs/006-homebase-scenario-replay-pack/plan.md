# Homebase Scenario Replay Pack Plan

## Phase 1: Canonical Stories

Keep the curated pack small and high-signal:

- `healthy`: Dan should see a quiet morning.
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

- power outage or post-reboot service recovery
- Homebridge down but Mac healthy
- AdGuard DNS down
- Tailscale up but Funnel route missing
- stale Android proof node that should stay out of trusted truth

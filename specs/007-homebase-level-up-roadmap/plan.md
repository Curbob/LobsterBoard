# Homebase Level-Up Roadmap Plan

## Phase 1: Incident Ledger

Add a derived incident layer above raw signals.

Inputs:

- `needsDan`
- `houseState.zones`
- service-log issues
- system diagnostics
- public access state
- WAN quality
- Ask bridge status
- persisted timeline and visual evidence

Outputs:

- `incidents.active`
- `incidents.known`
- `incidents.resolved`
- `incidents.primary`
- lifecycle metadata: first seen, last seen, source, confidence, status

Proof:

- fixtures for new, recurring, resolved, and stale incidents
- recorded incidents replay through the ledger
- no ignored/degraded source can create a trusted active incident

## Phase 2: Story Engine

Refactor first-screen derivation around one primary story.

The story engine owns:

- headline
- summary
- daily decision slots
- first review item
- affected zone ordering
- Ask Teddy prompt payload

Proof:

- story contract tests for every curated scenario
- rendered replay tests for phone width
- screenshot QA freezes one payload across phone, iPad, and desktop

## Phase 3: Action Readiness

Add safe actions for incidents.

Actions:

- explain issue
- prepare fix dry-run
- open relevant logs
- capture redacted incident
- mark recurring/known

Rules:

- actions are read-only by default
- dry-runs name the exact command or service area only when known
- mutation requires explicit Dan approval outside the dashboard action

Proof:

- action safety tests
- no-mutation assertions
- Ask fallback/live labeling tests

## Phase 4: Evidence Viz

Make evidence support the story instead of competing with it.

Changes:

- move the active affected zone and Mac vitals above generic evidence
- show an incident ribbon only when an active incident exists
- collapse healthy evidence by default
- group repeated timeline entries
- display sparklines only from persisted samples

Proof:

- screenshot visual contracts
- first-screen raw telemetry blacklist
- timeline grouping tests
- no fake trend tests

## Phase 5: Daily Owner Mode

Tune copy and ordering for Dan's daily use.

Rules:

- write in house language
- one primary action
- useful source labels only
- short healthy state
- no cute filler

Proof:

- copy contract tests
- rendered first-screen text-length budget
- phone/iPad/desktop screenshots
- manual live smoke from the public Tailscale URL

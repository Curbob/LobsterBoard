# Homebase Level-Up Roadmap Spec

## Decision

Take Teddy Homebase from a trusted status page to Dan's real daily home cockpit.

The next level is not more cards. The next level is a tighter operating loop:

- notice the right house signal
- rank it against everything else
- explain why it matters
- show the safest next action
- remember whether the issue returned

## User Outcome

Dan opens Homebase on his phone and gets a useful house read in one glance:

- what is happening now
- whether it is new, recurring, or already known
- what Teddy would check first
- what can safely wait
- whether the page is using live, cached, degraded, ignored, or login-gated data

Healthy days should feel quiet. Weird days should feel specific.

## Current Proof

Already proven by the current Homebase QA stack:

- `npm run check:homebase` runs lint, unit tests, replay stories, local route smokes, Ask checks, auth checks, screenshot QA, source contracts, and copy gates.
- Twenty-three curated house-state stories replay through API, rendered page, and Ask agreement.
- Recorded incidents replay for Govee/Homebridge loops, public route drift, Teddy bridge fallback, and WindowServer restart.
- Phone, iPad, and desktop screenshot QA now freeze one health payload so layout proof is not confused with changing live probes.
- Eufy/door-lock state is ignored as trusted house truth.
- Public Homebase stays passworded; local loopback routes stay protected by the loopback probe boundary.

## Next-Level Product Bets

### 1. Incident Ledger

Turn repeated warnings into named incidents with lifecycle:

- first seen
- last seen
- current status
- source evidence
- confidence
- Dan-facing next action
- whether it is new, recurring, or resolved

Examples:

- `Govee connection degraded`
- `Mac restart incident`
- `Public route drift`
- `Teddy bridge fallback`
- `WAN quality degraded`

### 2. House Story Engine

Make the first screen derive one ranked story from the incident ledger and current probes.

The story engine should choose:

- headline
- one-sentence summary
- `Now / Watch / Later`
- first review item
- affected zone
- Ask Teddy prompt context

This should be data-backed, deterministic, and fixture-tested.

### 3. Action Readiness

Add safe action paths without automatic mutation:

- `Explain`
- `Prepare fix`
- `Open logs`
- `Mark known`
- `Capture incident`

Every action that could change Homebridge, Tailscale, AdGuard, macOS, OpenClaw, credentials, or routes must stop at a dry-run and require Dan approval.

### 4. Better Evidence Viz

Replace noisy evidence cards with calmer proof surfaces:

- incident ribbon for the active issue
- compact current vitals with reboot-scoped peaks
- grouped timeline with repeated events collapsed
- source badges only when they change trust
- sparklines only for persisted samples with freshness metadata

No fake trends. No chart without stored data.

### 5. Personal Daily Mode

Make the copy sound like Dan's house, not a generic dashboard:

- `Dan's house is steady.`
- `Check automations first.`
- `Public routes are expected.`
- `Teddy bridge fell back locally.`
- `Homebridge log below action threshold.`

The page should be plain, calm, and specific.

## Acceptance Criteria

- Active incidents outrank raw service noise.
- The first screen never shows more than one primary story.
- Known recurring issues are labeled as recurring, not rediscovered every refresh.
- Resolved incidents move out of `Now` without disappearing from evidence.
- Ask Teddy receives the same first story as the page and labels live/fallback honestly.
- Every visible first-screen signal has a source contract and freshness/confidence state.
- Phone, iPad, and desktop screenshots agree on the same frozen story in QA.
- Healthy first screen stays short and hides raw ports, IPs, versions, package counts, log counts, and ignored sources.
- No action path performs mutations without explicit approval.

## Non-Goals

- No fake rooms, fake device state, or fake trends.
- No trusted lock state from Eufy until the source is proven reliable.
- No public unauthenticated data route.
- No automatic Homebridge/Tailscale/AdGuard/macOS/OpenClaw repairs.
- No generic LobsterBoard redesign.

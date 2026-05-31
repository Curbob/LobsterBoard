# Homebase Next-Level QA Plan

## Phase 1: Black-Box Story Agreement

Add an end-to-end story assertion that compares three views of the same health state:

- API: `/api/pages/teddy-house/health`
- Rendered page: first viewport and review lane
- Ask Teddy: `/api/pages/teddy-house/ask`

For each replay, assert:

- headline agrees with `houseState.headline`
- first review item matches the first warned zone
- Ask Teddy names the same first action
- fallback Ask responses are labeled as fallback, never as live Teddy

## Phase 2: Recorded Incident Bundles

Add a redacted incident bundle format under test fixtures.

Each bundle should include:

- source snapshots from persisted JSON
- relevant redacted log excerpts
- expected top story
- expected zone order
- expected `Now / Watch / Later`
- expected evidence labels

Start with:

- WindowServer/system restart incident
- Govee/Homebridge noisy loop
- Teddy bridge fallback
- public access drift

## Phase 3: Parser Golden Fixtures

Give every scary parser a fixture suite.

Required parser fixtures:

- Homebridge dated top-level entries versus stack trace continuations
- Govee connection loops grouped as one issue
- Eufy lock/plugin noise kept ignored or degraded
- macOS panic/watchdog diagnostics promoted only when current
- Tailscale Serve/Funnel route changes
- AdGuard stats locked versus live

## Phase 4: Visual Contract Tests

Keep screenshot capture, but add structured visual expectations.

Phone, iPad, and desktop first viewport should prove:

- top story visible
- review lane visible when warning exists
- no raw telemetry in the healthy top screen
- local links below the health story
- Mac vitals above evidence when they explain the story
- no duplicated recent-change rows

The test should read DOM structure first and use screenshots as proof artifacts.

## Phase 5: Login Persistence Smoke

Add a documented harness for cached-login behavior.

Automated local proof:

- login once in browser context
- reload protected page
- assert dashboard appears without password prompt
- clear session only inside test context

Manual device proof:

- Android Chrome
- iPhone/iPad PWA
- public Funnel URL
- expected result: saved credentials or persistent session, no surprise password typing

## Phase 6: Source Contract For New Data

Before any new source appears on the dashboard, it must declare:

- source owner
- freshness window
- confidence
- trusted, degraded, ignored, or needs-login status
- whether it can appear in house state
- whether it can appear only in evidence
- what makes it actionable

This prevents a new source from becoming pretty noise.

## Recommended First Slice

Build Phase 1 first.

Reason: if the API, page, and Ask Teddy disagree about the first action, the dashboard is not trustworthy no matter how good the individual tests look.

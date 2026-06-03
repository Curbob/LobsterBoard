# Homebase Dan Trust Gauntlet Spec

## Decision

Create one read-only command that answers whether Teddy Homebase is trustworthy as Dan's real house dashboard.

The gauntlet combines latest Homebase QA, public auth, first-screen story proof, visual baseline proof, parser/source checks, live Teddy bridge proof, and real-device saved-login proof. Missing live or mobile proof reports `partial`, not `ok`.

## User Outcome

Dan gets one verdict:

- `ok`: Homebase is proved across QA, live Teddy, and real devices.
- `partial`: core Homebase QA is trustworthy, but real-world proof is still missing.
- `fail`: a trust-breaking gate failed.

## Acceptance Criteria

- `npm run homebase:dan-trust-gauntlet` reads `artifacts/qa/homebase-latest.json`.
- The command requires QA status, acceptance status, public auth, story agreement, visual contracts, visual baseline, source contracts, parser fixtures, copy quality, and truth verdict.
- The command imports the durable live Teddy and mobile proof validators.
- Missing live Teddy or real-device proof reports `partial`.
- `HOMEBASE_REQUIRE_DAN_TRUST_GAUNTLET=1 npm run homebase:dan-trust-gauntlet` fails unless everything is `ok`.
- The test ladder uses the gauntlet to report the `Dan trust gauntlet` row.

## Non-Goals

- No service restarts.
- No Tailscale, Homebridge, AdGuard, OpenClaw, macOS, route, or credential mutation.
- No fake mobile proof.
- No pretending local Ask is live Teddy.

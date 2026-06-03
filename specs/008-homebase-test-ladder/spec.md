# Homebase Test Ladder Spec

## Decision

Track Homebase quality by the tests that most protect Dan's trust.

The ladder separates:

- `Need`: tests that catch daily trust failures.
- `Want`: tests that catch polish, routing, parser, and visual regressions.
- `Dream`: the larger gauntlet that proves Homebase across many messy house states and real devices.

## User Outcome

Dan can ask what tests Homebase still needs and get a current answer backed by the latest QA report, not a stale chat opinion.

## Acceptance Criteria

- `npm run homebase:test-ladder` reads `artifacts/qa/homebase-latest.json` when present.
- The output names the latest QA status and public-auth state.
- The ladder includes live Teddy bridge proof, real-device saved login, incident ranking, first-screen copy, source trust, structural visual baselines, timeline grouping, action safety, public auth, log parser fixtures, and the Dan trust gauntlet.
- Partial coverage is labeled as partial, not passed.
- Missing live Teddy bridge proof does not fail the release gate when Homebase is in default-local Ask mode, but it stays visible.
- If the live bridge is explicitly enabled and the latest Ask source is not `teddy`, the ladder labels that as a gap.

## Non-Goals

- No fake device proof.
- No mutation of Homebridge, Tailscale, AdGuard, OpenClaw, macOS, or credentials.
- No replacement for `npm run check:homebase`.

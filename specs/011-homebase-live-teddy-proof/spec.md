# Homebase Live Teddy Proof Spec

## Decision

Make live Ask Teddy proof explicit, opt-in, and durable.

Default Homebase can answer quickly from local dashboard context. That is useful, but it is not proof that the OpenClaw Teddy bridge answered. Live bridge proof only passes when a captured artifact shows `source: "teddy"` from an enabled Ask run.

## User Outcome

Dan can tell the difference between fast local Ask, honest fallback, and a real Teddy bridge answer.

## Acceptance Criteria

- `npm run homebase:live-teddy-proof` reads `artifacts/qa/homebase-live-teddy-proof-latest.json`.
- Missing proof reports `partial`, not `ok`.
- `HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof` runs an opt-in read-only local Ask smoke with `TEDDY_HOMEBASE_ASK_AGENT=1`.
- `HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof` fails unless proof is valid.
- Valid proof must include the approved public Homebase URL, `agentMode: "enabled"`, `status: "complete"`, `source: "teddy"`, a first action, and an answer that stays inside Homebase scope.
- The test ladder can use the proof artifact to move `Live Teddy bridge contract` from `partial` to `ok`.

## Non-Goals

- No default live agent dependency for normal Homebase QA.
- No service restart, route change, credential change, or write action.
- No pretending `local` or `local-fallback` answers are live Teddy.

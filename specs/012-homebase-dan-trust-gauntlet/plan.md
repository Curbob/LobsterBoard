# Homebase Dan Trust Gauntlet Plan

## Inputs

- Latest QA report: `artifacts/qa/homebase-latest.json`
- Live Teddy proof: `artifacts/qa/homebase-live-teddy-proof-latest.json`
- Real-device proof: `artifacts/qa/homebase-mobile-proof-latest.json`

## Verdict Rules

- `fail`: latest QA is missing, public auth is not enforced, Homebase says it is lying, or any required trust gate is not `ok`.
- `partial`: QA is trustworthy but live Teddy or real-device proof is missing.
- `ok`: QA, live Teddy proof, and real-device proof all pass.

## Required QA Gates

- `replay-contracts`
- `story-agreement`
- `visual-contracts`
- `visual-baseline`
- `public-auth`
- `loopback-probe-boundary`
- `source-contracts`
- `parser-golden-fixtures`
- `copy-quality-coverage`
- `truth-verdict`

## Strict Mode

Use `HOMEBASE_REQUIRE_DAN_TRUST_GAUNTLET=1` when the command should fail on `partial`.

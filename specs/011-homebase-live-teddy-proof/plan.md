# Homebase Live Teddy Proof Plan

## Data Source

Latest durable proof:

`artifacts/qa/homebase-live-teddy-proof-latest.json`

The proof file is generated only by an explicit run:

`HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof`

## Freshness

Proof older than 14 days is partial by default. The limit can be changed with `HOMEBASE_LIVE_TEDDY_PROOF_MAX_AGE_DAYS`.

## Route And Auth

The opt-in smoke starts a temporary loopback Homebase server and uses the same `/api/pages/teddy-house/health` and `/api/pages/teddy-house/ask` routes as the page. Public auth remains tested separately by the Homebase QA harness.

## Trust Rules

- `source: "teddy"` is required.
- `local` is useful but not live proof.
- `local-fallback` is useful fallback honesty but not live proof.
- The answer must mention the current first action and must not escape Homebase scope.

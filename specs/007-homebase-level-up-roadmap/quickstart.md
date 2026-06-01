# Quickstart

## Read The Current Plan

```bash
sed -n '1,220p' specs/007-homebase-level-up-roadmap/spec.md
sed -n '1,220p' specs/007-homebase-level-up-roadmap/plan.md
sed -n '1,220p' specs/007-homebase-level-up-roadmap/tasks.md
```

## Run The Current Proof Gate

```bash
npm run check:homebase
```

Expected proof:

- lint passes
- unit tests pass
- 23 curated house stories replay
- recorded incidents replay
- Ask Teddy live/fallback behavior is labeled
- local routes smoke
- public auth smoke passes when reachable
- phone, iPad, and desktop screenshots are captured from one frozen health payload

## Review The Latest QA Report

```bash
sed -n '1,220p' artifacts/qa/homebase-latest.json
```

Key fields:

- `truthVerdict`
- `acceptanceGates`
- `local.storyAgreement`
- `local.screenshots.outputs`
- `sourceContracts`

## First Implementation Slice

Start with the incident ledger.

Do not add new widgets first. Add the model that decides whether a warning is new, recurring, resolved, ignored, or trusted. Then update the story engine and UI to use it.

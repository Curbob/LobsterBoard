# Homebase Visual Baseline Plan

## Source

- Latest QA report: `artifacts/qa/homebase-latest.json`
- Structural baseline: `tests/fixtures/teddy-house/visual-baseline.json`

## Checks

- viewport dimensions
- horizontal overflow
- first-screen copy budget
- required rendered fields
- visual contract booleans

## Release Gate

`npm run check:homebase` includes `visual-baseline` as an acceptance gate after screenshots are captured.

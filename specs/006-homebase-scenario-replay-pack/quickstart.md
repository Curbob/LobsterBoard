# Homebase Scenario Replay Pack Quickstart

Run the full replay pack:

```zsh
cd /Users/teddyclaw/teddy-house-lobsterboard
npm run check:homebase
```

Read the latest proof:

```zsh
node scripts/homebase-verdict.mjs
```

The QA report is written to:

```text
artifacts/qa/homebase-latest.json
```

Useful fields:

- `fixtureContracts`
- `replayStoryAgreementCoverage`
- `recordedIncidentReplay`
- `renderedReplayVisualCoverage`
- `truthVerdict`

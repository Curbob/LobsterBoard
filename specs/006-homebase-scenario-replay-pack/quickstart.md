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

Capture a new bad-day draft when Dan flags the live dashboard:

```zsh
npm run homebase:capture-incident -- --title "Govee loop still leading"
```

The draft is written under:

```text
data/teddy-house/qa/incident-drafts/
```

Review the draft, pick or create the replay fixture it should point to, then move the redacted bundle into `tests/fixtures/teddy-house/incidents/` when it should become permanent regression coverage.

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

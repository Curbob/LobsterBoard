# Homebase Test Ladder Plan

## Data Source

Use the latest Homebase QA report:

- `artifacts/qa/homebase-latest.json`
- `acceptanceGates`
- `trustChecks`
- `local.ask.source`
- `local.ask.agentMode`
- `local.screenshots.outputs`
- `truthVerdict`
- `publicAuth`

## Ladder Rules

- `ok`: the latest QA report has a direct passing gate.
- `partial`: the automated harness proves part of the behavior, but real-device, opt-in live-bridge, or visual-baseline proof is still missing.
- `gap`: the latest QA report does not prove the behavior.

## Output

The command prints three short sections:

- Need
- Want
- Dream

Each line includes status, test name, and why it matters.

## Safety

The command is read-only. It reads the latest QA artifact and project files only.

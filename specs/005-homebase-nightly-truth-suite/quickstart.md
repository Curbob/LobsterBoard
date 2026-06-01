# Homebase Nightly Truth Suite Quickstart

## Run

```zsh
cd /Users/teddyclaw/teddy-house-lobsterboard
npm run homebase:nightly
```

For a faster read after the latest suite already ran:

```zsh
npm run homebase:verdict
```

## Inspect

```zsh
open artifacts/qa/homebase-latest.json
open artifacts/qa/homebase-latest-phone.png
open artifacts/qa/homebase-latest-ipad.png
open artifacts/qa/homebase-latest-desktop.png
```

## Expected Result

- `acceptanceStatus` is `ok`.
- `truthVerdict.label` is `Homebase is useful`, `Homebase is lying`, or `Homebase needs Dan`.
- `npm run homebase:nightly` runs the proof suite and then prints the verdict.
- `npm run homebase:verdict` prints the same label, summary, first action, acceptance status, and public-auth state.
- `publicAuth` is `enforced` or explicitly skipped because the public route is unreachable from the test environment.
- `trustChecks` includes source contracts, login persistence, story agreement, fallback visibility, and visual contracts.
- Screenshots exist for phone, iPad, and desktop.
- Recorded incident replay includes WindowServer restart, Govee/Homebridge noise, Teddy bridge fallback, and public access drift.

## When It Fails

- If story agreement fails, fix ranking/copy before adding data.
- If auth fails, treat it as urgent.
- If source trust fails, decide whether the source is trusted, degraded, ignored, or needs login.
- If screenshots overflow, fix the UI before shipping.
- If Ask Teddy fallback is hidden, fix the label before trusting the answer.

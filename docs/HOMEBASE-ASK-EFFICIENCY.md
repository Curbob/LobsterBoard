# Homebase Ask Efficiency Contract

Updated: 2026-07-25

## Objective

Keep routine Homebase answers deterministic and reserve Hermes for questions
that require model judgment. A healthy status request must not spend model
tokens.

## Budgets

- Routine `status` and `summarize`: zero model calls and zero model tokens.
- Hermes-backed request p95: no more than 2,000 total tokens.
- Hermes-backed request p95 latency: no more than 8 seconds.
- Status live-proof: one model call, zero tool calls.
- Output: three to five short bullets and no unrelated personal context.

The baseline captured before this hardening pass was 7,695 total tokens:
7,563 input and 132 output for one healthy status answer.

## Runtime Contract

- Homebase sends a compact dashboard exception summary, not the full health
  payload.
- `hermes chat` runs with `--ignore-rules`, source `homebase`, one turn, and
  the zero-tool `codex-supervised-none` toolset. The dashboard payload is the
  only request context.
- The opt-in live proof may force the Hermes lane. Normal browser requests
  cannot force a paid model call.
- `data/teddy-house/ask-metrics.json` retains at most 200 privacy-light
  metrics. It stores no prompt, answer, raw context, credential, or personal
  text.

## Proof

```bash
npm run check
npm run homebase:ask-budget
HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof
npm run check:homebase
scripts/check-homebase-runtime.zsh
```

The live proof must capture Hermes usage and remain within budget. The standard
release gate remains valid without making a paid model call.

## Rollback

Set `TEDDY_HOMEBASE_ASK_AGENT=0` and
`TEDDY_HOMEBASE_ASK_LOCAL_ONLY=1` for deterministic recovery. Restore the
latest LaunchAgent backup with:

```bash
scripts/install-homebase-launchagent.zsh --restore-latest
```

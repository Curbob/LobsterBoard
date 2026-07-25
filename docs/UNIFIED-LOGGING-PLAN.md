# Teddy Homebase Unified Logging Plan

Last updated: 2026-05-18

## Goal

Homebase should tell Dan what matters without turning the daily dashboard into a log wall. The right shape is a two-layer system:

- Main dashboard: one ranked signal that says whether service logs are quiet or need review.
- Hidden detail view: grouped, redacted evidence at `/pages/teddy-house/logs/`.

## Codex Take

Normalize every source into one small contract: `state`, `value`, `source`, `confidence`, `detail`, and redacted examples. Rank the sources by actionability. Never promote noise into the Review lane unless it is current, counted, and above threshold.

## Teddy Take

Daily Homebase should feel calm. Logs are the basement light: easy to switch on when something is weird, invisible when the house is fine.

Teddy's live read on 2026-05-17:

- Daily view should surface warn/error conditions, restart loops, failed health checks, and unexpected state changes.
- Debug/info detail belongs in the hidden logs view, not the daily cockpit.
- One aggregation point is better than six separate noisy widgets.
- Before changing service log levels, confirm which services should be tuned versus only classified by Homebase.

## Architecture

1. Collect local evidence from Homebase, Homebridge, Eufy plugin, Hermes, AdGuard, and Tailscale.
2. Redact emails, tokens, passwords, pairing codes, QR payloads, ANSI noise, and obvious setup-code patterns.
3. Classify each source as `ok`, `info`, `warn`, or `bad` with service-specific recent windows and thresholds.
4. Store the latest normalized snapshot at `data/teddy-house/service-logs.json`.
5. Surface one compact Service logs card on the daily dashboard.
6. Keep grouped examples and source paths in the hidden logs view.
7. Escalate only when a counted source crosses warn or bad thresholds.

## Current Sources

- Homebase launch logs
- Homebridge logs
- Eufy plugin logs, ignored for daily lock confidence
- Hermes gateway and watchdog logs
- AdGuard stdout and stderr logs
- Tailscale status health

## Next Hardening

- Add per-source history so Homebase can show real log drift without fake graphs.
- Add named suppression rules with expiration dates for known noisy devices.
- Add source-level Ask Teddy actions once the local agent bridge is stable.
- Add a durable log analyzer runbook under Hermes docs if this view becomes an operator workflow.

## SDLC Guardrails

- Do not promote repeated identical log findings into multiple timeline rows. Group them and show a count.
- Do not add graph-like UI unless the data is persisted and the source is visible.
- Keep noisy sources out of the Review lane unless they cross a clear warn or bad threshold.
- Keep Eufy plugin evidence visible only as degraded/ignored evidence until lock truth is reliable.

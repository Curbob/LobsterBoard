# AGENTS.md

This repo is LobsterBoard plus Dan's private Teddy Homebase layer. Treat it like a local production surface on the Mac mini, not a disposable demo.

## Commands

```bash
npm run lint
npm test
npm run check -- --runInBand
npm run check:homebase
```

Use `npm run check:homebase` as the preferred Homebase release gate. It includes lint/tests, replay fixtures, local Homebase route smokes, first-screen copy blacklist checks, rendered first-screen assertions, phone/iPad/desktop screenshot capture, persisted evidence retention checks, and public Funnel auth smoke when reachable.

Live local proof:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

After server-code or page-route changes, restart the LaunchAgent before live proof:

```bash
launchctl kickstart -k gui/$(id -u)/com.teddy.house-lobsterboard
```

## Product Contract

- Teddy Homebase is the quiet Mac mini and home-stack cockpit.
- The first screen should answer: is the house stack steady, what needs review, and what changed?
- Keep the daily screen ranked and calm. Do not add widgets unless they improve Dan's first decision.
- Keep Focus Room, Claude Usage, Teddy Weather, and other adjacent pages out of Homebase unless Dan explicitly promotes them.
- Use real probes, logs, histories, and evidence. No fake charts, fake trends, decorative metrics, or invented room/device state.
- Eufy lock data is unreliable and must stay ignored/hidden on the daily dashboard until a trusted lock source replaces it.

## Homebase Surfaces

- Daily page: `/pages/teddy-house/`
- Health API: `/api/pages/teddy-house/health`
- Logs API: `/api/pages/teddy-house/logs`
- Logs page: `/pages/teddy-house/logs/`
- Public Tailscale Funnel: `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/`

Expected public routes:

- `:10000` -> Teddy Homebase
- `:8443` -> BlueBubbles

Everything else should remain tailnet-only or local unless Dan approves a route change.

## Auth And Exposure Rules

- Remote/Tailscale access stays passworded.
- Trusted-device login should stay durable; do not shorten the trusted-device behavior without a reason.
- Local loopback health probes are intentionally narrow and exist for smoke checks.
- Do not widen unauthenticated routes without an explicit security reason plus tests.
- Direct `/data/...` browser access must stay blocked.
- Do not run broad Tailscale resets or mutate Serve/Funnel without Dan approval.

## Data And Evidence

Important Homebase data lives under `data/teddy-house/`:

- `snapshot.json`: latest drift baseline.
- `timeline.json`: persistent event history.
- `visual-evidence.json`: proof of rendered/dashboard evidence.
- `service-logs.json`: normalized redacted log evidence.
- `vitals-history.json`: real vitals samples for CPU peaks.
- `ask-history.json`: local Ask Teddy answers.

Keep histories bounded. If adding a new persisted file, define retention and source truth in code and docs.

## Storage Rule

This Mac mini should not fill the internal disk with bulky artifacts.

- Use `/Volumes/Media Claw` for large screenshots, videos, generated reports, service cache archives, and media-related working files.
- Keep stable media references on `/Users/teddyclaw/TeddyMedia` and `/Users/teddyclaw/Music/Teddy Focus Room`; both are compatibility paths into `Media Claw`.
- If `Media Claw` is not mounted, stop before creating large artifacts and tell Dan.
- Do not move or rewrite live Homebase, OpenClaw, Homebridge, Jellyfin, or auth data without service-specific checks.

## Review And Release Rules

- Preserve Dan's existing dirty work. Do not reset, delete, or broad-clean the tree.
- Update tests when changing auth, routing, dashboard copy, service signals, logs, page visibility, or persisted evidence.
- For UI work, verify rendered behavior with browser tooling at narrow/mobile width and desktop when layout matters.
- For public/Funnel-facing work, verify local API and Tailscale route behavior before reporting success.
- Keep commits scoped and explain what passed. Do not push to `main` without summarizing changes first.

## Durable Docs

- `CLAUDE.md`: product/operator briefing.
- `docs/TEDDY-HOMEBASE-ARCHITECTURE.md`: system boundaries and proof gates.
- `docs/UNIFIED-LOGGING-PLAN.md`: logging architecture.
- `docs/TEDDY-HOMEBASE-HANDOFF.md`: latest handoff and Ask/auth notes.

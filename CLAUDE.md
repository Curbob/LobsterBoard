# Claude Briefing

Last updated: 2026-05-18

This repo is LobsterBoard with Dan's private Teddy Homebase work layered on top. Treat it like a local production surface for the Mac mini, not a generic demo dashboard.

## Current Product Contract

- Teddy Homebase is a quiet Mac mini and home-stack cockpit.
- The first screen should answer: is the stack healthy, what needs review, and what changed?
- Do not add widgets unless they improve that first decision.
- Keep Teddy Weather, Focus Room, Claude Usage, and other adjacent pages out of Homebase unless Dan explicitly promotes them.
- Use real probes, real logs, and real evidence. No fake charts, fake trends, or decorative metrics.
- Eufy lock data is currently unreliable and ignored on the daily dashboard unless a better live source replaces it.
- CPU peaks and other trend-like signals must be backed by persisted local history, not generated display noise.

## Logging Contract

- Main dashboard gets one compact Service logs signal.
- Grouped evidence lives at `/pages/teddy-house/logs/`.
- The logs API is `/api/pages/teddy-house/logs`.
- Sources currently include Homebase, Homebridge, Eufy plugin, OpenClaw, AdGuard, and Tailscale.
- Redact emails, tokens, passwords, pairing codes, QR payloads, and setup-code patterns before browser display.
- Promote only current counted `warn` or `bad` sources into the Review lane.
- Store the latest normalized snapshot at `data/teddy-house/service-logs.json`.

See `docs/UNIFIED-LOGGING-PLAN.md` for the saved Teddy/Codex architecture plan.

## Auth And Exposure

- Remote/Tailscale access stays passworded.
- Local loopback smoke probes are intentionally narrow and exist so health checks can verify Homebase without a browser session.
- Do not widen unauthenticated routes without an explicit security reason and tests.
- Do not run broad Tailscale resets. Route changes need Dan approval.
- Direct `/data/...` file serving must remain blocked. Browser-visible data should go through intentional APIs.

Expected public Funnel routes:

- `:10000` Teddy Homebase
- `:8443` BlueBubbles

Everything else should stay tailnet-only or local unless Dan approves a change.

## Storage

- `Media Claw` is the Mac mini bulk-storage volume: `/Volumes/Media Claw`.
- Do not store dashboard screenshots, video proofs, service cache archives, or other large generated artifacts on the internal disk by default.
- If a Homebase feature references Jellyfin/Teddy media, keep the stable compatibility paths: `/Users/teddyclaw/TeddyMedia` and `/Users/teddyclaw/Music/Teddy Focus Room`; both resolve to `Media Claw`.
- If `Media Claw` is not mounted, report that state instead of silently writing bulky files to the internal disk.

## Commands

```bash
npm run lint
npm test
npm run check -- --runInBand
```

For live local proof:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

After server-code or route changes:

```bash
launchctl kickstart -k gui/$(id -u)/com.teddy.house-lobsterboard
```

## Review Rules

- Preserve Dan's existing dirty work. Do not reset, delete, or broad-clean the tree.
- Keep Homebase copy plain, useful, and polished.
- Update tests when changing auth, routing, dashboard copy, service signals, logs, or page visibility.
- For UI work, verify the rendered page on desktop and narrow/mobile widths.
- Before shipping, report what changed, what passed, what is still unverified, and whether Tailscale was checked.

## Repo Gate Status

`AGENTS.md` is the operational contract. Keep it current when routes, auth, storage, proof commands, or product boundaries change.

Architecture lives in `docs/TEDDY-HOMEBASE-ARCHITECTURE.md`.

# AGENTS.md

## Teddy Homebase Storage Rule

This repo runs on Dan's Mac mini and should not fill the internal disk with bulky artifacts.

- Use `/Volumes/Media Claw` for large screenshots, videos, generated reports, service cache archives, and media-related working files.
- Keep stable media references on `/Users/teddyclaw/TeddyMedia` and `/Users/teddyclaw/Music/Teddy Focus Room`; both are compatibility paths into `Media Claw`.
- If `Media Claw` is not mounted, stop before creating large artifacts and tell Dan.
- Do not move or rewrite live Homebase, OpenClaw, Homebridge, Jellyfin, or auth data without service-specific checks.

For broader project rules, also read `CLAUDE.md`.

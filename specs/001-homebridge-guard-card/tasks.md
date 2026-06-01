# Homebridge Guard Card Tasks

## API

- [x] Confirm current Homebridge service probe returns `ok`, `warn`, or `bad` with source detail.
- [x] Confirm Homebridge accessory count is read from local cache and not fabricated.
- [x] Confirm Homebridge log health uses a recent window and does not promote old recovered bursts.
- [x] Confirm Homebridge UI patch update is `info`, not urgent review.
- [x] Keep Eufy lock state hidden/ignored on the daily dashboard.

## UI

- [x] Keep `Automations` as the house-state card title.
- [x] Use `Responding` for healthy state.
- [x] Use `Review` only when current Homebridge evidence is warn/bad.
- [x] Keep raw log counts out of the healthy first screen.
- [x] Put log examples in the Logs page or evidence section, not the headline zone.

## Tests

- [x] Add or keep API tests for Homebridge service state and accessory count.
- [x] Add regression coverage for recovered Homebridge log bursts.
- [x] Assert Eufy lock evidence stays hidden/degraded.
- [x] Assert Homebridge UI-only update does not become a health warning.
- [x] Assert no fake trend copy appears without persisted history.

## Proof Artifacts

- [x] `npm run check -- --runInBand`
- [x] Local health smoke: `http://127.0.0.1:8080/api/pages/teddy-house/health`
- [x] Local logs smoke: `http://127.0.0.1:8080/api/pages/teddy-house/logs`
- [x] Browser QA at `/pages/teddy-house/`
- [x] Tailscale auth smoke: remote page redirects to login when unauthenticated.

## Ship Gate

- [x] Commit includes code and tests together.
- [x] Final note reports state, proof, and any known non-urgent Homebridge noise.

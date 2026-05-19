# Homebridge Guard Card Tasks

## API

- [ ] Confirm current Homebridge service probe returns `ok`, `warn`, or `bad` with source detail.
- [ ] Confirm Homebridge accessory count is read from local cache and not fabricated.
- [ ] Confirm Homebridge log health uses a recent window and does not promote old recovered bursts.
- [ ] Confirm Homebridge UI patch update is `info`, not urgent review.
- [ ] Keep Eufy lock state hidden/ignored on the daily dashboard.

## UI

- [ ] Keep `Automations` as the house-state card title.
- [ ] Use `Responding` for healthy state.
- [ ] Use `Review` only when current Homebridge evidence is warn/bad.
- [ ] Keep raw log counts out of the healthy first screen.
- [ ] Put log examples in the Logs page or evidence section, not the headline zone.

## Tests

- [ ] Add or keep API tests for Homebridge service state and accessory count.
- [ ] Add regression coverage for recovered Homebridge log bursts.
- [ ] Assert Eufy lock evidence stays hidden/degraded.
- [ ] Assert Homebridge UI-only update does not become a health warning.
- [ ] Assert no fake trend copy appears without persisted history.

## Proof Artifacts

- [ ] `npm run check -- --runInBand`
- [ ] Local health smoke: `http://127.0.0.1:8080/api/pages/teddy-house/health`
- [ ] Local logs smoke: `http://127.0.0.1:8080/api/pages/teddy-house/logs`
- [ ] Browser QA at `/pages/teddy-house/`
- [ ] Tailscale auth smoke: remote page redirects to login when unauthenticated.

## Ship Gate

- [ ] Commit includes code and tests together.
- [ ] Final note reports state, proof, and any known non-urgent Homebridge noise.

# Legit Home Dashboard Tasks

## Phase 1: Domain Model

- [x] Add domain rollup helpers for automation, Mac mini, and network service-log evidence.
- [x] Route Govee/Homebridge plugin warnings to `smart-home`.
- [x] Route Homebase/OpenClaw/macOS/system diagnostics to `mac-mini`.
- [x] Route Tailscale/AdGuard/WAN failures to `network` or `outside-access`.
- [x] Update `needsDan` labels to use house language for service-log domains.
- [x] Update `dailyDecision` copy for domain-specific service-log warnings.
- [ ] Keep the logs page source-level detail intact.
- [ ] Add direct public-access rollup helpers beyond the existing Funnel signal.

## Phase 2: Replay Harness

- [x] Add redacted fixtures for six core home states.
- [x] Add a test helper that runs fixtures through health derivation without touching live services.
- [x] Assert headline, review item, zone order, and daily strip for each fixture.
- [x] Assert healthy fixtures hide raw telemetry from the first screen.

## Phase 3: Real Historical Summaries

- [ ] Define retention limits for WAN, vitals, Homebridge loops, route drift, and incidents.
- [ ] Add 6h/24h summaries only where persisted samples exist.
- [ ] Add tests that fail if chart-like UI appears without persisted backing data.
- [ ] Add visual evidence metadata for each historical summary.

## Phase 4: Guided Action

- [ ] Add per-review `Explain` action using current health context.
- [ ] Add dry-run `Prepare fix` action with explicit approval language.
- [ ] Add tests proving no write/mutation command runs from dashboard actions.
- [ ] Add fallback copy when Teddy/OpenClaw is unavailable.

## Phase 5: QA Gate

- [x] Add `npm run check:homebase` or equivalent one-command QA.
- [x] Smoke local health and logs routes.
- [x] Smoke public Tailscale auth when reachable, with strict mode available.
- [ ] Capture desktop, iPad, and phone screenshots.
- [ ] Add copy blacklist checks for raw/sloppy strings.
- [ ] Document the QA path in README and architecture docs.

## First Pull

- [x] Implement Phase 1 service-log domain rollups.
- [x] Add the replay harness skeleton with healthy, Govee loop, and Mac panic fixtures.
- [x] Run `npm run check -- --runInBand`.
- [ ] Browser QA the live Homebase page at phone/iPad/desktop widths.

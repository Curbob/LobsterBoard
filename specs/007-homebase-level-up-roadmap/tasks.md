# Homebase Level-Up Roadmap Tasks

## Phase 1: Incident Ledger

- [x] Add `incidents` derived field to the health payload without breaking existing fields.
- [x] Define active, resolved, ignored, and recurring incident states.
- [x] Map Govee/Homebridge loops to an automation incident.
- [x] Map macOS diagnostics plus low uptime to a Mac restart incident.
- [x] Map unexpected public exposure to a public route incident.
- [x] Map OpenClaw/Teddy fallback to a Teddy bridge incident.
- [x] Map WAN/DNS quality problems to an internet quality incident.
- [x] Persist incident first-seen and last-seen metadata.
- [x] Add tests proving ignored Eufy/door-lock state cannot create an incident.
- [x] Add UI controls for marking an incident as known.

## Phase 2: Story Engine

- [x] Create a single story derivation helper fed by current probes plus incidents.
- [x] Make `houseState`, `dailyDecision`, `needsDan`, and Ask context agree with the primary story.
- [x] Add fixtures for new, recurring, resolved, and stale incident states.
- [x] Add tests that a recurring issue is labeled as recurring instead of new.
- [x] Add tests that resolved incidents leave `Now` but remain in evidence.

## Phase 3: Actions

- [x] Add `Explain` incident action.
- [x] Add `Prepare fix` dry-run action.
- [x] Add `Open logs` action for relevant local evidence.
- [ ] Add `Capture incident` action that writes a redacted draft bundle.
- [x] Add `Mark known` action only if it is persisted, reversible, and source-backed.
- [x] Add tests proving no action mutates services without approval.

## Phase 4: Evidence Viz

- [x] Add an active incident ribbon with time, source, confidence, and next action.
- [x] Move affected zone and vitals above generic evidence in warning states.
- [x] Collapse healthy evidence behind a quieter detail surface.
- [x] Group repeated timeline entries into one meaningful row.
- [x] Add reboot-scoped mini trends only from persisted samples.
- [x] Add screenshot assertions for story, action, affected zone, and quiet evidence.

## Phase 5: Daily Owner Mode

- [ ] Tighten top-screen copy around Dan's house language.
- [ ] Add text-length budgets for phone first viewport.
- [ ] Make source labels visible only when they affect trust.
- [ ] Update README and architecture docs with the incident-led model.
- [ ] Run `npm run check:homebase`.
- [ ] Smoke the public Tailscale URL and verify auth still gates remote access.

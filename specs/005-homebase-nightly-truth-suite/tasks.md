# Homebase Nightly Truth Suite Tasks

## Phase 1: Spec Gate

- [x] Add the nightly truth-suite spec.
- [x] Add a plan for command, report, schedule, mobile, and incident memory.
- [x] Add QA coverage that fails if the nightly truth-suite spec loses required topics.

## Phase 2: Report Verdict

- [x] Add `truthVerdict` metadata to `artifacts/qa/homebase-latest.json`.
- [x] Classify first-screen/story/source/auth failures as `Homebase is lying`.
- [x] Classify correctly ranked active incidents as `Homebase needs Dan`.
- [x] Classify clean runs as `Homebase is useful`.
- [x] Add a one-command verdict reader for the latest Homebase QA report.

## Phase 3: Scheduling

- [x] Decide whether the scheduler should be Codex automation or launchd.
- [x] Keep the scheduler read-only.
- [x] Add one operator-facing nightly command.
- [ ] Save nightly report artifacts without filling internal disk.
- [x] Add exact smoke path for checking the latest nightly result.

## Phase 4: Mobile Follow-Up

- [ ] Run Android Chrome manual login smoke after the next auth change.
- [ ] Run iPhone PWA manual login smoke after the next auth change.
- [ ] Run iPad PWA manual login smoke after the next auth change.

## Phase 5: More Recorded Incidents

- [ ] Add an AdGuard stats locked/live incident bundle when credentials or API behavior changes.
- [ ] Add a Tailscale preference wedge incident bundle if that failure returns.
- [ ] Add a WAN packet-loss incident bundle when packet loss data exists.

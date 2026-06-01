# Homebase Next-Level QA Spec

## Decision

Make Teddy Homebase harder to fool than a normal dashboard.

The current release gate proves that Homebase is calm, ranked, passworded, and real-probe based. The next level is a black-box trust harness: replay bad days, open the live page like Dan does, ask Teddy what matters, and fail the build when those answers disagree.

## User Outcome

Dan should be able to open Homebase from his phone, iPad, or Mac and trust the first screen without doing mental translation.

The page should answer:

- What happened?
- What matters now?
- What can wait?
- What would Teddy or Codex do next, if Dan approves?

## Current Foundation

Already covered by `npm run check:homebase`:

- 23 replayed house states.
- First-screen copy blacklist.
- Zone ranking and first review ownership.
- Local route smokes for page, health, logs, and Ask.
- Public auth smoke when the Funnel route is reachable.
- Phone, iPad, and desktop screenshots.
- Persisted evidence and no-fake-state checks.
- Ask action safety and dry-run approval language.
- Recorded incident replay for real failure modes.
- Parser golden fixtures for scary logs and source drift.
- Source contracts for trust, freshness, confidence, and first-screen eligibility.

That is strong. It is not the finish line.

## Next-Level Gap

Homebase still needs tests that act more like Dan:

- Auto-capture a redacted replay bundle when Dan flags a live dashboard failure.
- Keep adding real incident fixtures when the house finds a new weird thing.
- Distinguish live Teddy, fallback Teddy, and bridge failure in every Ask path.
- Hard-ban raw operator labels from the first screen as copy regressions.
- Prove source freshness and confidence before any new widget becomes trusted house state.
- Prove screenshot quality beyond overflow: ranking, quietness, and first action visibility.
- Track post-boot resource peaks without carrying stale pre-reboot history into the current story.

## Acceptance Criteria

- A single QA command can replay curated fixtures and at least one recorded real incident bundle.
- The top visible story, first review item, first warned zone, and Ask Teddy answer agree for every replay.
- The mobile/iPad/desktop first viewport can be evaluated against a small visual contract, not only overflow.
- Login persistence is tested on the local/browser harness and documented for Android/iOS manual smoke.
- Log parsers are fixture-backed for Homebridge, service logs, macOS diagnostics, Tailscale, and AdGuard.
- Every new home-state source must declare freshness, confidence, source path, trusted/ignored status, and first-screen eligibility.
- No test depends on mutating Homebridge, Tailscale, AdGuard, macOS, or OpenClaw services.

## Wanted Tests

These are the next tests worth paying for before adding more widgets:

- Incident capture test: turn a live bad dashboard state into a redacted fixture with expected headline, first action, zone order, source snapshots, and log excerpts.
- Copy contract test: fail if raw labels like `System Logs: 2`, `Service Logs: 70`, `APP VERSIONS 1`, or `INTERNET 19 ms` return to the top screen.
- Ask Teddy contract test: assert live Teddy, local fallback, timeout, and bridge-down responses are labeled differently.
- Mobile visual contract test: evaluate phone, iPad, and desktop screenshots for ranking, first action visibility, text fit, and calm healthy state.
- Source freshness test: prove cached, stale, degraded, ignored, or needs-login sources cannot drive `Now` or trusted house-state cards.
- Homebridge parser regression test: prove dated top-level entries count, stack traces do not, Eufy stays ignored, and Govee loops group into one named issue.
- Route/auth smoke test: prove local Homebase loads, public/Tailscale access stays passworded, `/data` stays blocked, and cached login still works.
- Reboot-aware vitals test: prove CPU and memory peaks shown on the page come from the current boot session.

## Non-Goals

- No write actions from QA.
- No fake room state, fake charts, or inferred lock truth.
- No new dashboard widgets solely to satisfy a test.
- No public unauthenticated route for easier testing.

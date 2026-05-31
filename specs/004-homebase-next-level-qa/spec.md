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

- Six replayed house states.
- First-screen copy blacklist.
- Zone ranking and first review ownership.
- Local route smokes for page, health, logs, and Ask.
- Public auth smoke when the Funnel route is reachable.
- Phone, iPad, and desktop screenshots.
- Persisted evidence and no-fake-state checks.
- Ask action safety and dry-run approval language.

That is strong. It is not the finish line.

## Next-Level Gap

Homebase still needs tests that act more like Dan:

- Compare the rendered page, the API story, and Teddy's answer for the same state.
- Replay real incidents from persisted evidence instead of only curated fixtures.
- Prove mobile login stays cached over time.
- Prove local freshness labels cannot drift into trusted house state.
- Prove the dashboard stays quiet as new evidence sources are added.

## Acceptance Criteria

- A single QA command can replay curated fixtures and at least one recorded real incident bundle.
- The top visible story, first review item, first warned zone, and Ask Teddy answer agree for every replay.
- The mobile/iPad/desktop first viewport can be evaluated against a small visual contract, not only overflow.
- Login persistence is tested on the local/browser harness and documented for Android/iOS manual smoke.
- Log parsers are fixture-backed for Homebridge, service logs, macOS diagnostics, Tailscale, and AdGuard.
- Every new home-state source must declare freshness, confidence, source path, trusted/ignored status, and first-screen eligibility.
- No test depends on mutating Homebridge, Tailscale, AdGuard, macOS, or OpenClaw services.

## Non-Goals

- No write actions from QA.
- No fake room state, fake charts, or inferred lock truth.
- No new dashboard widgets solely to satisfy a test.
- No public unauthenticated route for easier testing.

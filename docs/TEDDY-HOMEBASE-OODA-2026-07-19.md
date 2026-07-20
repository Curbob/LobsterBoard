# Teddy Homebase OODA Refinement

Recorded: 2026-07-19 PDT

## Observe

- The healthy mobile dashboard repeated the same conclusion through the hero,
  readiness card, disabled fix button, and Now/Watch/Later strip.
- The Logs page repeated `quiet` at the page, health, source, and detail levels.
- A persisted source-named AdGuard log warning survived after aggregate logs had
  returned to healthy, so the live score could be 100 while House changes still
  described an open signal.
- Desktop vitals used six columns inside a half-width panel, forcing the host
  value into an unreadable narrow column.
- Before evidence is retained in
  `/Volumes/Media Claw/TeddyHomebaseAudits/2026-07-19-ooda-refinement/` as
  `01-healthy-desktop.png`, `02-healthy-mobile.png`, and `03-logs-mobile.png`.

## Orient

Sol found the stale-event truth bug and recommended a compact healthy mode with
one clear readiness statement. Gemini independently identified the healthy-copy
and Logs-copy repetition, the ambiguous `Send status` label, and muddy section
terminology. Gemini's first response referenced already-fixed controls, so it
was challenged with current rendered evidence; only the fresh, corroborated
recommendations were used.

The governing principle for this pass was: truth first, then subtraction. The
product should retain evidence while saying each healthy conclusion once.

## Decide

Ship one coherent copy-and-truth slice:

1. Resolve source-named service-log events against the current aggregate log
   state and migrate legacy events during normalization.
2. Collapse healthy filler controls and decision copy, while preserving the
   warning-state review path.
3. Give readiness, live status, Ask Teddy, and Logs distinct jobs and language.
4. Keep raw log evidence behind operator disclosure and group empty sources.
5. Raise primary control and disclosure targets to 44 px and retain visible
   keyboard focus.
6. Correct the desktop vitals grid without adding a new component or surface.

## Act

- Healthy hero copy now says what is actually proven: core services respond and
  expected public routes are passworded.
- `Core readiness` reports `No trusted signal needs review.` The disabled
  `Nothing to fix` action and healthy Now/Watch/Later filler are hidden.
- `Live status`, `Home environment`, and `Ask Teddy` replace overlapping labels.
- Ask Teddy uses `What changed?`, `Summarize`, and `Ask` instead of an outbound-
  sounding status action.
- Logs now lead with `No log source needs action`, use `Below threshold` for
  benign connection lines, group zero-line sources, and keep examples under
  `Operator details`.
- Legacy and current service-log events have stable identities and clear when
  their aggregate source becomes healthy; House changes no longer carries the
  resolved AdGuard warning.
- Vitals render in three columns inside the desktop split panel.

## Proof

- `npm run check:homebase`: passed.
- Static lint: 15 files passed.
- Tests: 12 files, 211 tests passed.
- Acceptance: `ok`; public auth: `enforced`; failed gates/checks: none.
- Live health: score 100, `needsDan=[]`, no recent changes, House changes
  `Quiet` with zero meaningful events.
- LaunchAgent: running with last exit code 0.
- Rendered mobile and desktop after evidence is retained alongside the before
  set as `04-refined-healthy-mobile.png`, `05-refined-logs-mobile.png`, and
  `06-refined-healthy-desktop.png`.

## Remaining Watch Items

- Run VoiceOver and 200% zoom as a dedicated accessibility pass; this pass
  proves deterministic focus/touch contracts, not full WCAG conformance.
- Revisit whether the persisted summaries need further grouping only after real
  daily use shows they slow the first decision.
- Keep score semantics under observation; do not add more scoring dimensions or
  decorative metrics.

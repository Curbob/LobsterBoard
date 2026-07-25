# Teddy Homebase Improvement Plan

Recorded: 2026-07-16 PDT

Current roadmap refresh: 2026-07-19 PDT

## 2026-07-19 Tip-To-Tail Product Roadmap

This is the canonical backlog for the current Homebase product pass. It folds a
fresh live review, rendered desktop and mobile evidence, repository inspection,
and a privacy-safe independent Grok critique into one execution order. The
independent reviewer saw a bounded product packet and current screenshots, not
credentials, raw logs, private data, or unrestricted repository access.

Current live baseline:

- Readiness was `92/100` with one AdGuard/network service-log review item.
- The page correctly said `Something needs a look.` and Ask Teddy explained the
  same issue from local evidence.
- Desktop at 1280 x 720 and mobile at 390 x 844 rendered without horizontal
  overflow.
- Static lint and all 208 tests in `npm run check` passed.
- The product is already credible and trustworthy. The next gain comes from
  editing, hierarchy, and clearer action paths rather than more features.

Review artifacts are retained locally at:

```text
/Users/teddyclaw/.codex/visualizations/2026/07/18/019f736b-b091-7561-9e5b-33a23ba6ead0/homebase-grok-audit-2026-07-19/
```

The folder contains the desktop warning state, explained state, focused Logs
page, mobile warning state, concise audit summary, and full Grok and Gemini
independent reviews.

### Gemini Cross-Check

Gemini Pro independently reviewed the redacted product packet and challenged
the proposed sequence. Its useful additions are incorporated below:

- Frame the next release as `One-Tap Triage`: one story and one unmistakable
  mobile action.
- Scope Ask context to the selected incident or zone rather than injecting a
  broad system-state payload.
- Restore focus and selected-incident context when returning from focused Logs.
- Treat dry run, blast-radius explanation, verification, and rollback as entry
  requirements for any future mutation feature, not follow-up hardening.
- Prove whether the existing `Mark known` path handles recurring noise before
  adding a separate snooze concept.

Gemini's suggestion of a persistent mobile action bar remains a hypothesis. Use
the quietest interaction that passes one-tap mobile acceptance; begin with the
whole 44 px Review row as the primary target and add persistent chrome only if
real interaction proof shows it is necessary.

### Now: One-Warning Clarity Pass

This is the highest-leverage next release. It should make one real issue feel
obvious, calm, and actionable without weakening source truth.

#### 1. Remove Repeated Warning Copy

The current AdGuard/log warning can appear in the hero, readiness area, `Now`,
`Review`, Internet zone, Ask Teddy, and Signals. Repetition makes one modest
issue feel larger and pushes the actual action down the page.

Implementation:

1. Keep one primary warning sentence in the hero/story area.
2. Keep one compact review row with the first action and source/freshness.
3. Let zones and Signals show state, not repeat the complete narrative.
4. Make Ask Teddy add explanation or next action instead of restating the hero.
5. Add rendered assertions that cap the complete warning sentence at two
   appearances above the fold.

#### 2. Make `Explain` A Fast, Focused Answer

The current Ask flow is too ceremonial for a read-only explanation. It always
shows stages such as `Context`, `Teddy planning`, and `Approval gate`, and it can
include unrelated CPU-peak or boot-memory context merely because a review item
exists.

Implementation:

1. Treat `Explain` as a short local read-only response with no approval stage.
2. Include only evidence causally related to the selected review item.
3. Build the context payload from the selected incident or zone; do not pass a
   broad system-state payload and rely on the model to ignore irrelevant fields.
4. Reserve planning and approval language for a requested action that could
   mutate Homebridge, Tailscale, AdGuard, macOS, Hermes, credentials, or
   routes.
5. Prevent progress text from truncating on narrow screens.
6. Add fixtures proving unrelated memory is omitted from warning explanations.

Likely code seams:

- `pages/teddy-house/api.cjs`: `answerFromDashboardContext()` and its conditional
  memory inclusion.
- `pages/teddy-house/script.js`: Ask progress-state selection.
- `pages/teddy-house/style.css`: Ask panel height and progress layout.

#### 3. Restore A Complete Mobile Review Action

Below 430 px, the review row hides Ask, Plan, Logs, and Save controls. The label
survives but the user can no longer take the next step.

Implementation:

1. Keep one visible primary mobile action: `Open logs` for log-backed reviews.
2. Route directly to the relevant focused Logs state in one tap.
3. Put secondary actions in progressive disclosure only if they remain useful.
4. Test at 390 x 844 plus the existing phone portrait and landscape sizes.
5. Preserve the calm one-story layout and avoid a new mobile action toolbar.

#### 4. Differentiate Readiness From Log Health

The circular `72` on Logs visually resembles the dashboard readiness `92`, but
the scores describe different things. This invites a false comparison.

Implementation:

1. Replace or relabel the Logs ring as `Log signal quality`, `Log health`, or a
   non-score status treatment.
2. State the denominator and meaning if a numeric score remains.
3. Keep the main readiness score unique in shape, placement, or semantics.
4. Add accessible names that communicate the distinction without relying on
   color or position.

#### 5. Raise Accessibility Basics

The muted eyebrow color is approximately 3.84:1 to 4.08:1 on the current dark
surfaces, below the 4.5:1 target for normal text. Several review actions are
24-32 px tall rather than a practical 44 px touch target.

Implementation:

1. Raise small-label contrast to at least 4.5:1 in every rendered state.
2. Give primary touch controls a minimum 44 x 44 px target or equivalent
   spacing.
3. Verify visible keyboard focus, logical focus order, and non-color state
   communication.
4. Run the existing screenshot matrix and add focused accessibility assertions
   where deterministic.

Acceptance for the whole `Now` slice:

- Dan can answer `steady?`, `what first?`, and `what changed?` within five
  seconds.
- A complete warning sentence appears no more than twice above the fold.
- `Explain` agrees with the ranked story, omits unrelated memory, and shows no
  approval gate for read-only work.
- Mobile reaches focused Logs in one tap from the active review.
- Readiness and log health cannot reasonably be mistaken for the same metric.
- Small text meets 4.5:1 contrast and primary touch targets are practical.
- No public route, auth boundary, mutation policy, or source contract changes.
- `npm run check:homebase` passes with fresh desktop and mobile evidence.

### Next: Progressive Disclosure And Incident Closure

After the warning flow is clear, shorten the long page without hiding proof.

1. Collapse detailed Evidence, Signals, and Memory by default; keep the active
   incident's most relevant proof open.
2. Make the lifecycle legible as `detected -> explained -> plan ready ->
   approved -> verified`, while skipping irrelevant stages for read-only work.
3. Preserve a clear round trip from dashboard review to focused Logs and back.
4. Restore keyboard focus and selected-incident context to the exact Review row
   that opened Logs.
5. Move raw paths, parsing examples, and implementation-facing log details
   behind an operator details disclosure.
6. Keep freshness, confidence, and degraded/fallback labels visible whenever
   they change whether a claim should be trusted.
7. Verify screen-reader landmarks, headings, live regions, focus restoration,
   and keyboard behavior across dashboard, Ask, and Logs.
8. Exercise the existing `Mark known` lifecycle against a recurring benign
   warning before designing a separate snooze or mute feature.

Acceptance:

- The active issue and first action remain visible without opening details.
- Opening details reveals source-backed evidence, not decorative telemetry.
- Completing or marking an incident known updates the story predictably and
  preserves the evidence trail.
- Dashboard-to-Logs-to-dashboard navigation retains the selected incident.

### Later: Reliability And Maintainability

These are valuable, but they should follow the visible warning-flow cleanup
unless a trust or production incident promotes them.

1. Add deterministic CI for lint, unit, replay, and browser QA; keep Mac-mini
   probes and public Funnel checks in the local release/nightly lane.
2. Split `pages/teddy-house/api.cjs` incrementally along existing seams:
   probes, normalization/redaction, persistence/retention, scoring/story, Ask,
   and route assembly.
3. Split the large Homebase QA and unit files by the same product boundaries so
   behavior remains traceable during extraction.
4. Add guarded update actions only where dry run, blast radius, approval,
   verification, and rollback are complete entry requirements for the first
   release of that action.
5. Add new incident bundles only for observed failure modes that the current
   story engine cannot explain.
6. Continue the reliability and production-hygiene phases below, using fresh
   evidence to retire items that have already landed.

### Explicitly Do Not Build

- A generic widget gallery, room map, decorative chart wall, or gamified
  readiness score.
- Autonomous `just fix it` behavior for household services or network routes.
- Broader public exposure, richer unauthenticated APIs, or weakened trusted
  device behavior.
- Fake trends, invented room/device state, or trusted Eufy lock status.
- Focus Room, Claude Usage, Teddy Weather, or other adjacent product surfaces
  inside Homebase without an explicit product decision.
- A framework rewrite or big-bang API decomposition.

### Recommended Delivery Sequence

1. De-duplicate the warning story and add rendered regression coverage.
2. Simplify `Explain` and remove unrelated context.
3. Restore the one-tap mobile Logs action.
4. Differentiate Logs health from readiness.
5. Fix contrast, touch targets, focus, and truncation.
6. Run `npm run check:homebase`, inspect the fresh desktop/mobile evidence, and
   verify local health and Logs routes.
7. Ship this as one scoped clarity release before progressive-disclosure or
   module-extraction work.

## 2026-07-19 OODA Refinement Closeout

The copy-and-truth slice above is now implemented locally. Sol and Gemini were
used as independent reviewers, then their recommendations were checked against
fresh live desktop and mobile evidence before adoption.

- Healthy-state repetition is removed: one readiness conclusion replaces the
  disabled fix action and filler Now/Watch/Later strip.
- Logs use action-oriented language, group empty sources, and keep raw examples
  behind operator disclosure.
- Ask Teddy, Live status, and Home environment now have distinct labels and
  jobs.
- A stale AdGuard warning bug was fixed at the event-normalization and current-
  state reconciliation boundary.
- Touch targets, focus styling, disclosure names, and desktop vitals layout were
  tightened without changing auth or exposure.
- The full proof and retained screenshots are recorded in
  `docs/TEDDY-HOMEBASE-OODA-2026-07-19.md`.

This closes the immediate healthy-state clarity work. The remaining roadmap is
progressive disclosure under real warning states, dedicated assistive-
technology proof, and incremental maintainability work.

## 2026-07-17 Closeout

The immediate trust-and-security slice is complete:

- Unexpected root `:443` Funnel exposure was removed; only approved `:8443` and `:10000` public routes remain.
- Incident mutations now require authenticated same-origin requests, with session and trusted-device regression coverage.
- Homebase acceptance failures now make the release command fail.
- Production and development dependency audits are clean after targeted upgrades.
- The service was restarted and the fresh complete release gate passed 207 tests with `acceptanceStatus=ok`, `publicAuth=enforced`, no failed gates or trust checks, and verdict `Homebase is useful` / `Nothing needs Dan.`

The remaining Phase 1 and Phase 2 items are future reliability and maintainability work, not blockers for the current release.

## Outcome

The project has a strong functional and QA foundation. Reliability, security,
and maintainability should take priority over adding features or dashboard
surface area.

Fresh baseline proof:

- `npm run check:homebase` passed.
- Static lint passed across its configured 15 files.
- 12 test files and 205 tests passed.
- Homebase acceptance status: `ok`.
- Public authentication: `enforced`.
- Failed acceptance gates: none.
- Failed trust checks: none.
- Fresh verdict: `Homebase needs Dan`.
- First action: `Check public access first.`
- The review verdict reflects current public-route state, not a QA failure.
- Full release-gate wall time was approximately 79 seconds.
- Measured line coverage was 33.2% overall.
- `pages/teddy-house/api.cjs` measured 30.5% line coverage and 28.1%
  branch coverage.

Repository state during the audit:

- Branch: `teddy-homebase-ask-mvp`.
- Three commits ahead of `dan/teddy-homebase-ask-mvp`.
- Nine modified files containing in-progress TeddyCam and Homebase work.
- Existing dirty work must be preserved and kept separate from this plan.

## Phase 0: Trust And Security

### 1. Close The Loopback Mutation Gap

`server.cjs` currently includes two state-changing routes in the unauthenticated
loopback probe allowlist:

- `POST /api/pages/teddy-house/incidents/capture`
- `POST /api/pages/teddy-house/incidents/:key/known`

These routes write incident drafts or alter the incident ledger. That conflicts
with the documented narrow, read-only loopback probe boundary.

Implementation:

1. Remove both mutation routes from `isLocalHomebaseProbe()`.
2. Keep the health, logs, static page, and read-only Ask routes working as
   currently intended.
3. Change Homebase QA so it authenticates before testing incident capture and
   mark-known behavior.
4. Add explicit regression tests covering local loopback, remote-looking Host,
   trusted-device, and authenticated-session behavior.
5. Add a same-origin or CSRF guard to state-changing dashboard requests.

Acceptance gates:

- Unauthenticated loopback mutation requests return `401`.
- Unauthenticated remote mutation requests return `401`.
- Authenticated incident capture and mark-known requests still pass.
- Local health and logs probes remain available under the existing contract.
- `npm run check:homebase` passes.

### 2. Make QA Failure Artifacts Trustworthy

`tests/homebase-qa.mjs` writes `artifacts/qa/homebase-latest.json` only after the
entire QA run reaches the report-writing stage. An earlier exception can leave
an old green report in place.

Implementation:

1. Assign every QA run a unique run ID and record its start time, git commit,
   branch, and dirty state immediately.
2. Write a run-scoped report for both success and failure.
3. Atomically update `homebase-latest.json` with a temporary file and rename.
4. On an exception, record `acceptanceStatus: fail`, the failed phase, and the
   exact failure instead of preserving a prior green artifact.
5. Make archive and verdict scripts reject missing, stale, or mismatched run
   IDs.
6. Preserve the existing rule that a trust-critical failure produces
   `Homebase is lying`.

Acceptance gates:

- An injected story-agreement failure produces a fresh failed report.
- A failed run cannot expose the prior run's green verdict as current truth.
- Archive and verdict output reference the same run ID as the QA report.
- Success behavior and bounded history retention remain unchanged.

### 3. Clear Dependency And Runtime Drift

The audit found one high-severity production advisory and ten advisories across
the full dependency tree. The production advisory is in `systeminformation`;
the published exploit conditions are Linux-specific, but the dependency should
still be upgraded.

Implementation order:

1. Upgrade `systeminformation` to at least `5.31.17`.
2. Upgrade Rollup within version 4 to a fixed release.
3. Upgrade Vitest and coverage tooling within version 4.
4. Upgrade jsdom within version 29.
5. Upgrade Vite transitively through Vitest.
6. Upgrade `@rollup/plugin-terser` to version 1 and verify its major-version
   behavior.
7. Replace the inaccurate Node `>=16` engine declaration. Current tooling
   requires Node 20.19+, Node 22.12+, or Node 24+.

Acceptance gates:

- `npm audit --omit=dev` reports zero known production vulnerabilities.
- The full dependency audit is clean or each remaining exception is documented.
- Unit tests, Homebase QA, and the production build pass.
- The generated bundles and CSS are present and loadable.

## Phase 1: Architecture And Reliability

### 4. Decompose The Homebase API Incrementally

`pages/teddy-house/api.cjs` is 4,751 lines and combines probes, persistence,
parsing, source contracts, incidents, story ranking, Ask Teddy, and route
assembly. `tests/homebase-qa.mjs` is 3,162 lines and similarly combines many
unrelated QA responsibilities.

Extract one stable domain at a time behind the existing API facade:

1. Pure state, scoring, incident-ranking, and story functions.
2. Source contracts and evidence normalization.
3. Persisted history and retention helpers.
4. Service probes and timeout handling.
5. Incident capture and ledger behavior.
6. Ask Teddy context and fallback behavior.
7. Route assembly and response serialization.

Rules:

- Preserve the existing health payload schema during extraction.
- Avoid a large rewrite or framework migration.
- Move existing tests with each extraction before changing behavior.
- Keep external Homebridge, Tailscale, AdGuard, Hermes, and camera boundaries
  unchanged.

Coverage approach:

- Set focused thresholds on extracted pure modules.
- Target at least 80% branch coverage for story, ranking, retention, and source
  contract modules.
- Do not use a blanket repository threshold that hides child-process and live
  integration coverage boundaries.

### 5. Harden Persisted JSON

Homebase uses direct synchronous JSON writes through `server/pages.cjs` for 18
persistence call sites. Concurrent health, Ask, and incident requests can
overwrite or partially write state.

Implementation:

1. Validate persisted filenames and reject path traversal.
2. Write to a temporary file in the same directory.
3. Flush and rename atomically.
4. Serialize writes per target file.
5. Add schema versions where migration risk exists.
6. Keep explicit age, count, or byte retention for every history and cache.
7. Test interrupted writes, malformed existing JSON, and concurrent updates.

### 6. Measure And Improve Runtime Performance

The health builder already runs its top-level probes concurrently and coalesces
in-flight cache refreshes. Further optimization should begin with per-probe
timing rather than removing checks by intuition.

Implementation:

1. Record duration, timeout, cache status, and result state for every probe.
2. Add cold-health, cached-health, Ask, screenshot, and full-suite timings to
   the QA report.
3. Capture enough runs to establish p50 and p95 baselines.
4. Move slow non-critical maintenance probes out of the first response only
   when story quality remains unchanged in replay and live proof.
5. Ablate one probe or context section at a time and compare latency, trust
   coverage, and first-action agreement.

Initial performance goals to validate after instrumentation:

- Cached health response p95 below 100 ms.
- Cold health response p95 below 3 seconds.
- No trust-critical probe removed or silently downgraded.
- No additional first-screen requests or duplicate TeddyCam work.

### 7. Shorten The Development Verification Loop

Keep `npm run check:homebase` as the canonical release gate, but provide faster
scoped feedback during implementation.

Implementation:

1. Remove the ineffective `--runInBand` npm argument and its warning.
2. Separate unit, replay, browser, public-auth, and optional real-device phases.
3. Add per-phase timings and machine-readable summaries.
4. Add CI for static checks, unit tests, replay fixtures, and deterministic
   browser QA.
5. Keep Mac-mini-only probes and public Funnel checks in the local nightly lane.
6. Preserve one command that runs the complete release gate before deployment.

## Phase 2: Production Hygiene

### 8. Bound TeddyCam Storage And Proxy Work

The rotated-thumbnail cache is currently small, approximately 232 KB, but its
implementation has no age, count, or byte bound.

Implementation:

1. Add cache age, file-count, and total-byte retention.
2. Clean incrementally rather than scanning the directory on every request.
3. Add response-size limits for buffered upstream responses.
4. Stream large media responses instead of accumulating them in memory.
5. Replace wildcard CORS headers with the narrowest required same-origin policy.
6. Preserve authentication and privacy guards for every camera route.

### 9. Fix Build And License Correctness

The Rollup CSS plugin starts asynchronous work without returning its promise,
so Rollup can finish before CSS generation. The generated banner also says MIT
while the project remains BSL-1.1 until its change date.

Implementation:

1. Make the Rollup hook async or return the import promise.
2. Report CSS generation failures as build failures.
3. Change the generated license banner to BSL-1.1.
4. Add a build smoke that verifies every declared distribution artifact exists.
5. Load both ESM and UMD output in isolated tests.

### 10. Refresh Durable Documentation And Real-World Proof

`docs/TEDDY-HOMEBASE-ARCHITECTURE.md` and
`docs/TEDDY-HOMEBASE-HANDOFF.md` still describe the June 1 system. The latest
live Teddy proof is older than 14 days, and real-device login proof is missing
iPhone and iPad coverage.

Implementation:

1. Update architecture boundaries after the module extraction lands.
2. Update the handoff with current routes, proof commands, and known gaps.
3. Refresh the opt-in live Teddy proof.
4. Capture current Android, iPhone PWA, and iPad PWA login-persistence proof.
5. Resolve or explicitly accept the current public-access review item before
   reporting the house stack as fully steady.

## Recommended Execution Order

1. Preserve or separately checkpoint the existing dirty TeddyCam work.
2. Fix the loopback mutation boundary and its QA authentication dependency.
3. Make failed QA runs write fresh failure artifacts.
4. Upgrade dependencies and correct the Node engine declaration.
5. Introduce atomic persistence.
6. Extract pure story and source-contract modules with focused coverage.
7. Add performance instrumentation, then optimize measured bottlenecks.
8. Split the verification ladder and add deterministic CI.
9. Bound TeddyCam cache/proxy behavior and fix build metadata.
10. Refresh documentation and real-device proof.

## Definition Of Done

The improvement program is complete when:

- No unauthenticated path can change Homebase state.
- Every nightly run leaves a fresh success or failure artifact.
- Production dependency audit is clean.
- Node runtime requirements match installed tooling.
- Persisted state uses validated, atomic, serialized writes.
- Trust-critical pure modules have focused coverage thresholds.
- Cold and cached health latency have measured p95 budgets.
- Fast CI and the complete local Homebase release gate both pass.
- Build output carries the correct license and deterministic CSS.
- TeddyCam caches and buffered responses are bounded.
- Architecture, handoff, live Teddy, and real-device proof are current.

No feature expansion should outrank these trust, security, and reliability
items.

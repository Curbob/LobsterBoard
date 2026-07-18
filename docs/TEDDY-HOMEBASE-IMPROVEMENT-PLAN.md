# Teddy Homebase Improvement Plan

Recorded: 2026-07-16 PDT

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
- Keep external Homebridge, Tailscale, AdGuard, OpenClaw, and camera boundaries
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

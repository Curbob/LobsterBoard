# Teddy Homebase Copy System Plan

Recorded: 2026-07-20 PDT

Status: plan only; no product copy changed in this pass.

## Objective

Replace conversational, anthropomorphic, and vague dashboard copy with concise
technical writing. Each message should identify an object, report its state,
and provide an action only when an action exists.

The rewrite must not change service probes, scoring, ranking, authentication,
routes, persistence, or mutation policy.

## Audit Scope

The review covered every user-facing text source in:

- `pages/teddy-house/index.html`
- `pages/teddy-house/logs/index.html`
- `pages/teddy-house/script.js`
- `pages/teddy-house/logs.js`
- `pages/teddy-house/api.cjs`
- Homebase replay fixtures and copy assertions under `tests/`

Inventory totals:

- 114 static HTML text and accessibility values: 90 on Homebase and 24 on Logs.
- 294 client-side text candidates: 253 on Homebase and 41 on Logs.
- 337 API strings in semantic response fields such as `title`, `detail`,
  `summary`, `headline`, `label`, `value`, `message`, and `primaryAction`.
- 515 source occurrences of the current vague vocabulary, including `signal`,
  `evidence`, `quiet`, `steady`, `lane`, `called out`, and anthropomorphic Teddy
  status language.

Rendered evidence:

- `/Volumes/Media Claw/TeddyHomebaseAudits/2026-07-20-copy-system-audit/01-homebase-mobile.png`
- `/Volumes/Media Claw/TeddyHomebaseAudits/2026-07-20-copy-system-audit/02-logs-mobile.png`

## Main Finding

The interface has less repetition than the previous release, but its vocabulary
still mixes four incompatible voices:

1. Household prose: `Dan's house is steady`, `Something needs a look`.
2. AI narration: `Teddy is planning`, `Teddy took too long`, `called out`.
3. Operator metaphors: `quiet`, `loudest source`, `lane`, `story`, `calm`.
4. Technical terms: `public routes`, `log threshold`, `memory pressure`.

The technical terms are the right foundation. The other three voices should be
removed from operational status, error, history, and action text. `Ask Teddy`
can remain the product name; its state and error messages should still use
standard request terminology.

## Writing Standard

### Sentence Model

Use one of these forms:

- `{Object}: {state}`
- `{Object} {verb} {result}`
- `{Action} {object}`
- `{Failure}. {Recovery action}`

Examples:

- `Public access: authenticated`
- `All required services responded.`
- `View Homebridge logs`
- `Status request timed out. Refresh and retry.`

### Object Vocabulary

Use these names consistently:

| Object | Approved name |
| --- | --- |
| Overall result | System status |
| Tailscale Funnel routes | Public access |
| DNS service | AdGuard DNS |
| HomeKit bridge | Homebridge |
| Local agent service | Hermes |
| Mac host | Mac mini |
| Aggregated service logs | Service logs |
| Stored measurements | History |
| State transitions | Events |
| Environmental readings | Sensors |
| Saved incident record | Incident report |

Do not use `house evidence`, `signal evidence`, `source-backed incident`,
`service lane`, `log room`, or `story` in visible copy.

### State Vocabulary

Use a bounded state set:

- `Operational`
- `Available`
- `Connected`
- `Authenticated`
- `Within threshold`
- `Degraded`
- `Unavailable`
- `Failed`
- `Unknown`
- `Not configured`
- `Acknowledged`
- `Resolved`

Use object-specific states where they are more precise. Do not use `steady`,
`quiet`, `clear for now`, `known`, `responding`, `needs a look`, `FYI`, or
`called out` as system states.

### Action Vocabulary

Actions must use an explicit verb and object:

- `Refresh status`
- `View logs`
- `Explain issue`
- `Create fix plan`
- `Save incident report`
- `Acknowledge incident`
- `Reopen incident`
- `Show service details`
- `Hide service details`

Do not label a read-only planning action `Fix`.

## Priority Replacement Map

| Current text | Proposed text |
| --- | --- |
| Dan's house is steady. | System status: operational |
| Core services are responding. Public access is expected and passworded. | All required services are available. Public routes require authentication. |
| Core readiness | System status |
| No trusted signal needs review. | No issues detected. |
| Live status | Services |
| Public access / Protected | Public access / Authenticated |
| Internet / Normal | Internet / Connected |
| Automations / Responding | Homebridge / Available |
| Mac mini / Healthy | Mac mini / Operational |
| Something needs a look. | Issue detected. |
| Homebase found an issue. | Service check failed. |
| Clear for now. | No issues detected. |
| Quiet | No events |
| House evidence is current. | Status data is current. |
| No log source needs action | All log sources are within thresholds |
| Private evidence stays redacted. | Sensitive values are redacted. |
| The loudest source is ranked first. | Sources are ordered by severity. |
| Operator details | Log details |
| Ask Teddy to Fix | Create fix plan |
| Plan | Create plan |
| Save | Save incident report |
| Mark known | Acknowledge incident |
| Track again | Reopen incident |
| Teddy is planning | Creating plan |
| Teddy answering | Processing request |
| Teddy took too long. | Request timed out. Status data remains available. |
| Teddy bridge needs attention. | Ask service unavailable. Showing current status data. |
| No review items are currently called out. | No issues are active. |
| first ranked warning | highest-severity issue |
| Persisted summaries | History |
| Recent changes | Events |
| Launcher shortcuts | Applications |

Final wording should be validated in every fixture before it is locked; this
table defines the direction, not permission to flatten important distinctions.

## Surface Plan

### 1. Page Shell And Navigation

- Align sidebar labels with page headings. `House state` and `Home stats` are
  currently stale names for `Services` and `Sensors`.
- Remove the Logs sidebar `Framework` link; its section no longer exists.
- Rename `Memory` to `History`, `Changes` to `Events`, and `Links` to
  `Applications`.
- Change `Refresh` to `Refresh status` where space permits; retain the shorter
  label only at compact widths with the same accessible name.

### 2. Loading, Healthy, Warning, And Failure States

- Rewrite all state generators in `deriveHomebaseStory()`,
  `deriveHouseState()`, `deriveDailyDecision()`, and `renderSummary()`.
- Each state must include one overall result and, only when needed, one next
  action.
- Remove parallel synonyms for the same state. One condition must not alternate
  among `steady`, `clear`, `quiet`, `normal`, and `responding` without an
  object-specific reason.
- Keep loading copy procedural: `Checking system status` and `Checking logs`.
- Keep errors factual: failure, affected object, and recovery action.

### 3. Service Cards, Sensors, Vitals, And Evidence

- Use object names as card titles and measured state as the value.
- Replace vague detail such as `checks are responding` with the actual checked
  objects or omit the sentence when the state already communicates the result.
- Rename `Service evidence` to `Service details` and `Evidence signals` to
  `Diagnostics`, or merge them if they expose the same operator task.
- Standardize source metadata as `Source`, `Last checked`, `Confidence`, and
  `Status`. Do not turn metadata into prose.
- Preserve trusted-source and degraded-source distinctions; simplify their
  labels without hiding uncertainty.

### 4. Logs

- Use `Within threshold`, `Review`, and `Failed` for log-source states.
- Replace `quiet sources` with `{n} sources with no recent entries`.
- Replace `Below threshold` with `Within threshold`.
- Use correct singular and plural forms (`1 line`, `2 lines`).
- Separate the ignored Eufy policy from the numeric log result. The current card
  combines an observed line count, threshold status, and an unrelated lock-trust
  explanation in one paragraph.
- Use `Log details` for the disclosure and `Source unavailable` for missing
  paths.

### 5. Incidents And Review Actions

- Use `Issue` for a currently actionable condition and `Incident` only for a
  persisted incident record.
- Replace `known` with `acknowledged`; it is a standard incident-management
  state and describes the action accurately.
- Replace generic actions (`Ask`, `Plan`, `Save`, `Logs`) with explicit labels
  or explicit accessible names: `Explain issue`, `Create plan`, `Save incident
  report`, and `View logs`.
- State the object in every next action: `Review public access`, not `Start with
  the issue`.

### 6. Ask Teddy

- Retain `Ask Teddy` as the feature name.
- Replace anthropomorphic progress with request states: `Collecting status`,
  `Processing request`, `Creating plan`, `Completed`, `Fallback used`, and
  `Failed`.
- Replace conversational fallback narration with a technical service error and
  the source used for the fallback.
- Rewrite locally generated answers to use `Result`, `Reason`, and `Next step`
  only when those fields contain useful information.
- Remove `ceremony`, `called out`, `leave the rest alone`, and similar model-like
  phrases from prompts and fallbacks.
- Keep explicit no-mutation and approval language in fix plans, but present it
  once under `Approval required` rather than repeating it in progress copy,
  answer copy, and prompt instructions.

### 7. History And Events

- Use `History` for retained samples and `Events` for state changes.
- Replace `No meaningful persisted timeline events` with `No events in the last
  24 hours` when that is the exact query result.
- Replace `Baseline saved` with `Monitoring baseline created`.
- Replace `No drift` with `No configuration changes detected`.
- Keep time windows and sample counts as structured metadata, not prose.

### 8. Accessibility Text

- Make accessible names match the visible action plus the target object.
- Announce only the changed state in live regions; do not repeat the hero,
  readiness, and Teddy line.
- Keep error messages independent of color and position.
- Verify abbreviations such as WAN and DNS have enough context in accessible
  names.
- Test actual VoiceOver reading order after the rewrite; source inspection and
  screenshots cannot prove assistive-technology clarity.

## Implementation Sequence

1. Add a single copy catalog organized by object and state. Keep probe data and
   text generation separate.
2. Add a content inventory test that extracts HTML text, accessibility values,
   client strings, and semantic API strings. Fail on uncatalogued visible copy.
3. Lock the approved object, state, and action vocabulary in a copy-style test.
4. Rewrite the static shell and loading states.
5. Rewrite API story, zone, decision, event, and log-detail generators.
6. Rewrite client interaction, incident, Ask, fallback, timeout, and error copy.
7. Update every replay fixture and exact-string assertion in the same commit as
   its source change.
8. Render healthy, loading, warning, failed, fallback, acknowledged, resolved,
   and empty-history states at phone and desktop sizes.
9. Run VoiceOver and 200% zoom checks after the deterministic suite passes.
10. Run `npm run check:homebase`, inspect `artifacts/qa/homebase-latest.json`,
    restart the LaunchAgent, and verify local plus authenticated public routes.

## Required State Matrix

The copy pass is incomplete until it covers:

- Initial loading and refresh
- Healthy system
- Single warning and multiple warnings
- Core service failure
- Public-route drift
- Internet and DNS degradation
- Homebridge log warning
- Mac restart incident
- Resource pressure
- Stale, unavailable, ignored, and unauthenticated sources
- Empty and populated history
- Ask success, local fallback, timeout, empty response, and failure
- Incident capture, acknowledge, reopen, resolved, and invalid state
- Logs loading, healthy, warning, failure, ignored source, and missing source

## Acceptance Criteria

- Every visible string is either in the copy catalog or is formatted from a
  catalog template with typed object and state values.
- Every message identifies an object or explicit action.
- No visible operational copy contains `steady`, `quiet`, `needs a look`,
  `called out`, `loudest`, `lane`, `story`, or anthropomorphic progress text.
- One condition uses one approved state term across hero, card, review, Logs,
  Ask, history, and accessibility text.
- No read-only action is labeled as a fix.
- Singular, plural, punctuation, capitalization, and time-window formatting are
  consistent.
- Healthy first-screen copy is shorter than the current baseline.
- Warning copy names the affected object and one next action without repeating
  the full message elsewhere.
- Existing auth, redaction, source-trust, incident, and no-mutation contracts
  remain intact.
- All Homebase tests and rendered acceptance checks pass with fresh evidence.

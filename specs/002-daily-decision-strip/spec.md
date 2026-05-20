# Daily Decision Strip Spec

## Decision

Help Dan decide what, if anything, needs attention in the house stack right now.

This is a minor update to make Teddy Homebase more useful without making the dashboard busier. The first screen should stop asking Dan to interpret cards and instead give him a ranked answer:

- `Now`: the one thing to check first, only if something is active.
- `Watch`: non-urgent signal worth knowing.
- `Later`: maintenance that can wait.

## User Outcome

Dan opens Homebase and knows whether to act in under five seconds.

If everything is fine, the strip should make that boring and obvious. If something is off, it should point at the first useful check, not dump raw telemetry.

## Scope

In scope:

- Add one compact decision strip below the status band and above evidence.
- Derive it from existing `health`, `houseState`, `needsDan`, `intelligence`, `vitals`, and timeline data.
- Keep the existing Review lane behavior, but let the strip explain the priority in plainer house language.
- Add tests for ranking, stale-data filtering, and healthy-state quietness.

Out of scope:

- New service probes.
- New credentials.
- Write actions.
- Agent/autofix buttons.
- New charts or fake trend data.
- Door-lock truth from Eufy.

## Product Shape

Healthy state:

- `Now`: `Nothing needs Dan.`
- `Watch`: `Homebridge UI has a patch update when convenient.`
- `Later`: `Logs and route exposure are accounted for.`

Review state:

- `Now`: first ranked Review item in plain language.
- `Watch`: the strongest non-urgent supporting signal.
- `Later`: optional maintenance or hidden evidence.

Issue state:

- `Now`: the failing system and the next check.
- `Watch`: current exposure or connector context.
- `Later`: non-blocking maintenance.

## Copy Rules

- Use house language first, evidence language second.
- Do not show raw ports, IPs, package versions, or log counts in the strip unless they are the reason to act.
- Do not say `healthy` if any active `warn` or `bad` item exists.
- Do not include stale timeline warnings that have resolved.
- Do not mention Eufy/door locks in the strip.

## Acceptance Criteria

- The strip has exactly three slots: `Now`, `Watch`, `Later`.
- Healthy first screen remains calm and shorter than the current card stack.
- Active warnings rank before optional updates.
- Optional Homebridge UI updates can appear as `Later`, not `Now`.
- Old resolved warnings do not appear in any slot.
- Tests fail if fake trend or stale warning copy is added.

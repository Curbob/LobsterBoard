# Homebridge Guard Card Spec

## Decision

Help Dan decide whether Homebridge needs attention right now.

The card should answer, in one glance:

- Are automations responding?
- Did Homebridge restart, disconnect, or start looping?
- Is the noise actionable, or just recovered service chatter?
- What should Dan check first if the house automation layer is degraded?

## User Outcome

Dan should not have to read raw Homebridge logs unless something is actually wrong. The daily dashboard should stay calm when Homebridge is healthy, and the Logs page should hold the evidence.

## Scope

In scope:

- A ranked Homebridge Guard signal/card backed by real Homebridge probes and recent logs.
- Clear copy for `ok`, `info`, `warn`, and `bad` states.
- Evidence in the logs view showing source, count, freshness, and redacted examples.
- Tests that fail if stale, fake, or untrusted Homebridge state is promoted.

Out of scope:

- Mutating Homebridge config.
- Restarting Homebridge.
- Adding or removing plugins.
- Trusting Eufy lock state as house truth.
- Fake trend lines or invented historical graphs.

## State Model

- `ok`: Homebridge responds, accessory cache loads, and recent log noise is below threshold or recovered.
- `info`: optional maintenance or degraded source that should not wake Dan up.
- `warn`: current repeated errors, recent restart loop, missing accessory cache, or failed Homebridge probe.
- `bad`: Homebridge is unreachable, port is closed, or evidence suggests an active service failure.

## Product Copy

Healthy:

- Title: `Automations`
- Value: `Responding`
- Detail: `Homebridge and accessories are responding.`

Needs review:

- Title: `Automations`
- Value: `Review`
- Detail: `Homebridge needs a look.`

Evidence label:

- `Homebridge Guard`

## Acceptance Criteria

- The daily screen promotes Homebridge only when the current Homebridge state is `warn` or `bad`.
- Recovered log bursts do not remain stuck in the Review lane.
- Homebridge UI patch updates stay `info` unless the core Homebridge service is affected.
- Eufy lock state remains ignored/degraded evidence.
- Every surfaced warning has a source and timestamped evidence.

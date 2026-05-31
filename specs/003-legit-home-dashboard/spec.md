# Legit Home Dashboard Spec

## Decision

Make Teddy Homebase a real home dashboard for Dan, not a generic server monitor.

The daily screen should answer three questions in under five seconds:

- Is the house steady?
- What changed that matters?
- What should Dan do next, if anything?

## Current State

Homebase already has the right foundation:

- Real local probes for DNS, Homebridge, Tailscale, WAN, OpenClaw, macOS, service logs, and Mac mini vitals.
- A ranked `houseState` layer with public access, network, automations, and Mac mini zones.
- A daily `Now / Watch / Later` strip.
- A passworded public Tailscale Funnel route.
- A hidden logs view with redacted evidence.
- Ask Teddy routed through the local OpenClaw bridge.

The current live dashboard also shows the next product gap clearly: Govee/Homebridge log noise is an automation issue, but the aggregated service-log signal can still make the Mac mini zone look like the failing system. The next level is stronger domain modeling, not more cards.

## User Outcome

Dan opens the dashboard and gets a calm house read:

- `Home is steady.` when the stack is genuinely fine.
- `Automations need a look.` when Homebridge, accessories, or plugin loops are the real issue.
- `Mac mini needs a look.` only when host health, macOS, OpenClaw, system logs, CPU, memory, disk, or uptime are the issue.
- `Public access changed.` only when approved exposure drifts.

The dashboard should feel like an Apple-quality private cockpit: sparse, ranked, real, and useful.

## Scope

In scope:

- Improve the domain model so evidence maps to the correct house zone.
- Add a replay/test harness for recorded home states.
- Add real historical summaries for uptime, WAN quality, Homebridge noise, and incidents.
- Add a guided action surface that can ask Teddy/Codex for next steps without performing write actions automatically.
- Add a stronger QA gate for live routes, mobile layouts, and copy quality.

Out of scope for this slice:

- Unapproved Homebridge, Tailscale, AdGuard, or macOS mutations.
- Treating Eufy lock state as trusted house truth.
- Fake charts or invented trend data.
- Public unauthenticated data access.
- A generic LobsterBoard widget marketplace redesign.

## Product Principles

- House language first, evidence language second.
- One thing should be first. If everything is first, the dashboard failed.
- Healthy screens should be boring.
- Warnings must name the real system, not the nearest log file.
- Every graph needs persisted data, freshness, and a source.
- Ask Teddy should explain or prepare an action; execution needs explicit approval.

## Acceptance Criteria

- Active Homebridge/Govee/plugin loops promote `Automations`, not `Mac mini`.
- Active macOS panic, reboot, CPU, memory, disk, or OpenClaw failures promote `Mac mini`.
- Public route drift promotes `Public access`.
- WAN/DNS/Tailscale trouble promotes `Internet`.
- Healthy first screen does not show raw ports, IPs, versions, or log counts.
- Timeline shows meaningful grouped events, not repeated heartbeat spam.
- Mobile and iPad views have no horizontal overflow.
- Ask Teddy answers with live dashboard context and marks fallback honestly.
- Tests can replay at least five known home states without depending on the live Mac mini.

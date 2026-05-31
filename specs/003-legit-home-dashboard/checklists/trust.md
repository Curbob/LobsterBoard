# Legit Home Dashboard Trust Checklist

## Data Truth

- [ ] Every visible warning has a source, timestamp, freshness, and confidence.
- [ ] Healthy first screen does not show stale data as current.
- [ ] No fake trends, fake graphs, fake room state, or inferred device state.
- [ ] Eufy lock data remains ignored/degraded until the source is trustworthy.
- [ ] Cached update data is labeled as cached.

## Ranking Truth

- [ ] Automations warnings rank under `Automations`.
- [ ] Mac host warnings rank under `Mac mini`.
- [ ] Public exposure warnings rank under `Public access`.
- [ ] WAN/DNS/Tailscale warnings rank under `Internet`.
- [ ] The first review item matches the first warned house zone.

## Copy Truth

- [ ] No user-facing copy like `Service Logs: 70`, `System Logs: 2`, or `Recent Mac logs need attention`.
- [ ] No generic `Something needs a look` when a specific incident is known.
- [ ] No raw ports, IPs, versions, or log counts on the healthy first screen.
- [ ] Review copy names what Dan should check first.

## Auth And Action Safety

- [ ] Remote Homebase remains passworded.
- [ ] Public API returns `401` when unauthenticated.
- [ ] Loopback probe allowance remains narrow.
- [ ] Ask Teddy may explain and prepare plans, but does not mutate services.
- [ ] Any write action requires explicit approval.

## Visual QA

- [ ] Phone width has no horizontal overflow.
- [ ] iPad width has no horizontal overflow.
- [ ] Desktop first screen is ranked and calm.
- [ ] Local links stay below the health story.
- [ ] Evidence sections stay subordinate unless a warning promotes them.

# Legit Home Dashboard Trust Checklist

## Data Truth

- [ ] Every visible warning has a source, timestamp, freshness, and confidence.
- [ ] Healthy first screen does not show stale data as current.
- [ ] No fake trends, fake graphs, fake room state, or inferred device state.
- [ ] Eufy lock data remains ignored/degraded until the source is trustworthy.
- [ ] Cached update data is labeled as cached.
- [ ] Replay fixtures cover healthy, Govee/Homebridge loop, Mac panic, public exposure drift, WAN/DNS degradation, and Teddy bridge fallback.

## Ranking Truth

- [ ] Automations warnings rank under `Automations`.
- [ ] Mac host warnings rank under `Mac mini`.
- [ ] Public exposure warnings rank under `Public access`.
- [ ] WAN/DNS/Tailscale warnings rank under `Internet`.
- [x] The first review item matches the first warned house zone.
- [x] Fixture zone order is locked end to end, not only the first card.

## Copy Truth

- [ ] No user-facing copy like `Service Logs: 70`, `System Logs: 2`, or `Recent Mac logs need attention`.
- [ ] No generic `Something needs a look` when a specific incident is known.
- [ ] No raw ports, IPs, versions, log counts, or ignored lock evidence on any replayed first screen.
- [ ] Review copy names what Dan should check first.
- [ ] The complete `Now / Watch / Later` strip is locked for each replay fixture.

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
- [x] Local links stay below the health story.
- [x] Recent changes are grouped and free of heartbeat/noise rows in rendered QA.
- [x] Evidence sections stay subordinate unless a warning promotes them.

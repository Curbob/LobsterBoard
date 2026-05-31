# Legit Home Dashboard Trust Checklist

## Data Truth

- [x] Every visible warning has a source, timestamp, freshness, and confidence.
- [ ] Healthy first screen does not show stale data as current.
- [x] No fake trends, fake graphs, fake room state, or inferred device state.
- [x] Eufy lock data remains ignored/degraded until the source is trustworthy.
- [x] Cached update data is labeled as cached.
- [x] Replay fixtures cover healthy, Govee/Homebridge loop, Mac panic, public exposure drift, WAN/DNS degradation, and Teddy bridge fallback.

## Ranking Truth

- [x] Automations warnings rank under `Automations`.
- [x] Mac host warnings rank under `Mac mini`.
- [x] Public exposure warnings rank under `Public access`.
- [x] WAN/DNS/Tailscale warnings rank under `Internet`.
- [x] The first review item matches the first warned house zone.
- [x] Fixture zone order is locked end to end, not only the first card.

## Copy Truth

- [ ] No user-facing copy like `Service Logs: 70`, `System Logs: 2`, or `Recent Mac logs need attention`.
- [ ] No generic `Something needs a look` when a specific incident is known.
- [ ] No raw ports, IPs, versions, log counts, or ignored lock evidence on any replayed first screen.
- [ ] Review copy names what Dan should check first.
- [ ] The complete `Now / Watch / Later` strip is locked for each replay fixture.

## Auth And Action Safety

- [x] Remote Homebase remains passworded.
- [x] Public API returns `401` when unauthenticated.
- [x] Loopback probe allowance remains narrow.
- [x] Ask Teddy may explain and prepare plans, but does not mutate services.
- [x] Any write action requires explicit approval.

## Visual QA

- [x] Phone width has no horizontal overflow.
- [x] iPad width has no horizontal overflow.
- [x] Desktop first screen is ranked and calm.
- [x] Local links stay below the health story.
- [x] Recent changes are grouped and free of heartbeat/noise rows in rendered QA.
- [x] Evidence sections stay subordinate unless a warning promotes them.

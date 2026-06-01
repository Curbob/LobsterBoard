# Homebase Nightly Truth Suite Trust Checklist

## Read-Only Safety

- [ ] The suite does not restart services.
- [ ] The suite does not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw, or credentials.
- [ ] The suite does not clear Dan's real browser sessions.

## Story Truth

- [ ] API, rendered page, and Ask Teddy agree on the first action.
- [ ] Fallback Ask answers are visibly labeled as fallback.
- [ ] Healthy first screen does not show stale, cached, ignored, degraded, raw port, raw IP, or package-count evidence as truth.

## Auth Truth

- [ ] Public page redirects unauthenticated requests to login.
- [ ] Public health and logs APIs reject unauthenticated remote-looking requests.
- [ ] Local loopback probes remain available only through the explicit local boundary.

## Visual Truth

- [ ] Phone screenshot has no horizontal overflow.
- [ ] iPad screenshot has no horizontal overflow.
- [ ] Desktop screenshot has no horizontal overflow.
- [ ] First action appears before evidence.

## Incident Truth

- [ ] Recorded incidents replay through the same story agreement path as curated fixtures.
- [ ] Repeated timeline spam is grouped.
- [ ] Door-lock/Eufy data remains ignored until a reliable source exists.

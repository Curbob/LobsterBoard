# Homebase Nightly Truth Suite Trust Checklist

## Read-Only Safety

- [x] The suite does not restart services.
- [x] The suite does not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw, or credentials.
- [x] The suite does not clear Dan's real browser sessions.

## Story Truth

- [x] API, rendered page, and Ask Teddy agree on the first action.
- [x] Fallback Ask answers are visibly labeled as fallback.
- [x] Healthy first screen does not show stale, cached, ignored, degraded, raw port, raw IP, or package-count evidence as truth.

## Auth Truth

- [x] Public page redirects unauthenticated requests to login.
- [x] Public health and logs APIs reject unauthenticated remote-looking requests.
- [x] Local loopback probes remain available only through the explicit local boundary.

## Visual Truth

- [x] Phone screenshot has no horizontal overflow.
- [x] iPad screenshot has no horizontal overflow.
- [x] Desktop screenshot has no horizontal overflow.
- [x] First action appears before evidence.

## Incident Truth

- [x] Recorded incidents replay through the same story agreement path as curated fixtures.
- [x] Repeated timeline spam is grouped.
- [x] Door-lock/Eufy data remains ignored until a reliable source exists.

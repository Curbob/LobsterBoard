# Trust Checklist

## No Fake Helpfulness

- [x] Every slot points to a real field in the health response.
- [x] No slot invents a trend, room state, or action.
- [x] No slot uses decorative confidence language.
- [x] No slot says `clear` while `needsDan` is non-empty.

## Freshness

- [x] `Now` only uses current request data.
- [x] Cached data is allowed only for `Watch` or `Later`.
- [x] Cached copy names itself only when useful, not as clutter.
- [x] Resolved warnings are filtered out.

## Ranking

- [x] Active `bad` beats active `warn`.
- [x] Active `warn` beats optional update.
- [x] Public exposure warning beats local maintenance.
- [x] Homebridge service failure beats Homebridge UI patch update.

## Auth

- [x] No new unauthenticated route.
- [x] Remote page still redirects to login.
- [x] Logs remain passworded remotely.
- [x] Direct `/data/...` remains unavailable.

## Mobile

- [x] Three slots fit on phone width.
- [x] Long labels wrap cleanly.
- [x] The strip does not push the main verdict below the fold unnecessarily.

## Copy

- [x] Copy sounds like a calm operator, not corporate dashboard filler.
- [x] No raw telemetry in healthy state.
- [x] No Eufy/door lock text.
- [x] No stale warning text.

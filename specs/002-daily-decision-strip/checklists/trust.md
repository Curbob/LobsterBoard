# Trust Checklist

## No Fake Helpfulness

- [ ] Every slot points to a real field in the health response.
- [ ] No slot invents a trend, room state, or action.
- [ ] No slot uses decorative confidence language.
- [ ] No slot says `clear` while `needsDan` is non-empty.

## Freshness

- [ ] `Now` only uses current request data.
- [ ] Cached data is allowed only for `Watch` or `Later`.
- [ ] Cached copy names itself only when useful, not as clutter.
- [ ] Resolved warnings are filtered out.

## Ranking

- [ ] Active `bad` beats active `warn`.
- [ ] Active `warn` beats optional update.
- [ ] Public exposure warning beats local maintenance.
- [ ] Homebridge service failure beats Homebridge UI patch update.

## Auth

- [ ] No new unauthenticated route.
- [ ] Remote page still redirects to login.
- [ ] Logs remain passworded remotely.
- [ ] Direct `/data/...` remains unavailable.

## Mobile

- [ ] Three slots fit on phone width.
- [ ] Long labels wrap cleanly.
- [ ] The strip does not push the main verdict below the fold unnecessarily.

## Copy

- [ ] Copy sounds like a calm operator, not corporate dashboard filler.
- [ ] No raw telemetry in healthy state.
- [ ] No Eufy/door lock text.
- [ ] No stale warning text.

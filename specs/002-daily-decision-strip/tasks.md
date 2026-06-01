# Daily Decision Strip Tasks

## API

- [x] Add `dailyDecision` to `/api/pages/teddy-house/health`.
- [x] Derive `dailyDecision.slots` from existing health data only.
- [x] Ensure exactly three slots: `now`, `watch`, `later`.
- [x] Keep all existing health fields unchanged.
- [x] Add visual-evidence entry for the strip source and rendered slot keys.

## UI

- [x] Add one compact strip below the status band.
- [x] Keep the strip visually quieter than the Review lane.
- [x] Hide raw counts and ports unless they are the reason to act.
- [x] On mobile, stack the three slots without horizontal overflow.
- [x] Do not add another full card grid.

## Copy

- [x] Healthy `Now`: `Nothing needs Dan.`
- [x] Review `Now`: first active warning in house language.
- [x] `Watch`: current non-urgent signal worth knowing.
- [x] `Later`: optional maintenance.
- [x] No Eufy/door-lock copy.

## Tests

- [x] API test asserts `dailyDecision.slots.map(slot => slot.key)` equals `["now", "watch", "later"]`.
- [x] Healthy-state test asserts `Now` does not contain raw ports, IPs, versions, or log counts.
- [x] Warning-state test asserts active warn/bad signal becomes `Now`.
- [x] Regression test asserts resolved timeline warnings do not appear in any slot.
- [x] Regression test asserts Eufy/door-lock evidence never appears in the strip.
- [x] Design test asserts the strip renders before evidence.

## Proof

- [x] `npm run check -- --runInBand`
- [x] Local health API smoke
- [x] Local browser QA at phone width
- [x] Desktop browser QA
- [x] Tailscale auth redirect smoke

## Commit Gate

- [x] Commit code, tests, and any doc update together.
- [x] Final note reports proof and whether any slot used cached data.

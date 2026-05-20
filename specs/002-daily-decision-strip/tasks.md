# Daily Decision Strip Tasks

## API

- [ ] Add `dailyDecision` to `/api/pages/teddy-house/health`.
- [ ] Derive `dailyDecision.slots` from existing health data only.
- [ ] Ensure exactly three slots: `now`, `watch`, `later`.
- [ ] Keep all existing health fields unchanged.
- [ ] Add visual-evidence entry for the strip source and rendered slot keys.

## UI

- [ ] Add one compact strip below the status band.
- [ ] Keep the strip visually quieter than the Review lane.
- [ ] Hide raw counts and ports unless they are the reason to act.
- [ ] On mobile, stack the three slots without horizontal overflow.
- [ ] Do not add another full card grid.

## Copy

- [ ] Healthy `Now`: `Nothing needs Dan.`
- [ ] Review `Now`: first active warning in house language.
- [ ] `Watch`: current non-urgent signal worth knowing.
- [ ] `Later`: optional maintenance.
- [ ] No Eufy/door-lock copy.

## Tests

- [ ] API test asserts `dailyDecision.slots.map(slot => slot.key)` equals `["now", "watch", "later"]`.
- [ ] Healthy-state test asserts `Now` does not contain raw ports, IPs, versions, or log counts.
- [ ] Warning-state test asserts active warn/bad signal becomes `Now`.
- [ ] Regression test asserts resolved timeline warnings do not appear in any slot.
- [ ] Regression test asserts Eufy/door-lock evidence never appears in the strip.
- [ ] Design test asserts the strip renders before evidence.

## Proof

- [ ] `npm run check -- --runInBand`
- [ ] Local health API smoke
- [ ] Local browser QA at phone width
- [ ] Desktop browser QA
- [ ] Tailscale auth redirect smoke

## Commit Gate

- [ ] Commit code, tests, and any doc update together.
- [ ] Final note reports proof and whether any slot used cached data.

# Quickstart

Run normal gauntlet:

```bash
npm run homebase:dan-trust-gauntlet
```

Run strict gauntlet:

```bash
HOMEBASE_REQUIRE_DAN_TRUST_GAUNTLET=1 npm run homebase:dan-trust-gauntlet
```

If strict mode fails because proof is partial, capture the missing proof:

```bash
HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof
npm run homebase:mobile-proof
```

Then rerun:

```bash
npm run homebase:test-ladder
```

# Quickstart

Check current durable live Teddy proof:

```bash
npm run homebase:live-teddy-proof
```

Run strict mode. This should fail until a real live Teddy artifact exists:

```bash
HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof
```

Capture live proof when Dan wants the bridge tested:

```bash
HOMEBASE_RUN_LIVE_TEDDY_PROOF=1 HOMEBASE_REQUIRE_LIVE_TEDDY_PROOF=1 npm run homebase:live-teddy-proof
```

Then rerun:

```bash
npm run homebase:test-ladder
```

# Trust Checklist

## Real Data

- [x] Homebridge state comes from a live local probe or a named local file.
- [x] Accessory count comes from Homebridge cache, not hardcoded display text.
- [x] Log findings include source and freshness.
- [x] Version state comes from installed versions and latest-version lookup/cache.

## No Stale Warnings

- [x] Old warnings do not remain in Review after current state returns to `ok`.
- [x] Timeline can preserve old events, but house-state recent changes filters resolved warnings.
- [x] Recovered reconnects stay evidence, not daily alarm.

## No Fake Trends

- [x] No graph-like UI appears without persisted historical samples.
- [x] Any “peak” or “trend” copy names the local history source.
- [x] Healthy copy does not imply precision the source cannot support.

## Auth Behavior

- [x] Remote Homebase remains passworded.
- [x] Logs API remains passworded remotely.
- [x] Local loopback smoke paths remain narrow.
- [x] Direct `/data/...` access remains blocked.

## Home Truth

- [x] Eufy lock state is ignored/degraded until a trusted source replaces it.
- [x] Door locks do not appear in the Automations house-state card.
- [x] Optional Homebridge UI updates do not create a scary Review state.

## Copy

- [x] Healthy first screen says what matters, not raw ports or counts.
- [x] Warning copy tells Dan what to check first.
- [x] Evidence copy names the source without dumping unreadable logs.

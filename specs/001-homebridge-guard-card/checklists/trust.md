# Trust Checklist

## Real Data

- [ ] Homebridge state comes from a live local probe or a named local file.
- [ ] Accessory count comes from Homebridge cache, not hardcoded display text.
- [ ] Log findings include source and freshness.
- [ ] Version state comes from installed versions and latest-version lookup/cache.

## No Stale Warnings

- [ ] Old warnings do not remain in Review after current state returns to `ok`.
- [ ] Timeline can preserve old events, but house-state recent changes filters resolved warnings.
- [ ] Recovered reconnects stay evidence, not daily alarm.

## No Fake Trends

- [ ] No graph-like UI appears without persisted historical samples.
- [ ] Any “peak” or “trend” copy names the local history source.
- [ ] Healthy copy does not imply precision the source cannot support.

## Auth Behavior

- [ ] Remote Homebase remains passworded.
- [ ] Logs API remains passworded remotely.
- [ ] Local loopback smoke paths remain narrow.
- [ ] Direct `/data/...` access remains blocked.

## Home Truth

- [ ] Eufy lock state is ignored/degraded until a trusted source replaces it.
- [ ] Door locks do not appear in the Automations house-state card.
- [ ] Optional Homebridge UI updates do not create a scary Review state.

## Copy

- [ ] Healthy first screen says what matters, not raw ports or counts.
- [ ] Warning copy tells Dan what to check first.
- [ ] Evidence copy names the source without dumping unreadable logs.

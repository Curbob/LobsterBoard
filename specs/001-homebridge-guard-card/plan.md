# Homebridge Guard Card Plan

## Data Sources

- Homebridge service probe: local TCP/HTTP probe against port `8581`.
- Accessory count: Homebridge cached accessory files.
- Homebridge log health: `/Users/teddyclaw/.homebridge/homebridge.log` and `/Users/teddyclaw/.homebridge/logs/homebridge.log`.
- Homebridge version check: installed Homebridge and Homebridge UI versions.
- Existing normalized Homebase service logs API: `/api/pages/teddy-house/logs`.

## Freshness

- Service probe: live on every health request.
- Accessory count: live read from local cache on every health request.
- Log health: recent log window only; old recovered bursts must not stay promoted.
- Version check: cached is acceptable for maintenance copy, but must not drive urgent health.

## Route And Auth Rules

- Keep `/api/pages/teddy-house/health` unchanged except for additive fields if needed.
- Keep `/api/pages/teddy-house/logs` passworded remotely.
- Local loopback smoke access may remain narrow for health checks.
- Do not expose raw `/data/...` files.
- Do not widen unauthenticated access for Homebridge evidence.

## UI Placement

- Daily house-state grid: `Automations` zone remains one of the four top-level cards.
- Evidence section: Homebridge Guard detail stays below the first screen unless warning state promotes it.
- Logs page: source examples and counts are available for deeper review.

## Ranking

- `bad` Homebridge service failure ranks before optional app updates.
- `warn` repeated current Homebridge errors rank with other house-impacting warnings.
- `info` version updates and ignored Eufy evidence do not enter Review.

## Data Contract

Use existing Homebase signal shape:

```json
{
  "state": "ok",
  "value": "10",
  "label": "recent issues",
  "detail": "Recent log is quiet: 10 warnings or errors.",
  "confidence": "live",
  "source": "local Homebridge logs"
}
```

If a new field is needed, prefer additive evidence fields such as:

- `source`
- `updatedAt`
- `examples`
- `ignored`
- `confidenceDetail`

## Non-Goals

- No Homebridge write actions.
- No plugin install/update button yet.
- No door lock truth from Eufy.
- No chart unless backed by persisted source history.

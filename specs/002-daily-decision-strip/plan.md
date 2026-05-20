# Daily Decision Strip Plan

## Data Sources

Use only existing Homebase data:

- `score`
- `needsDan`
- `houseState.tone`
- `houseState.primaryAction`
- `houseState.recentChanges`
- `intelligence.tailscaleFunnel`
- `intelligence.homebridge.logHealth`
- `intelligence.homebridge.version`
- `intelligence.serviceLogs`
- `intelligence.softwareUpdates`
- `intelligence.macUpdates`
- `intelligence.systemLogs`
- `vitals.health`

## Derivation

Add a derived object to the health response:

```json
{
  "dailyDecision": {
    "tone": "steady",
    "slots": [
      { "key": "now", "label": "Now", "text": "Nothing needs Dan.", "state": "ok", "source": "needsDan" },
      { "key": "watch", "label": "Watch", "text": "Public access is known and passworded.", "state": "info", "source": "tailscaleFunnel" },
      { "key": "later", "label": "Later", "text": "Homebridge UI can update when convenient.", "state": "info", "source": "homebridge.version" }
    ]
  }
}
```

Keep existing fields unchanged.

## Ranking Rules

1. `bad` service or signal.
2. `warn` service or signal.
3. Active Review lane item.
4. Current meaningful change.
5. Optional maintenance.
6. Healthy reassurance.

Never promote:

- hidden signals
- Eufy lock state
- resolved timeline warnings
- raw local-only debug facts

## Freshness

- `Now` must be based on current health response data.
- `Watch` may use cached signals only if marked `cached` and non-urgent.
- `Later` may use cached maintenance data.
- No slot may use old timeline warnings after current state is `ok`.

## UI Placement

Place the strip:

1. Status band
2. Daily Decision Strip
3. Review lane if active
4. House state grid
5. Ask Teddy
6. Evidence

If the Review lane is empty, the strip should be the only action-oriented surface.

## Auth And Routes

- No route changes.
- No auth changes.
- No public data expansion.
- Remote access remains passworded.
- Direct `/data/...` stays blocked.

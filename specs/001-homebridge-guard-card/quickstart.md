# Quickstart

## Local Smoke

Run from the repo:

```bash
cd /Users/teddyclaw/teddy-house-lobsterboard
npm run check -- --runInBand
```

Check the live local API:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

Expected healthy signals:

- `score` is present and between `0` and `100`.
- `houseState.zones` includes `smart-home`.
- `Automations` is `Responding` when Homebridge is healthy.
- `homebridge.accessories.count` is real.
- `homebridge.logHealth` is not promoted unless current evidence crosses threshold.
- `doorLocks.hidden` remains `true`.

## Browser Smoke

Open:

```text
http://127.0.0.1:8080/pages/teddy-house/
```

Check:

- First screen is calm when Homebridge is healthy.
- No raw log count competes with the house-state card.
- Logs/evidence remain available lower down or in `/logs/`.
- No horizontal overflow on phone width.

## Tailscale Smoke

Unauthenticated remote access should redirect to login:

```bash
curl -k -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/
```

Expected:

```text
302 https://openclaw-mac-mini.tail02a3b6.ts.net:10000/login?next=%2Fpages%2Fteddy-house%2F
```

## If The Card Warns

Check logs first:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

Then inspect the Homebridge log directly:

```bash
tail -n 160 /Users/teddyclaw/.homebridge/homebridge.log
```

Do not restart Homebridge or mutate plugin config without Dan approving the fix.

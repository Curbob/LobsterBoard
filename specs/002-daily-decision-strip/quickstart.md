# Quickstart

## Local API Smoke

```bash
cd /Users/teddyclaw/teddy-house-lobsterboard
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
```

Expected:

- `dailyDecision` exists.
- `dailyDecision.slots` has exactly three items.
- Slot keys are `now`, `watch`, `later`.
- Healthy `now` text is calm and action-free.

## Test Suite

```bash
npm run check -- --runInBand
```

Expected:

- Static lint passes.
- Teddy Homebase API/design tests pass.

## Browser QA

Open:

```text
http://127.0.0.1:8080/pages/teddy-house/
```

Check:

- Status band appears first.
- Daily Decision Strip appears before evidence.
- Healthy state does not show raw telemetry.
- Mobile width has no horizontal overflow.
- Ask Teddy still works.

## Tailscale Auth Smoke

```bash
curl -k -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/
```

Expected unauthenticated result:

```text
302 https://openclaw-mac-mini.tail02a3b6.ts.net:10000/login?next=%2Fpages%2Fteddy-house%2F
```

## If The Strip Looks Wrong

Check the source data first:

```bash
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

Do not fix the copy by hardcoding a nicer sentence. Fix the derived source or ranking rule.

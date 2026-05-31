# Legit Home Dashboard Quickstart

## Local Proof

```bash
cd /Users/teddyclaw/teddy-house-lobsterboard
npm run check -- --runInBand
npm run check:homebase
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/health
curl -sS http://127.0.0.1:8080/api/pages/teddy-house/logs
```

## Live Page

```text
http://127.0.0.1:8080/pages/teddy-house/
```

Expected first-screen order:

1. Status
2. Incident, only when active
3. Now / Watch / Later
4. Review
5. House state
6. Mac vitals
7. Ask Teddy
8. Evidence
9. Changes
10. Local links

## Public Auth Smoke

```bash
curl -k -i https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/
curl -k -i https://openclaw-mac-mini.tail02a3b6.ts.net:10000/api/pages/teddy-house/health
```

Expected:

- Page redirects to `/login?next=...`
- API returns `401`

## Replay Harness Target

The quick smoke includes:

```bash
npm run check:homebase
```

Expected:

- Healthy house fixture is quiet.
- Govee/Homebridge loop fixture promotes `Automations`.
- Mac panic fixture promotes `Mac mini`.
- Public route drift fixture promotes `Public access`.
- WAN/DNS degradation fixture promotes `Internet`.
- Teddy fallback fixture says the bridge is degraded instead of pretending it worked.
- Each replay fixture locks headline, summary, primary action, full zone order, and all three `Now / Watch / Later` slots.
- Local Homebase page, health API, and logs API render.
- Phone, iPad, and desktop screenshots are captured to `artifacts/qa/homebase-latest-*.png` when local Chrome is available.
- The latest QA proof JSON is saved to `artifacts/qa/homebase-latest.json`.
- Rendered first-screen assertions confirm loaded copy, house-state ordering, no horizontal overflow, and no raw/scaffold labels in the visible viewport.
- Persisted evidence assertions confirm `timeline.json`, `visual-evidence.json`, `vitals-history.json`, `snapshot.json`, and `service-logs.json` are created, parseable, bounded, and source-linked.
- Public Homebase auth is verified when the Funnel route is reachable. Set `HOMEBASE_REQUIRE_PUBLIC_SMOKE=1` to make that mandatory.

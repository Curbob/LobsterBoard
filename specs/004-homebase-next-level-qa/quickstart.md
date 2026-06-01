# Homebase Next-Level QA Quickstart

## Current Gate

Run the existing release gate first:

```bash
cd /Users/teddyclaw/teddy-house-lobsterboard
npm run check:homebase
```

Expected today:

- static lint passes
- unit/API/design tests pass
- replay contracts pass
- replay story agreement proves fixture API state, locked first-screen contract, and Ask Teddy name the same first action
- rendered replay contracts prove warning fixtures keep the active incident visible in the real page shell
- recorded incident replay proves redacted bad-day bundles still produce the expected first action
- parser golden fixtures cover Homebridge stack continuations, Govee grouping, Eufy ignored evidence, Mac diagnostics, route drift, timestamp freshness, and AdGuard locked/live states
- visual contracts prove phone/iPad/desktop first viewports keep the story visible and evidence below the decision story
- live local story agreement proves API, rendered page, and Ask Teddy name the same first action
- forced Ask Teddy bridge failure proves fallback is labeled honestly in API and UI
- local browser login smoke proves protected API is `401` before sign-in, `200` after sign-in, and still `200` in a new tab
- source contracts prove every house-state source declares trust, freshness, confidence, source, and first-screen eligibility
- local Homebase page, health, logs, and Ask smoke
- public Funnel auth smoke when reachable
- phone/iPad/desktop screenshots when browser automation is available

## Next Gate Target

The next-level gate should extend `npm run check:homebase` with:

```text
storyAgreement: api-page-ask
recordedIncidentReplay: windowserver, govee, teddy-bridge, public-access
parserGoldenFixtures: homebridge, service-logs, macos, tailscale, adguard
visualContracts: phone, ipad, desktop
renderedReplayContracts: warning-fixtures-phone
loginPersistence: local-browser-context
sourceContracts: all-visible-home-state-sources
```

## Manual Device Smoke

Use this when Dan wants real-device proof. The canonical checklist is:

`specs/004-homebase-next-level-qa/checklists/mobile-login-smoke.md`

Fast path:

1. Open the public Funnel Homebase URL on Android Chrome.
2. Confirm saved login or existing session gets to the dashboard.
3. Reload the page.
4. Confirm no surprise password prompt.
5. Repeat on iPhone/iPad PWA.
6. Confirm first screen says the same first action as the local Mac page.

## Done Means

This spec is done only when Homebase can prove the same story across:

- replay fixtures
- recorded incidents
- live local route
- rendered first viewport
- Ask Teddy response
- cached-login smoke

Anything less is useful progress, not the next-level bar.

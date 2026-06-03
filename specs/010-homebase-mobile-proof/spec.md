# Homebase Mobile Proof Spec

## Decision

Make real-device Homebase proof durable without pretending desktop automation is a phone.

The proof command validates a JSON artifact from Android Chrome, iPhone Home Screen PWA, and iPad Home Screen PWA. If the artifact is missing, Homebase stays honest and reports `partial`.

## User Outcome

Dan can see whether saved-login and first-screen trust were actually proved on real devices.

## Acceptance Criteria

- `npm run homebase:mobile-proof` reads `artifacts/qa/homebase-mobile-proof-latest.json`.
- Missing proof reports `partial`, not `ok`.
- `HOMEBASE_REQUIRE_MOBILE_PROOF=1 npm run homebase:mobile-proof` fails unless all required devices pass.
- Required devices are `android-chrome`, `iphone-pwa`, and `ipad-pwa`.
- Each device proof must include login persistence, first action, no overflow, raw telemetry hidden, and Ask Teddy usable or fallback visible.
- The test ladder can use the proof artifact to move real-device saved login from `partial` to `ok`.

## Non-Goals

- No fake phone proof.
- No app install, account change, credential storage, route change, or service mutation.

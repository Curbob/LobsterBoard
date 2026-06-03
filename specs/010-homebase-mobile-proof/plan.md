# Homebase Mobile Proof Plan

## Artifact

`artifacts/qa/homebase-mobile-proof-latest.json`

Required fields:

- `version`
- `capturedAt`
- `publicUrl`
- `devices`

Each device:

- `id`
- `status`
- `loginPersisted`
- `firstAction`
- `askUsable` or `fallbackVisible`
- `noOverflow`
- `rawTelemetryHidden`
- optional `screenshot`

## Devices

- Android Chrome
- iPhone Home Screen PWA
- iPad Home Screen PWA

## Safety

The validator is read-only. Capturing the artifact remains a real-device/manual or approved ADB workflow.

# Homebase Next-Level QA Trust Checklist

## Story Agreement

- [x] API, rendered page, and Ask Teddy agree on the first action for the live local smoke.
- [ ] Ask Teddy fallback is honest and visible.
- [x] No replay can pass when the first review item disagrees with the first warned zone.
- [ ] No replay can pass when rendered copy hides the active incident.

## Incident Replay

- [x] At least one recorded real incident bundle is replayed in QA.
- [x] Redacted incident bundles preserve timestamps and source paths.
- [x] Recorded incidents do not depend on the live Mac mini being in the same state.
- [x] Incident tests fail when raw log counts replace decision copy.

## Parser Trust

- [x] Homebridge stack continuations do not inflate issue counts.
- [x] Govee noise is grouped as one named issue.
- [x] Eufy lock/plugin noise cannot become trusted house state.
- [x] macOS diagnostics must be fresh before they promote Mac mini.
- [x] Tailscale and AdGuard locked/degraded states are labeled plainly.

## Visual Trust

- [x] First viewport shows the top story on phone.
- [x] First viewport shows the review lane when warning exists.
- [x] Healthy first viewport stays short and free of raw telemetry.
- [x] Evidence stays below the decision story.
- [x] Recent changes are grouped and deduplicated.

## Login Trust

- [x] Cached login works in an isolated browser context.
- [x] Public API still returns unauthenticated when no session exists.
- [ ] Android/iOS manual login persistence smokes are documented.

## Source Trust

- [ ] Every source declares freshness, confidence, and source path.
- [ ] Every source declares trusted, degraded, ignored, or needs-login status.
- [ ] Unknown source states cannot render as trusted house state.
- [ ] New charts require persisted backing data.

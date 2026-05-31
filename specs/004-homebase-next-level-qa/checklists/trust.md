# Homebase Next-Level QA Trust Checklist

## Story Agreement

- [x] API, rendered page, and Ask Teddy agree on the first action for the live local smoke.
- [ ] Ask Teddy fallback is honest and visible.
- [x] No replay can pass when the first review item disagrees with the first warned zone.
- [ ] No replay can pass when rendered copy hides the active incident.

## Incident Replay

- [ ] At least one recorded real incident bundle is replayed in QA.
- [ ] Redacted incident bundles preserve timestamps and source paths.
- [ ] Recorded incidents do not depend on the live Mac mini being in the same state.
- [ ] Incident tests fail when raw log counts replace decision copy.

## Parser Trust

- [ ] Homebridge stack continuations do not inflate issue counts.
- [ ] Govee noise is grouped as one named issue.
- [ ] Eufy lock/plugin noise cannot become trusted house state.
- [ ] macOS diagnostics must be fresh before they promote Mac mini.
- [ ] Tailscale and AdGuard locked/degraded states are labeled plainly.

## Visual Trust

- [ ] First viewport shows the top story on phone.
- [ ] First viewport shows the review lane when warning exists.
- [ ] Healthy first viewport stays short and free of raw telemetry.
- [ ] Evidence stays below the decision story.
- [ ] Recent changes are grouped and deduplicated.

## Login Trust

- [ ] Cached login works in an isolated browser context.
- [ ] Public API still returns unauthenticated when no session exists.
- [ ] Android/iOS manual login persistence smokes are documented.

## Source Trust

- [ ] Every source declares freshness, confidence, and source path.
- [ ] Every source declares trusted, degraded, ignored, or needs-login status.
- [ ] Unknown source states cannot render as trusted house state.
- [ ] New charts require persisted backing data.

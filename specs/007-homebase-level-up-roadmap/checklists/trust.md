# Trust Checklist

- [x] Every first-screen warning maps to a named incident or explicit live probe failure.
- [x] Every incident has source, freshness, confidence, and lifecycle state.
- [x] Ignored, degraded, stale, and needs-login sources cannot drive the primary story.
- [x] Recurring issues are labeled as recurring.
- [x] Resolved issues leave the first action surface.
- [x] Healthy mode hides raw ports, IPs, versions, package counts, log counts, and ignored sources.
- [x] Warning mode names the affected house area before showing raw evidence.
- [x] Ask Teddy reports live, fallback, timeout, and bridge failure distinctly.
- [x] All action paths are read-only or explicit dry-runs unless Dan approves mutation.
- [x] Phone, iPad, and desktop QA use one frozen health payload.
- [x] Public Tailscale access remains passworded.
- [x] Local loopback trust does not expand to remote-looking hosts.

# Trust Checklist

- [ ] Every first-screen warning maps to a named incident or explicit live probe failure.
- [ ] Every incident has source, freshness, confidence, and lifecycle state.
- [ ] Ignored, degraded, stale, and needs-login sources cannot drive the primary story.
- [ ] Recurring issues are labeled as recurring.
- [ ] Resolved issues leave the first action surface.
- [ ] Healthy mode hides raw ports, IPs, versions, package counts, log counts, and ignored sources.
- [ ] Warning mode names the affected house area before showing raw evidence.
- [ ] Ask Teddy reports live, fallback, timeout, and bridge failure distinctly.
- [ ] All action paths are read-only or explicit dry-runs unless Dan approves mutation.
- [ ] Phone, iPad, and desktop QA use one frozen health payload.
- [ ] Public Tailscale access remains passworded.
- [ ] Local loopback trust does not expand to remote-looking hosts.

# Homebase Source Contract Checklist

Use this before any new signal can shape the Homebase first screen.

## Required Fields

- [ ] Stable `id`
- [ ] Plain-language `label`
- [ ] `source` naming the probe, local file, API, or parser
- [ ] `confidence`
- [ ] `freshness`
- [ ] `trust`: `trusted`, `degraded`, `ignored`, or `needs-login`
- [ ] `firstScreenEligible`
- [ ] `usedBy`

## Trust Rules

- [ ] Only `trusted` sources may be first-screen eligible.
- [ ] `degraded`, `ignored`, and `needs-login` sources may appear only as evidence or review context.
- [ ] Door-lock and Eufy plugin state stays `ignored` unless a new trusted lock source is added.
- [ ] AdGuard blocked-query stats stay `needs-login` or degraded until authenticated local stats are available.
- [ ] Persisted history cards must cite their `data/teddy-house/*.json` source.

## Chart Rules

- [ ] No chart renders without persisted backing data.
- [ ] Every chart names its sample count and window.
- [ ] Reboot-scoped Mac vitals must say when the history resets.

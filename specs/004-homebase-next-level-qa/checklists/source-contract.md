# Homebase Source Contract Checklist

Use this before any new signal can shape the Homebase first screen.

## Required Fields

- [x] Stable `id`
- [x] Plain-language `label`
- [x] `source` naming the probe, local file, API, or parser
- [x] `confidence`
- [x] `freshness`
- [x] `trust`: `trusted`, `degraded`, `ignored`, or `needs-login`
- [x] `firstScreenEligible`
- [x] `usedBy`

## Trust Rules

- [x] Only `trusted` sources may be first-screen eligible.
- [x] `degraded`, `ignored`, and `needs-login` sources may appear only as evidence or review context.
- [x] Door-lock and Eufy plugin state stays `ignored` unless a new trusted lock source is added.
- [x] AdGuard blocked-query stats stay `needs-login` or degraded until authenticated local stats are available.
- [x] Persisted history cards must cite their `data/teddy-house/*.json` source.

## Chart Rules

- [x] No chart renders without persisted backing data.
- [x] Every chart names its sample count and window.
- [x] Reboot-scoped Mac vitals must say when the history resets.

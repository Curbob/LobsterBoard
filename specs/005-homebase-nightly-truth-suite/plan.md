# Homebase Nightly Truth Suite Plan

## Phase 1: Canonical Proof Path

Use `npm run check:homebase` as the single command for now.

It already runs:

- static lint
- full Vitest suite
- local Homebase route smoke
- public auth smoke when reachable
- browser-context login persistence
- Ask Teddy live/fallback checks
- replay fixture contracts
- rendered replay screenshots
- source contract checks

## Phase 2: Nightly Verdict

Derive a plain verdict from the existing QA report:

- `Homebase is useful` when all gates are `ok` or explicitly `skipped` for an allowed external reason.
- `Homebase is lying` when first-screen story, source trust, auth, or fallback honesty fails.
- `Homebase needs Dan` when real incidents are detected and correctly ranked.

The first implementation can store this as report metadata. A later automation can post or surface it.

## Phase 3: Scheduled Run

Add a Codex/launchd automation only after the local report contract is stable.

Schedule target:

- nightly around early morning local time
- read-only
- write report and screenshots
- do not restart services
- do not clear sessions or credentials

## Phase 4: Mobile Reality Loop

Keep automated local login persistence, but require manual device smoke after auth/session changes:

- Android Chrome
- iPhone Home Screen PWA
- iPad Home Screen PWA

The checklist lives at:

`specs/004-homebase-next-level-qa/checklists/mobile-login-smoke.md`

## Phase 5: Incident Memory

Promote every real weird day into a redacted replay bundle when it teaches the dashboard a new failure mode.

Current required bundles:

- WindowServer restart incident
- Govee/Homebridge noise
- Teddy bridge fallback
- public access drift

Future candidates:

- AdGuard stats unlock/failure
- Homebridge UI auth drift
- Tailscale preference wedge
- WAN packet loss
- stale Android proof node

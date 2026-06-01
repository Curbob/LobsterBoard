# Homebase Scenario Replay Pack Spec

## Decision

Make Teddy Homebase prove the hard house stories on every QA run.

The dashboard is only useful if Dan can trust the first screen on a normal morning and on a weird one. The scenario replay pack is the product contract for that trust: replay the states that matter, compare the API story, rendered page, and Ask Teddy answer, and fail the suite when they disagree.

## User Outcome

Dan opens Homebase and knows what to do first without reading telemetry.

The replay pack must prove:

- healthy mornings stay quiet
- stale Android proof-node evidence stays evidence-only
- clean post-reboot recovery stays calm when services and system logs are healthy
- post-outage recovery with Homebridge still down leads with automations, not reboot noise
- Homebridge offline becomes a direct automation action, not a generic Mac warning
- AdGuard DNS down becomes a direct DNS action while WAN stays scoped separately
- Tailscale online with Funnel missing becomes public-access review, not tailnet outage
- Mac mini restart incidents outrank routine service noise
- Homebridge or automation loops become one named issue
- public route drift is visible without making expected routes scary
- WAN or DNS degradation is treated as internet quality, not generic service failure
- Teddy bridge failure is labeled honestly as fallback or degraded bridge state
- stale or ignored sources never become trusted house truth

## Required Scenarios

The canonical curated fixture pack is:

- `healthy`
- `stale-android-proof`
- `post-reboot-recovered`
- `post-outage-homebridge-down`
- `homebridge-down`
- `adguard-dns-down`
- `tailscale-funnel-missing`
- `mac-panic`
- `govee-loop`
- `public-exposure-drift`
- `wan-dns-degraded`
- `teddy-bridge-fallback`

Each fixture must lock:

- headline
- first warned zone
- first action
- first review item when there is one
- expected Ask Teddy behavior
- first-screen copy cleanliness

## Recorded Incidents

Curated fixtures are not enough. At least one redacted recorded incident bundle must replay through the same path as the curated fixtures.

Incident bundles must include:

- stable id
- recorded timestamp
- fixture pointer
- expected headline, first zone, and first action
- redacted source snapshots
- redacted log excerpts

## Acceptance Criteria

- `npm run check:homebase` verifies all required curated scenarios.
- Every required scenario proves API, rendered page, and Ask Teddy agree about the first action.
- Rendered replay screenshots prove the first story, review lane, affected zone, vitals, Ask Teddy, and evidence order on phone width.
- Recorded incident bundles replay through the same story-agreement path.
- The healthy scenario fails if raw ports, IPs, package counts, stale labels, degraded labels, ignored Eufy data, or telemetry counts appear as first-screen truth.
- The stale-Android-proof scenario fails if Android proof-node evidence changes the headline, first action, or house-state zones.
- The post-reboot-recovered scenario fails if low uptime alone creates scary restart, reboot, panic, or watchdog copy.
- The post-outage-Homebridge-down scenario fails if low uptime or recovery context outranks the active Homebridge outage.
- The Homebridge-down scenario fails if the Mac mini, internet, or public access outranks the automation outage.
- The AdGuard-DNS-down scenario fails if DNS failure is hidden under generic WAN or service noise.
- The Tailscale-Funnel-missing scenario fails if a missing Homebase public route is treated as healthy Tailscale.
- The Mac restart scenario fails if Homebridge log counts outrank the restart incident.
- The public access scenario fails if known routes are presented as unknown exposure.
- The Teddy bridge scenario fails if fallback is hidden or presented as live Teddy.
- The pack is read-only and does not mutate Homebridge, Tailscale, AdGuard, macOS, OpenClaw, credentials, or route settings.

## Non-Goals

- No fake sensor state.
- No synthetic trends.
- No auto-repair.
- No new dashboard controls just to satisfy replay coverage.

# Teddy Camera → Homebase: How to not burn tokens

This directory is full of probe scripts. **If you're a future agent reading this, the right move is to run a script, not to re-derive the answer in chat.** Every command in this file was extracted from a pattern I was running by hand and burning tokens on.

## What the system is

- **Homebase** is the local dashboard at `http://127.0.0.1:8080`.
- **Teddy Camera server** is the camera+detection pipeline at `http://127.0.0.1:18116`.
- The **bridge** is `server/routes/teddy-camera.cjs` in this repo. It proxies
  camera JSON, builds the friendly feed (`/api/teddy-camera/feed`), and
  rewrites upstream AI-slop into a GSOC+teddy voice (`CAPTION_BANK`).
- The **widget** is `js/widgets/misc.js` (entry: `teddy-camera-events`).
  It polls the feed every 30s and renders rows with icon, message, subline.
- The **detect loop** runs every 15s. It scans 6 frames, runs YOLO11n, writes
  `rolling-batch-latest.json`, and overwrites the previous batch. The proxy
  reads the rolling batch + `/api/events` + TeddyDB to build the feed.
- The **log** is at `~/.local/share/teddy-house/teddy-camera-route.log`.
  One JSON line per event: `feed.step`, `upstream.req`, `upstream.res`,
  `feed`, `proxy.in`, `proxy.out`, `boot`.

## The 8 scripts in `bin/`

| Script | What it does | When to run it |
|---|---|---|
| `teddy-camera-cycle.sh LABEL [WAIT_S]` | Login + trigger + read in one command. Loops up to 3 times to land inside the rolling window. | You want to see the friendly feed right now. |
| `teddy-camera-restart.sh` | Clean restart of the homebase LaunchAgent, wait for port 8080, smoke test. | After editing `server/routes/teddy-camera.cjs` or `server.cjs`. |
| `teddy-camera-verify.sh [LABEL]` | lint + tests + restart + cycle in one command. Exits non-zero on any failure. Prints a GREEN/AMBER/RED verdict. | After any change that might have broken the route or widget. |
| `teddy-camera-ooda-cycle.sh [--loop] [--cycle LABEL]` | Real Observe→Decide→Act cycle. By default runs once. `--loop` keeps cycling. | When something is wrong and you want the loop to pick a fix. |
| `teddy-camera-ooda.sh` | One-shot OODA snapshot: service health + DB state + feed + next-step suggestion. | Quick health check. |
| `teddy-camera-probe.sh LABEL` | Login + simulate + read. The original simple version. | Quick read after a manual simulate. |
| `teddy-camera-raw.sh` | Print the raw upstream captions from `/api/events` and `/api/timeline` to see what we are overriding. | When debugging AI-slop regression. |
| `teddy-camera-tail-log.sh N\|follow` | Tail the structured log with pretty fields. | When you need to know what the proxy did in the last 30s. |

## Common patterns

**You just edited a file. You want to know if it still works:**
```
./bin/teddy-camera-verify.sh
```
This runs lint, all 205 tests, restarts homebase, runs a Tailscale serve check, runs a full detect cycle, and prints a verdict.

**You want to see a fresh detection right now:**
```
LABEL=car ./bin/teddy-camera-cycle.sh
```
Reads the friendly feed, prints SOC + teddy lines.

**You want to know what the upstream was saying (before our voice rewrite):**
```
./bin/teddy-camera-raw.sh
```

**You want the structured log of the last 30 seconds:**
```
./bin/teddy-camera-tail-log.sh follow
```

**You want a health snapshot:**
```
./bin/teddy-camera-ooda.sh
```

**You want to verify Tailscale serve + funnel routes are still in place:**
```
./bin/tailscale-serve-verify.sh
```
Returns GREEN (exit 0), AMBER (exit 1, sub-paths missing), or RED (exit 2, funnels broken). Re-applies funnels from the CLI. Sub-paths must be set in the macOS Tailscale GUI → Preferences → Serve.

## Tailscale URLs (canonical)

The Tailscale setup uses two layers:

**Tailnet routes** (work only when on the tailnet, including from a phone with Tailscale installed):
- `https://openclaw-mac-mini.tail02a3b6.ts.net/house` — homebase (the teddy house page)
- `https://openclaw-mac-mini.tail02a3b6.ts.net/teddycam` — raw teddy camera server
- `https://openclaw-mac-mini.tail02a3b6.ts.net/teddycam-lite` — lite teddycam
- `https://openclaw-mac-mini.tail02a3b6.ts.net/openclaw` — openclaw gateway
- `https://openclaw-mac-mini.tail02a3b6.ts.net/ipad-drop` — ipad drop
- `https://openclaw-mac-mini.tail02a3b6.ts.net/anniversary` — anniversary site
- `https://openclaw-mac-mini.tail02a3b6.ts.net/san-diego-trail` — san diego trail
- `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/` — Teddy Homebase
- `https://openclaw-mac-mini.tail02a3b6.ts.net/api/pages/teddy-house` — teddy house API

**Public Funnel routes** (work from anywhere, no tailnet required, require Funnel enabled in Tailscale admin):
- `https://openclaw-mac-mini.tail02a3b6.ts.net:10000` — homebase (the dashboard)
- `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/api/teddy-camera/feed` — friendly feed (JSON)
- `https://openclaw-mac-mini.tail02a3b6.ts.net:10000/thumbs/<id>.jpg` — detection thumbnails
- `https://openclaw-mac-mini.tail02a3b6.ts.net:8443` — second public service

Auth: homebase requires `DASHBOARD_PASSWORD` (currently `Danno`) at `:10000`. The funnels on this machine are approved for passworded access.

To test from a phone on the tailnet:
1. Install Tailscale, sign in to the same account
2. Open `https://openclaw-mac-mini.tail02a3b6.ts.net:10000`
3. Log in with `Danno`
4. Add the Teddy Camera widget to the dashboard
5. Recent detections render with thumbs, GSOC+teddy voice, and live pulse

## Things that bite if you forget

1. **The detect loop runs every 15s.** If you simulate a detection and then
   sleep 30s, the rolling batch has been overwritten with `hits: 0`. Read
   the feed IMMEDIATELY after simulate. The `cycle.sh` script does this for
   you (3 attempts with 18s sleeps between).

2. **The friendly voice is in `CAPTION_BANK`** in `server/routes/teddy-camera.cjs`.
   To change the copy, edit the bank, then `./bin/teddy-camera-restart.sh`.
   The upstream "Verify the frame" / "Big trash energy" copy is what
   `/api/events` returns and is overridden — never passes through to the
   widget.

3. **There is a regression test that bans the AI-slop strings by name.**
   `tests/teddy-camera-route.test.js` has a `forbids the upstream AI-slop
   strings in the source (regression guard)` test. If you paste "Verify
   the frame" anywhere in the route, that test fails.

4. **Auth is required.** Homebase uses a session cookie. The scripts
   handle this; if you `curl` by hand, log in first with
   `curl -c /tmp/c.txt -X POST http://127.0.0.1:8080/api/auth/login -H
   "Content-Type: application/json" -d '{"password":"Danno"}'`.

5. **The widget renders in the LobsterBoard dashboard.** It is registered
   in `js/widgets/misc.js` as `teddy-camera-events`. It uses the `camera`
   icon. Pull it from the widget picker in the dashboard builder.

6. **Thumbnails from the camera are 960×2080 portrait** (the phone is
   in portrait). The homebase proxy auto-rotates to 2080×960 landscape at
   serve time, with disk caching in `~/.cache/teddy-house/thumbs-rotated/`.
   First request: ~250ms. Cached: ~4ms. Set `TEDDYCAMERA_PYTHON` env to
   point to a different Python venv if needed.

7. **The camera is accessible via two paths:**
   - **Tailnet (Tailscale required):** `https://...ts.net/teddycam/` → camera server directly. Some
     routes will redirect to `/` (303) — the camera's session heal is
     localhost-only, so a phone gets a 303 redirect that doesn't help.
   - **Public Funnel (no Tailscale):** `https://...ts.net:10000/teddycam/`
     → homebase proxy → camera. Homebase injects the Bearer token, so
     the camera lets the request through. The homebase proxy strips the
     `/teddycam` prefix and forwards to the camera's real path.
   - **To make the funnel route work,** the user must add a Tailscale
     serve rule in the macOS Tailscale GUI: Preferences → Serve → add a
     sub-path `/teddycam` under `:10000` pointing to `127.0.0.1:8080/teddycam`.
     The CLI does not support funnel sub-paths.

8. **Logging is deduped.** `detection.new` events fire only when the feed
   fingerprint changes (new item, or item drops out). One line per real
   detection. `feed.step` events fire on every poll (for OODA tracing).
   `thumb.rotate.ok` events track rotation work.

## What I learned (so you don't repeat it)

- Inline `node` and `sqlite3` invocations burn tokens fast. The scripts
  are pre-compiled; running them is much cheaper than asking the agent to
  re-derive.
- "Trigger then read" needs to happen FAST. A 30s wait after a simulate
  loses the detection. The cycle script has 3 attempts to land inside
  the rolling window.
- The log file is the most efficient way to debug the proxy. Every step
  of `buildFeedForWidget` logs with structured fields. Read the last 20
  lines and you can trace what the widget would have shown.
- The OODA cycle is the right outer loop. It has rules: if homebase is
  down, restart; if the feed is stale, run a cycle; if everything is
  green, noop. Don't re-derive these rules in chat.

## File layout

```
teddy-house-lobsterboard/
  bin/
    teddy-camera-cycle.sh            # one-shot detect→read
    teddy-camera-restart.sh          # clean homebase restart
    teddy-camera-verify.sh           # full preflight
    teddy-camera-ooda-cycle.sh       # real OODA loop
    teddy-camera-ooda.sh             # one-shot OODA snapshot
    teddy-camera-probe.sh            # simple login+simulate+read
    teddy-camera-raw.sh              # upstream captions
    teddy-camera-tail-log.sh         # structured log
  server/
    routes/
      teddy-camera.cjs               # the bridge
  js/
    widgets/
      misc.js                        # teddy-camera-events widget
  tests/
    teddy-camera-route.test.js       # unit tests for the route
    teddy-camera-widget-e2e.test.js  # widget render tests
```

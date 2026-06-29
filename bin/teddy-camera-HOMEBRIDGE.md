# Teddy Camera → Homebridge → Apple TV

The teddy camera is exposed as a HomeKit camera accessory via the
`homebridge-camera-ffmpeg` plugin. You can see the live stream on any
Apple TV that's signed into the same iCloud Home setup.

## Auth: why we use a session cookie, not a Bearer token

**TL;DR:** The teddy camera server requires auth on its MJPEG stream and
snapshot endpoints. The homebridge-camera-ffmpeg plugin's source string
gets split on whitespace (`source.split(/\s+/)`), so any value with
a space breaks the plugin's invocation of ffmpeg. The
`Authorization: Bearer <token>` header has a space. The teddy
camera's local session cookie (`Cookie: teddycam_session=...`) is a
single token with no spaces — it works.

If you try to use `Authorization: Bearer <token>`, the plugin will:
- Pass `-headers` correctly
- Then pass `"Authorization:` as the next arg (corrupt)
- Then pass `Bearer`
- Then pass `<token>"`

ffmpeg fails to parse this and exits with code 8. The camera shows
"No response" in Home.app.

The fix is to use `Cookie: teddycam_session=<cookie>` (no space in the
cookie value). The plugin's `split(/\s+/)` keeps it as a single arg,
ffmpeg parses it correctly, and the camera server accepts the session.

The cookie expires periodically (when the homebridge restarts or after
a long idle period). When it does, run the refresh script:

```
/Users/teddyclaw/teddy-house-lobsterboard/bin/teddy-camera-refresh-cookie.py
```

This re-fetches a fresh cookie, rewrites the homebridge config, and
sends SIGHUP to the homebridge so it picks up the new config.

## What's running

- **Plugin:** `homebridge-camera-ffmpeg@3.1.4` (installed globally)
- **Accessory:** `Teddy Front Door 68E3` — manufacturer "Teddy", serial
  `teddy-front-door-1`, with Motion Sensor, Microphone,
  CameraRTPStreamManagement services
- **Stream source:** the teddy camera's MJPEG endpoint at
  `http://127.0.0.1:18116/stream.mjpg`, authenticated via the
  `Cookie: teddycam_session=...` local session
- **Snapshot source:** the camera's `/latest.jpg` endpoint with the same
  cookie
- **Sensor:** `Teddy Front Door Motion Trigger` — wired to the camera
  detection pipeline, exposed as a HomeKit motion sensor + switch

## Where the config lives

The homebridge config is at `~/.homebridge/config.json`. The camera
platform is the last entry under `platforms`:

```json
{
    "platform": "Camera-ffmpeg",
    "name": "Teddy Camera",
    "cameras": [
        {
            "name": "Teddy Front Door",
            "manufacturer": "Teddy",
            "model": "Android ADB MJPEG",
            "serialNumber": "teddy-front-door-1",
            "firmwareRevision": "1.0",
            "motion": true,
            "motionDoorbell": false,
            "switches": true,
            "unbridge": true,
            "videoConfig": {
                "source": "-headers \"Cookie:teddycam_session=<cookie>\" -i http://127.0.0.1:18116/stream.mjpg",
                "stillImageSource": "-headers \"Cookie:teddycam_session=<cookie>\" -i http://127.0.0.1:18116/latest.jpg",
                "maxStreams": 2,
                "maxWidth": 1920,
                "maxHeight": 1080,
                "maxFPS": 10,
                "maxBitrate": 1500,
                "vcodec": "libx264",
                "audio": false,
                "packetSize": 1316
            }
        }
    ]
}
```

**Important notes:**

- The cookie value `<cookie>` is a 43-character base64 string. It's
  baked into the homebridge config at the time of the last refresh.
- **`unbridge: true`** makes the camera a separate HomeKit accessory
  with its own HAP server. This avoids PASE pairing issues with the
  main homebridge and isolates the camera's bandwidth.
- If you rotate the teddy camera's auth token (by deleting
  `~/.config/teddycamera/token` and re-running
  `bin/teddycamera-setup-token`), the session cookies are
  invalidated. Re-pair via Home.app after a token rotation.

## How to see the camera

1. Open the **Home** app on your iPhone / iPad / Mac / Apple TV
2. Tap **+** (top right) → **Add Accessory**
3. Tap **More options...** (or "I don't have a code" / "Add Anyway")
4. Select **`Teddy Front Door 68E3`** from the list
5. When prompted, enter: **`516-28-297`**
6. The app will find the homebridge and pair the camera
7. Assign a room (e.g., "Front Door" or "Driveway")

If the camera doesn't show in the list:
- Make sure your iPhone/Mac is on the same WiFi as this Mac
- Force-quit Home.app and re-open
- Or try the homebridge UI at `http://127.0.0.1:8581`
  - login: `admin` / `admin` (default)
  - **Accessories** tab → find the camera → verify it's enabled

## How the live stream works

When you open the camera tile in Home.app on Apple TV:

1. HomeKit sends an RTP request to the homebridge (port 53358 or whatever the
   current child bridge port is)
2. Homebridge spawns ffmpeg with the configured source command
3. ffmpeg reads the MJPEG stream from the teddy camera (authenticated
   with the local session cookie)
4. ffmpeg transcodes MJPEG → H.264 in real time (libx264, baseline,
   132 kbps, 640x360, 10 fps)
5. ffmpeg serves the H.264 stream back to HomeKit via the
   homebridge's child bridge
6. Apple TV / iPhone shows the live feed

Expected latency: ~1-2 seconds.

## When the cookie expires

The teddy camera's session cookie expires when:
- The homebridge restarts and the camera issues a new session
- The camera server itself restarts
- A long idle period (weeks)

When the cookie expires, the camera shows "No response" in Home.app.
The fix:

```
/Users/teddyclaw/teddy-house-lobsterboard/bin/teddy-camera-refresh-cookie.py
```

This script:
1. Fetches a fresh local-session cookie from `http://127.0.0.1:18116/`
2. Rewrites `~/.homebridge/config.json` with the new cookie baked in
3. Sends SIGHUP to the homebridge main process (PID stays the same,
   the supervisor restarts the children)

The homebridge restart takes ~5-10 seconds. The camera's HAP port
may change (port allocation is dynamic). If the camera disappears
from Home.app after a cookie refresh, re-pair it (Add Accessory →
`Teddy Front Door 68E3` → code `516-28-297`).

## Re-pairing

If the camera is missing from Home.app:

1. Open the homebridge config UI at `http://127.0.0.1:8581`
2. Go to **Accessories** → find the camera → verify it's not greyed out
3. If the camera is there but not in Home.app, re-pair: in the Home.app,
   "Add Accessory" → enter the homebridge code `516-28-297`

## Restarting homebridge (after config edits)

```
# Stop the running instance
sudo hb-service stop

# Start it back
sudo hb-service start

# Or for debugging
hb-service run
```

If you can't sudo, run it as your user:

```
nohup hb-service run > /tmp/hb-service.log 2>&1 &
```

This won't survive a logout, so use sudo in production.

## Known limitations

- The MJPEG stream from the teddy camera is at `960×2080` portrait
  (Android phone in landscape inside a portrait device). The plugin
  transposes it to landscape for HomeKit. There may be orientation
  quirks.
- Audio is disabled (`"audio": false`). The teddy camera does
  intentionally not record audio per the privacy contract.
- The homebridge plugin is a thin wrapper over ffmpeg. If the
  underlying MJPEG stream drops, ffmpeg will throw a
  `Connection refused` or `Invalid data` error, and the camera will
  show a generic HomeKit error.
- The camera is added as a "private" accessory — only the paired
  HomeKit controller can see it.
- The HAP port (53358 by default) is dynamic. It changes whenever
  the homebridge supervisor restarts. If Home.app loses the camera,
  re-pair.

## Privacy

- No face recognition. No plate OCR. No identity tracking. The
  stream is MJPEG → H.264 with no metadata overlay.
- Recordings are not stored on the homebridge. HomeKit's "Recordings"
  feature requires iCloud+ (or a HomeKit Secure Video hub) and is
  disabled by default.
- If you want motion events to trigger anything, the camera's motion
  sensor is exposed as a HomeKit Motion Sensor (`Teddy Front Door
  Motion Trigger`). Wire it to HomeKit Automations as needed.

## Files

- `~/.homebridge/config.json` — the homebridge config (cameras section)
- `~/.homebridge/persist/AccessoryInfo.0E17595CCA91.json` — the cached
  camera accessory state (UUID stays stable across homebridge restarts)
- `~/.homebridge/homebridge.log` — the homebridge log
- `~/Library/Logs/TeddyHouse/lobsterboard.{out,err}.log` — supervised
  homebridge stdout/stderr
- `bin/teddy-camera-refresh-cookie.py` — refresh the session cookie
  baked into the homebridge camera config

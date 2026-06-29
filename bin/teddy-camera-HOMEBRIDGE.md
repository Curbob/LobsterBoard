# Teddy Camera → Homebridge → Apple TV

The teddy camera is exposed as a HomeKit camera accessory via the
`homebridge-camera-ffmpeg` plugin. You can see the live stream on any
Apple TV that's signed into the same iCloud Home setup.

## Auth: how it actually works (after many rounds of debugging)

The teddy camera server (port 18116) requires auth on its MJPEG
stream and snapshot endpoints. We tried three approaches before
finding the one that works:

| Approach | Why it failed |
|----------|---------------|
| `Authorization: Bearer <token>` | The homebridge-camera-ffmpeg plugin does `source.split(/\s+/)`. With `Bearer <token>` (a space in the value), the split mangles the args. ffmpeg exits with code 8. |
| `Cookie: teddycam_session=<cookie>` | ffmpeg's `-headers` format requires CRLF at the end of the cookie value. The teddy camera's custom cookie parser doesn't strip the trailing `\r`, so it returns 400. |
| **`?token=<token>` in the URL via `bin/teddy-camera-shim.mjs`** | **Works.** No spaces, no CRLF. The shim authenticates the URL query, fetches a session cookie, and proxies to the camera with that cookie. |

The shim runs on `http://127.0.0.1:18118/`. It validates `?token=<camera-token>` and proxies to the camera with the proper cookie. The homebridge config uses the shim URL.

If the camera token rotates (by deleting `~/.config/teddycamera/token` and re-running `bin/teddycamera-setup-token`), update the homebridge config's `?token=` value and restart homebridge. The shim reads the token from the same file at startup, so a shim restart picks up the new token.

## What's running

- **Shim:** `bin/teddy-camera-shim.mjs` — listens on `127.0.0.1:18118`, validates `?token=<camera-token>`, bootstraps a session cookie from the camera, and proxies with that cookie
- **Plugin:** `homebridge-camera-ffmpeg@3.1.4` (installed globally)
- **Accessory:** `Teddy Front Door 68E3` — manufacturer "Teddy", serial `teddy-front-door-1`, with Motion Sensor, Microphone, CameraRTPStreamManagement services
- **Stream source:** `http://127.0.0.1:18118/stream.mjpg?token=<token>` (via the shim)
- **Snapshot source:** `http://127.0.0.1:18118/latest.jpg?token=<token>` (via the shim)

## How to start the shim automatically

The shim needs to be running for the homebridge to access the camera.
Start it via a LaunchAgent or in the background:

```bash
nohup node /Users/teddyclaw/teddy-house-lobsterboard/bin/teddy-camera-shim.mjs > /tmp/teddy-shim.log 2>&1 &
```

Or add a LaunchAgent at `~/Library/LaunchAgents/com.teddycamera.shim.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.teddycamera.shim</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/teddyclaw/teddy-house-lobsterboard/bin/teddy-camera-shim.mjs</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.teddycamera.shim.plist
```

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
                "source": "-i http://127.0.0.1:18118/stream.mjpg?token=<token>",
                "stillImageSource": "-i http://127.0.0.1:18118/latest.jpg?token=<token>",
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

- The `<token>` in the URL is the camera token. If you rotate it,
  update the URL and restart homebridge (or run the SIGHUP trick).
- **`unbridge: true`** makes the camera a separate HomeKit accessory
  with its own HAP server. This avoids PASE pairing issues with the
  main homebridge and isolates the camera's bandwidth.
- The shim URL has no spaces in it. The plugin's `source.split(/\s+/)`
  leaves it intact.
- The HAP port is dynamic. Each homebridge restart gets a new port.
  Re-pair in Home.app if the port changes.

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

1. HomeKit sends an RTP request to the homebridge (port `60025` or whatever the current child bridge port is)
2. Homebridge spawns ffmpeg with the configured source command
3. ffmpeg reads the MJPEG stream from the shim at `http://127.0.0.1:18118/stream.mjpg?token=...`
4. The shim fetches a fresh session cookie from the camera (or reuses the cached one) and proxies with that cookie
5. The camera returns the MJPEG stream
6. The shim pipes the MJPEG back to ffmpeg
7. ffmpeg transcodes MJPEG → H.264 in real time (libx264, baseline, 132 kbps, 640x360, 10 fps)
8. ffmpeg serves the H.264 stream back to HomeKit via the homebridge's child bridge
9. Apple TV / iPhone shows the live feed

Expected latency: ~2-3 seconds (one round-trip through ffmpeg + shim + camera).

## When something breaks

**"No response" in Home.app:**
- The shim is probably not running. Restart it.
- The camera token might have rotated. Update the homebridge config URL.
- The homebridge child bridge may have moved to a new port. Re-pair in Home.app.

**Camera stream is dead in HomeKit but works in ffmpeg directly:**
- The homebridge child bridge may be in a bad state. Restart the homebridge.

**The ffmpeg process keeps dying with code 8:**
- The token in the URL is wrong. Update the homebridge config.

**To restart the shim:**
```bash
pkill -9 -f teddy-camera-shim
nohup node /Users/teddyclaw/teddy-house-lobsterboard/bin/teddy-camera-shim.mjs > /tmp/teddy-shim.log 2>&1 &
```

**To restart the homebridge (and force the camera child bridge to re-create):**
```bash
pkill -f "hb-service"
nohup /opt/homebrew/bin/hb-service run > /tmp/hb.log 2>&1 &
```

The homebridge will pick a new port for the camera child bridge. Look in `~/.homebridge/homebridge.log` for `Teddy Front Door 68E3 is running on port XXXXX`. Re-pair in Home.app with the new port.

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
- The HAP port is dynamic. It changes whenever the homebridge
  supervisor restarts. If Home.app loses the camera, re-pair.

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
- `bin/teddy-camera-shim.mjs` — the URL-auth shim that lets the
  homebridge camera-ffmpeg plugin talk to the teddy camera
- `bin/teddy-camera-refresh-cookie.py` — DEPRECATED. With the shim, we
  no longer need to bake cookies into the homebridge config. Keep
  around in case we revert.

#!/usr/bin/env bash
# teddy-camera-ooda.sh
# One-shot OODA loop. Observe what's in the rolling buffer and the feed,
# then suggest the next action. Saves tokens by automating the discovery
# step that would otherwise eat a long round of inline commands.

set -euo pipefail

HOMEBASE="${HOMEBASE:-http://127.0.0.1:8080}"
PASSWORD="${DASHBOARD_PASSWORD:-Danno}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/teddycamera-ooda-cookies.txt}"
REPO="${TEDDYCAMERA_REPO:-/Users/teddyclaw/Documents/Codex/2026-06-25/teddycamera}"
BUFFER="${ARTIFACT_BUFFER:-/Users/teddyclaw/Documents/Codex/2026-05-17/hey-i-added-my-android-phone/artifacts/android/delivery-buffer}"

echo "================================================================"
echo "  OODA LOOP: Teddy Camera + Homebase feed"
echo "================================================================"

echo ""
echo "[OBSERVE] Service health"
for p in 8080 18116 8554; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "  port $p: UP"
  else
    echo "  port $p: DOWN"
  fi
done

echo ""
echo "[OBSERVE] Detect loop state"
if [ -f "$REPO/artifacts/android/delivery-detect-loop/state.json" ] 2>/dev/null; then
  cat "$REPO/artifacts/android/delivery-detect-loop/state.json" 2>/dev/null | python3 -c "
import json, sys, time
try:
    d = json.load(sys.stdin)
    last = d.get('last_run_at')
    if last:
        age = int(time.time() - time.mktime(time.strptime(last[:19], '%Y-%m-%dT%H:%M:%S')))
        print(f'  state: {d.get(\"state\")}, last_run: {age}s ago, hits: {d.get(\"last_hits\")}, scanned: {d.get(\"last_scanned\")}')
    else:
        print('  no last_run_at')
except Exception as e:
    print(f'  (could not parse: {e})')
" 2>/dev/null
fi

echo ""
echo "[OBSERVE] Last 5 detection events in TeddyDB"
sqlite3 /Users/teddyclaw/Data/clawdb "
SELECT datetime(captured_at, 'unixepoch', 'localtime') AS localtime,
       event_type, source, labels_json, severity
FROM teddy_camera_events
WHERE event_type IN ('person','vehicle','delivery','package')
  AND source != 'camera-quality-scout'
ORDER BY captured_at DESC
LIMIT 5;
" 2>/dev/null | sed 's/^/  /'

echo ""
echo "[OBSERVE] Motion in last 60s of buffer"
LATEST=$(ls -t "$BUFFER"/*.jpg 2>/dev/null | head -20 || true)
if [ -n "$LATEST" ]; then
  echo "$LATEST" | head -3 | python3 -c "
import sys, os
from pathlib import Path
# Lightweight motion check on the most recent 5 frames
files = list(sys.stdin)[:5]
print(f'  (python motion check requires cv2, skipping) recent files: {len(files)}')
"
fi

echo ""
echo "[ORIENT] Login + fetch homebase feed"
curl -s -c "$COOKIE_JAR" -X POST "$HOMEBASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" | head -1
echo ""

echo "[ORIENT] Homebase feed summary"
RESP=$(curl -s -b "$COOKIE_JAR" "$HOMEBASE/api/teddy-camera/feed" 2>&1)
echo "$RESP" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f'  ok: {d.get(\"ok\")}, items: {d.get(\"item_count\", 0)}, source: {d.get(\"source\", \"?\")}')
    if d.get('error'):
        print(f'  error: {d.get(\"error\")}')
    for it in d.get('items', []):
        print(f'  - {it[\"message\"]}')
        if it.get('hand_off'):
            print(f'      SOC: {it[\"hand_off\"][:120]}')
except Exception as e:
    print(f'  (parse error: {e})')
" 2>/dev/null

echo ""
echo "[DECIDE] Suggested next action"
# A real OODA loop would have decision logic here. For now: tell the user
# the obvious next step based on the observed state.
LATEST_FEED_AGE=$(curl -s -b "$COOKIE_JAR" "$HOMEBASE/api/teddy-camera/feed" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if d.get('items'):
        a = d['items'][0].get('age_seconds', 999999)
        print(a)
    else:
        print('empty')
except: print('error')
" 2>/dev/null)
echo "  - If you want a fresh detection: LABEL=car /path/to/teddy-camera-probe.sh"
echo "  - If you want the log: /path/to/teddy-camera-tail-log.sh follow"
echo "  - If you want a clean restart: launchctl kickstart -k gui/\$(id -u)/com.teddy.house-lobsterboard"

echo ""
echo "[ACT] OODA loop complete. Inspect the feed and the log before the next round."

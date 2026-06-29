#!/usr/bin/env bash
# teddy-camera-probe.sh
# Probe the Teddy Camera + Homebase feed end-to-end.
# Save tokens: this is a single bash command that does what would otherwise
# take a long OODA round to script inline.

set -euo pipefail

HOMEBASE="${HOMEBASE:-http://127.0.0.1:8080}"
TEDDYCAMERA="${TEDDYCAMERA:-http://127.0.0.1:18116}"
PASSWORD="${DASHBOARD_PASSWORD:-Danno}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/teddycamera-probe-cookies.txt}"

if [ -z "${LABEL:-}" ]; then
  echo "Usage: LABEL=car $0 [verbose]"
  echo "  LABEL    what to simulate (person|car|truck|dog|...)"
  echo "  verbose  print full JSON"
  echo ""
  echo "Examples:"
  echo "  LABEL=car ./teddy-camera-probe.sh           # simulate, login, fetch"
  echo "  LABEL=car ./teddy-camera-probe.sh verbose   # also print full JSON"
  exit 1
fi

echo "=== STEP 1: Login to Homebase ==="
curl -s -c "$COOKIE_JAR" -X POST "$HOMEBASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" | head -1
echo

echo "=== STEP 2: Verify Homebase up ==="
if ! lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "Homebase not running. Start it with: launchctl kickstart -k gui/\$(id -u)/com.teddy.house-lobsterboard"
  exit 1
fi
echo "  Homebase: up"
if ! lsof -nP -iTCP:18116 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "Teddy Camera not running."
  exit 1
fi
echo "  Teddy Camera: up"
echo

echo "=== STEP 3: Trigger detection: $LABEL ==="
REPO="${TEDDYCAMERA_REPO:-/Users/teddyclaw/Documents/Codex/2026-06-25/teddycamera}"
node "$REPO/scripts/teddycamera-detect-sweep.mjs" --simulate-detect "$LABEL" 2>&1 | tail -1
sleep 1
echo

echo "=== STEP 4: Read Homebase feed ==="
RESP=$(curl -s -b "$COOKIE_JAR" "$HOMEBASE/api/teddy-camera/feed")

if [ "${1:-}" = "verbose" ]; then
  echo "$RESP" | python3 -m json.tool
else
  echo "$RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'ok: {d.get(\"ok\")}  items: {d.get(\"item_count\", 0)}')
for it in d.get('items', []):
    line = it.get('message', '')
    if it.get('caption'):
        line += '  //  ' + it['caption']
    print(f'  {line}')
"
fi
echo

echo "=== STEP 5: Read raw TeddyDB (last 5 detection events) ==="
sqlite3 /Users/teddyclaw/Data/clawdb "
SELECT datetime(captured_at, 'unixepoch', 'localtime') AS localtime,
       event_type, source, labels_json, severity
FROM teddy_camera_events
WHERE event_type IN ('person','vehicle','delivery','package')
  AND source != 'camera-quality-scout'
ORDER BY captured_at DESC
LIMIT 5;
" 2>/dev/null

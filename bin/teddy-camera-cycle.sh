#!/usr/bin/env bash
# teddy-camera-cycle.sh
# One full detection cycle: login -> trigger -> wait for detect -> read feed.
# Saves tokens by collapsing the manual pattern I've been repeating.
#
# Usage:
#   ./teddy-camera-cycle.sh car          # wait default 18s
#   ./teddy-camera-cycle.sh car 25       # custom wait seconds
#   ./teddy-camera-cycle.sh car 25 verbose
#
# Why 18s default: the detect loop runs every 15s. Waiting 18s after
# a simulate lets the next cycle pick up the injected frame.

set -euo pipefail

HOMEBASE="${HOMEBASE:-http://127.0.0.1:8080}"
PASSWORD="${DASHBOARD_PASSWORD:-Danno}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/teddycamera-cycle-cookies.txt}"
REPO="${TEDDYCAMERA_REPO:-/Users/teddyclaw/Documents/Codex/2026-06-25/teddycamera}"

LABEL="${1:-car}"
WAIT_S="${2:-18}"
VERBOSE="${3:-}"

if [ -z "$LABEL" ] || [ "$LABEL" = "--help" ] || [ "$LABEL" = "-h" ]; then
  cat <<'EOF'
teddy-camera-cycle.sh — full detect → wait → read

Usage:
  ./teddy-camera-cycle.sh LABEL [WAIT_SECONDS] [verbose]

Arguments:
  LABEL         YOLO label to inject (person|car|truck|dog|bicycle|...)
  WAIT_SECONDS  Seconds to wait for the next detect cycle (default 18)
  verbose       Print full JSON, not the summary

Examples:
  ./teddy-camera-cycle.sh car
  ./teddy-camera-cycle.sh person 25
  ./teddy-camera-cycle.sh truck 30 verbose
EOF
  exit 0
fi

# Pre-flight: services up?
if ! lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "FATAL: Homebase not running on 8080. Start it first."
  exit 1
fi
if ! lsof -nP -iTCP:18116 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "FATAL: Teddy Camera not running on 18116. Start it first."
  exit 1
fi

echo "[1/4] Login to Homebase"
curl -s -c "$COOKIE_JAR" -X POST "$HOMEBASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" | head -1
echo

# Strategy: trigger then read immediately. The rolling-batch only carries the
# simulated hit until the next real detect cycle (15s). If we wait too long
# the cycle overwrites with empty. So: trigger, read, then if empty wait
# one full cycle and try again.
ITEMS=0
RESP=""
for attempt in 1 2 3; do
  echo "[2/4] Trigger detection: $LABEL (attempt $attempt/3)"
  node "$REPO/scripts/teddycamera-detect-sweep.mjs" --simulate-detect "$LABEL" 2>&1 | tail -1
  echo "[3/4] Read Homebase feed (immediate — before next detect cycle overwrites)"
  RESP=$(curl -s -b "$COOKIE_JAR" "$HOMEBASE/api/teddy-camera/feed")
  ITEMS=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('item_count', 0))" 2>/dev/null || echo 0)
  if [ "$ITEMS" -ge 1 ]; then
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    echo "  no items (rolling window may have rolled over); waiting ${WAIT_S}s for next cycle"
    sleep "$WAIT_S"
  fi
done

echo "[4/4] Read Homebase feed"
if [ "$VERBOSE" = "verbose" ]; then
  echo "$RESP" | python3 -m json.tool
else
  echo "$RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'ok: {d.get(\"ok\")}, items: {d.get(\"item_count\", 0)}')
if d.get('error'):
    print(f'error: {d.get(\"error\")}')
for it in d.get('items', []):
    print(f'  {it[\"message\"]}')
    if it.get('soc'):
        print(f'      SOC:   {it[\"soc\"]}')
    if it.get('teddy'):
        print(f'      teddy: {it[\"teddy\"]}')
"
fi

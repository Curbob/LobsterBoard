#!/usr/bin/env bash
# teddy-camera-restart.sh
# Clean restart of the homebase LaunchAgent that runs the teddy-camera route.
# Waits for it to be reachable before returning. Use after editing
# server/routes/teddy-camera.cjs, server.cjs, or the widget modules.
#
# Usage:
#   ./teddy-camera-restart.sh              # restart + wait
#   ./teddy-camera-restart.sh --no-wait    # restart, don't wait
#
# Why this exists: kickstart -k returns immediately. The port may still be
# down for a second or two while the venv warms up. Burning tokens waiting
# for the next test run is wasteful.

set -euo pipefail

LABEL="${TEDDYCAMERA_AGENT:-com.teddy.house-lobsterboard}"
WAIT_TIMEOUT="${TEDDYCAMERA_RESTART_TIMEOUT:-15}"

if [ "${1:-}" = "--no-wait" ]; then
  launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1
  echo "kickstart sent (not waiting)"
  exit 0
fi

echo "[1/3] kickstart -k gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>&1 | head -1 || true

echo "[2/3] wait for port 8080 (timeout ${WAIT_TIMEOUT}s)"
elapsed=0
while [ "$elapsed" -lt "$WAIT_TIMEOUT" ]; do
  if lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "  homebase listening after ${elapsed}s"
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

if ! lsof -nP -iTCP:8080 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "FATAL: homebase did not come back up in ${WAIT_TIMEOUT}s"
  echo "  tail the LaunchAgent log: tail -n 30 ~/Library/Logs/TeddyHouse/lobsterboard.err.log"
  exit 1
fi

echo "[3/3] smoke test: GET /api/teddy-camera/health"
PASSWORD="${DASHBOARD_PASSWORD:-Danno}"
COOKIE_JAR="/tmp/teddycamera-restart-cookies.txt"
curl -s -c "$COOKIE_JAR" -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" >/dev/null
curl -s -b "$COOKIE_JAR" http://127.0.0.1:8080/api/teddy-camera/health
echo

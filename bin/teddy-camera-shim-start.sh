#!/usr/bin/env bash
# teddy-camera-shim-start.sh
# Start the URL-auth shim that lets the homebridge camera-ffmpeg plugin
# talk to the teddy camera without CR/LF or whitespace bugs in the
# ffmpeg -headers format.
#
# Usage:
#   ./teddy-camera-shim-start.sh          # start in foreground (Ctrl+C to stop)
#   ./teddy-camera-shim-start.sh --bg     # start in background, return immediately
#   ./teddy-camera-shim-start.sh --stop   # kill the running shim
#   ./teddy-camera-shim-start.sh --status  # print whether the shim is running

set -euo pipefail

HOMEBRIDGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIM="$HOMEBRIDGE_ROOT/bin/teddy-camera-shim.mjs"
LOG="${TEDDYCAMERA_SHIM_LOG:-/tmp/teddy-shim.log}"
PIDFILE="${TEDDYCAMERA_SHIM_PID:-/tmp/teddy-shim.pid}"

is_running() {
  if [ -f "$PIDFILE" ]; then
    local pid
    pid=$(cat "$PIDFILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

case "${1:-}" in
  --stop)
    if is_running; then
      pid=$(cat "$PIDFILE")
      echo "Stopping shim (PID $pid)..."
      kill "$pid"
      sleep 1
      rm -f "$PIDFILE"
      echo "  Stopped"
    else
      echo "Shim is not running"
      pkill -f "teddy-camera-shim.mjs" 2>/dev/null || true
    fi
    exit 0
    ;;
  --status)
    if is_running; then
      pid=$(cat "$PIDFILE")
      port=$(lsof -nP -iTCP -p "$pid" -sTCP:LISTEN 2>/dev/null | awk '$5 ~ /TCP/ {print $9}' | head -1)
      echo "  shim is running (PID $pid) on $port"
    else
      echo "  shim is NOT running"
    fi
    exit 0
    ;;
esac

# Start
if is_running; then
  echo "Shim is already running:"
  cat "$PIDFILE"
  echo
  echo "Use --stop to kill it first, or --status to see info."
  exit 0
fi

# Verify the camera token file exists
TOKEN_FILE="$HOME/.config/teddycamera/token"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "FATAL: camera token not found at $TOKEN_FILE"
  echo "  Run bin/teddycamera-setup-token to create one."
  exit 1
fi

# Verify ffmpeg and node are available
command -v /opt/homebrew/bin/node >/dev/null 2>&1 || command -v node >/dev/null 2>&1 || {
  echo "FATAL: node not found on PATH"
  exit 1
}

# Launch
if [ "${1:-}" = "--bg" ]; then
  nohup node "$SHIM" > "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 2
  echo "  shim started in background, PID $(cat "$PIDFILE"), log=$LOG"
  "$0" --status
else
  echo "Starting shim in foreground (Ctrl+C to stop)..."
  trap 'echo "shim stopped"' INT TERM
  node "$SHIM"
fi

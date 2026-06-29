#!/usr/bin/env bash
# teddy-camera-tail-log.sh
# Tail the structured log for the teddy-camera route. Useful during OODA loops.
#
# Usage:
#   ./teddy-camera-tail-log.sh          # last 20 events
#   ./teddy-camera-tail-log.sh 50       # last 50 events
#   ./teddy-camera-tail-log.sh follow   # follow live (like tail -f)

set -euo pipefail

LOG="${TEDDYCAMERA_LOG_FILE:-$HOME/.local/share/teddy-house/teddy-camera-route.log}"

if [ ! -f "$LOG" ]; then
  echo "Log not found: $LOG"
  echo "Trigger a feed request to create it: LABEL=car /path/to/teddy-camera-probe.sh"
  exit 1
fi

case "${1:-20}" in
  follow|f)
    tail -F "$LOG" | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        d = json.loads(line)
        ts = d.get('ts', '')[11:23]
        ev = d.get('event', '?')
        details = {k: v for k, v in d.items() if k not in ('ts', 'event') and v not in (None, '', 0)}
        print(f'{ts}  {ev:18s}  {details}')
    except:
        print(line)
"
    ;;
  *)
    tail -n "$1" "$LOG" | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        d = json.loads(line)
        ts = d.get('ts', '')[11:23]
        ev = d.get('event', '?')
        details = {k: v for k, v in d.items() if k not in ('ts', 'event') and v not in (None, '', 0)}
        print(f'{ts}  {ev:18s}  {details}')
    except:
        print(line)
"
    ;;
esac

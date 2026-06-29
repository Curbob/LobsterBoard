#!/usr/bin/env bash
# teddy-camera-raw.sh
# Show the raw upstream captions that the homebase feed is currently passing through.
# This is the AI-slop detection — use it to find which captions need rewriting.

set -euo pipefail

HOMEBASE="${HOMEBASE:-http://127.0.0.1:8080}"
TEDDYCAMERA="${TEDDYCAMERA:-http://127.0.0.1:18116}"
PASSWORD="${DASHBOARD_PASSWORD:-Danno}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/teddycamera-probe-cookies.txt}"

curl -s -c "$COOKIE_JAR" -X POST "$HOMEBASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$PASSWORD\"}" >/dev/null

echo "=== Raw /api/events (titles and captions we currently inherit) ==="
curl -s -b "$COOKIE_JAR" "$TEDDYCAMERA/api/events" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for ev in d.get('events', []):
    if not ev.get('labels'):
        continue
    print(f'  type: {ev.get(\"event_type\") or ev.get(\"type\") or \"?\"}')
    print(f'    title:   {ev.get(\"title\")!r}')
    print(f'    caption: {ev.get(\"caption\")!r}')
    print(f'    labels:  {ev.get(\"labels\")}')
    print()
"

echo "=== Raw /api/timeline highlights ==="
curl -s -b "$COOKIE_JAR" "$TEDDYCAMERA/api/timeline" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for h in d.get('highlights', []):
    if not h.get('signal'):
        continue
    print(f'  kind:    {h[\"kind\"]}')
    print(f'    title:   {h.get(\"title\")!r}')
    print(f'    caption: {h.get(\"caption\")!r}')
    print(f'    signal:  {h.get(\"signal\")}')
    print()
"

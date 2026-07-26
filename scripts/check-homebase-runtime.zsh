#!/bin/zsh

set -euo pipefail

repo_root="${0:A:h:h}"
target="$HOME/Library/LaunchAgents/com.teddy.house-lobsterboard.plist"
rendered="$(mktemp -t homebase-runtime-check.XXXXXX)"
trap 'rm -f "$rendered"' EXIT

"$repo_root/scripts/install-homebase-launchagent.zsh" --render "$rendered" >/dev/null
[[ -f "$target" ]] || { print -u2 "Homebase runtime: LaunchAgent plist missing."; exit 1; }
/usr/bin/cmp -s "$rendered" "$target" || { print -u2 "Homebase runtime: installed plist drifted from repo template."; exit 1; }
! /usr/bin/grep -q '<key>DASHBOARD_PASSWORD</key>' "$target" || { print -u2 "Homebase runtime: plaintext password key found in plist."; exit 1; }
/bin/launchctl print "gui/$(id -u)/com.teddy.house-lobsterboard" | /usr/bin/grep -q 'state = running'
health="$(/usr/bin/curl -fsS http://127.0.0.1:8080/api/pages/teddy-house/health)"
score="$(print -r -- "$health" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("score", ""))')"
[[ "$score" == <-> ]] || { print -u2 "Homebase runtime: health score missing."; exit 1; }
url="$("$repo_root/scripts/homebase-android-open.zsh" --print-url)"
[[ "$url" == "https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/" ]] || {
  print -u2 "Homebase runtime: Android route drifted."
  exit 1
}
print "Homebase runtime: installed config matches repo; service running; score=$score; Android route approved."

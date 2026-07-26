#!/bin/zsh

set -euo pipefail

canonical_url="https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/"
requested_url="${HOMEBASE_ANDROID_URL:-$canonical_url}"

case "$requested_url" in
  https://openclaw-mac-mini.tail02a3b6.ts.net/pages/teddy-house|https://openclaw-mac-mini.tail02a3b6.ts.net/pages/teddy-house/)
    requested_url="$canonical_url"
    ;;
esac

if [[ "${1:-}" == "--print-url" ]]; then
  print -- "$requested_url"
  exit 0
fi

command -v adb >/dev/null 2>&1 || { print -u2 "Homebase Android: adb not found."; exit 127; }
serial="${ANDROID_SERIAL:-$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')}"
[[ -n "$serial" ]] || { print -u2 "Homebase Android: no authorized device."; exit 2; }

adb -s "$serial" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb -s "$serial" shell am start -a android.intent.action.VIEW -d "$requested_url" >/dev/null
print "device_serial=$serial"
print "launched_url=$requested_url"

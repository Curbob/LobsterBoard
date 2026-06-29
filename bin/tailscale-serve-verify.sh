#!/usr/bin/env bash
# tailscale-serve-verify.sh
# Verify and re-apply what we can from the CLI. Sub-paths (e.g. /house,
# /teddycam) are managed by the macOS Tailscale GUI and cannot be set from
# the CLI — this script detects drift on the parts we CAN control (public
# Funnels + the root-level serve) and reports on the sub-paths so a human
# knows to re-add them via the GUI.
#
# Usage:
#   ./tailscale-serve-verify.sh          # print status, fix what we can
#   ./tailscale-serve-verify.sh --quiet  # exit silently if GREEN
#   ./tailscale-serve-verify.sh --json   # machine-readable output

set -euo pipefail

QUIET=0
JSON=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --json) JSON=1 ;;
    --help|-h)
      sed -n '2,15p' "$0"
      exit 0
      ;;
  esac
done

say() { if [ "$QUIET" -ne 1 ]; then echo "$@"; fi; return 0; }

# Resolve the tailnet hostname once.
TAILNET_HOSTNAME="$(tailscale status --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('Self', {}).get('DNSName', '').rstrip('.'))" 2>/dev/null || true)"
if [ -z "$TAILNET_HOSTNAME" ]; then
  TAILNET_HOSTNAME="$(tailscale status 2>/dev/null | awk '/^[[:space:]]*[0-9]+\./ {print $2; exit}')"
fi
if [ -z "$TAILNET_HOSTNAME" ]; then
  echo "FATAL: cannot resolve Tailscale hostname." >&2
  exit 1
fi

# Canonical routes we expect to see. The "sub_path" routes must be set in
# the macOS Tailscale GUI; the CLI can only set "funnel <port> -> <target>".
# We verify both, and try to fix what we can.
EXPECT_FUNNELS=(
  "8443 http://127.0.0.1:1234"
  "10000 http://127.0.0.1:8080"
)
EXPECT_SUBPATHS=(
  "/house http://127.0.0.1:8080/pages/teddy-house"
  "/teddycam http://127.0.0.1:18116"
  "/teddycam-lite http://127.0.0.1:18115/teddycam-lite"
  "/openclaw http://127.0.0.1:18789"
  "/ipad-drop http://127.0.0.1:19080"
  "/anniversary http://127.0.0.1:18209"
  "/san-diego-trail http://127.0.0.1:18211"
  "/pages/teddy-house http://127.0.0.1:8080/pages/teddy-house"
  "/api/pages/teddy-house http://127.0.0.1:8080/api/pages/teddy-house"
)

say "Tailnet hostname: $TAILNET_HOSTNAME"
say

# Parse current serve status. tailscale serve status --json gives the full
# tree, and the Web/TCP/UDP sections have the rules.
SERVE_JSON="$(tailscale serve status --json 2>/dev/null || true)"
FUNNEL_JSON="$(tailscale funnel status --json 2>/dev/null || true)"
if [ -z "$SERVE_JSON" ] || [ -z "$FUNNEL_JSON" ]; then
  say "FATAL: tailscale serve status --json failed"
  exit 1
fi

# Detect funnels: a funnel is a port+handler in Web. We check that the
# :10000 funnel exists and points to 127.0.0.1:8080.
FUNNELS_FOUND=()
for f in "${EXPECT_FUNNELS[@]}"; do
  port="${f%% *}"
  target="${f#* }"
  if echo "$FUNNEL_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
tcp = d.get('TCP', {})
if str($port) not in tcp:
    sys.exit(1)
# Web section maps '<host>:<port>' to handlers. The root '/' handler is the
# proxy target.
web = d.get('Web', {})
for host, info in web.items():
    if not host.endswith(':$port'):
        continue
    handlers = info.get('Handlers', {})
    root = handlers.get('/', {})
    if root.get('Proxy', '').rstrip('/') == '$target'.rstrip('/'):
        sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    FUNNELS_FOUND+=("$port")
  else
    say "  MISSING funnel :$port -> $target (will reapply)"
    if [ "$QUIET" -ne 1 ]; then
      tailscale funnel --https="$port" "$target" 2>&1 | sed 's/^/    /' || true
    fi
  fi
done

# Detect sub-paths under the funnel host. They are stored as additional
# Handlers entries in the Web section under the same host:port.
SUBPATHS_FOUND=()
SUBPATHS_MISSING=()
for p in "${EXPECT_SUBPATHS[@]}"; do
  path="${p%% *}"
  target="${p#* }"
  if echo "$FUNNEL_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
web = d.get('Web', {})
# Check all host:port entries because the sub-path could be on the funnel
# or on a tailnet-only serve.
for host, info in web.items():
    handlers = info.get('Handlers', {})
    if '$path' in handlers:
        if handlers['$path'].get('Proxy', '').rstrip('/') == '$target'.rstrip('/'):
            sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    SUBPATHS_FOUND+=("$path")
  else
    SUBPATHS_MISSING+=("$path -> $target")
  fi
done

# Verdict
VERDICT="GREEN"
if [ ${#SUBPATHS_MISSING[@]} -gt 0 ]; then
  VERDICT="AMBER"
fi
if [ ${#FUNNELS_FOUND[@]} -lt ${#EXPECT_FUNNELS[@]} ]; then
  # Re-check after reapplication
  SERVE_JSON2="$(tailscale serve status --json 2>/dev/null || true)"
  for f in "${EXPECT_FUNNELS[@]}"; do
    port="${f%% *}"
    if ! echo "$SERVE_JSON2" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for k, v in d.get('Funnel', {}).items():
    for r in v.get('Rules', []):
        if r.get('Port') == $port:
            sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
      VERDICT="RED"
    fi
  done
fi

if [ "$JSON" = "1" ]; then
  FUNNELS_JSON="[]"; [ ${#FUNNELS_FOUND[@]} -gt 0 ] && FUNNELS_JSON=$(printf '%s\n' "${FUNNELS_FOUND[@]}" | python3 -c 'import json,sys; print(json.dumps([l.rstrip() for l in sys.stdin if l.strip()]))')
  SUBPATHS_JSON="[]"; [ ${#SUBPATHS_FOUND[@]} -gt 0 ] && SUBPATHS_JSON=$(printf '%s\n' "${SUBPATHS_FOUND[@]}" | python3 -c 'import json,sys; print(json.dumps([l.rstrip() for l in sys.stdin if l.strip()]))')
  MISSING_JSON="[]"; [ ${#SUBPATHS_MISSING[@]} -gt 0 ] && MISSING_JSON=$(printf '%s\n' "${SUBPATHS_MISSING[@]}" | python3 -c 'import json,sys; print(json.dumps([l.rstrip() for l in sys.stdin if l.strip()]))')
  cat <<EOF
{
  "tailnet_hostname": "$TAILNET_HOSTNAME",
  "verdict": "$VERDICT",
  "funnels_found": $FUNNELS_JSON,
  "subpaths_found": $SUBPATHS_JSON,
  "subpaths_missing": $MISSING_JSON
}
EOF
else
  say
  say "Funnels present : ${FUNNELS_FOUND[*]:-NONE}"
  say "Sub-paths present: ${SUBPATHS_FOUND[*]:-NONE}"
  if [ ${#SUBPATHS_MISSING[@]} -gt 0 ]; then
    say
    say "Sub-paths MISSING (set these in the macOS Tailscale GUI):"
    for m in "${SUBPATHS_MISSING[@]}"; do
      say "  $m"
    done
  fi
  say
  say "VERDICT: $VERDICT"
  if [ "$VERDICT" = "RED" ]; then
    say "  Funnels could not be reapplied. Run the macOS Tailscale app,"
    say "  enable Funnel on :10000 and :8443, and re-run this script."
  elif [ "$VERDICT" = "AMBER" ]; then
    say "  Sub-paths are missing. Open the macOS Tailscale app →"
    say "  Preferences → Serve → add the missing paths above."
  else
    say "  All canonical routes are live. Canonical URLs:"
    say "    https://$TAILNET_HOSTNAME/house"
    say "    https://$TAILNET_HOSTNAME:10000/api/teddy-camera/feed"
  fi
fi

# Exit code: 0 GREEN, 1 AMBER, 2 RED
case "$VERDICT" in
  GREEN) exit 0 ;;
  AMBER) exit 1 ;;
  RED) exit 2 ;;
esac

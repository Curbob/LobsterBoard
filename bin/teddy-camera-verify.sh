#!/usr/bin/env bash
# teddy-camera-verify.sh
# Full pre-flight check: lint, tests, restart, end-to-end probe.
# Use after editing the route, server, or widget.
#
# Usage:
#   ./teddy-camera-verify.sh            # default: car cycle
#   ./teddy-camera-verify.sh person     # cycle with person
#   ./teddy-camera-verify.sh car 25     # cycle with car, 25s wait
#
# Exits non-zero on any failure. Prints a verdict at the end so an
# agent can read the last 10 lines and know whether to keep going.

set -euo pipefail

HOMEBASE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${1:-car}"
WAIT_S="${2:-18}"
VERDICT=0

echo "================================================================"
echo "  VERIFY: $HOMEBASE_ROOT"
echo "================================================================"

echo ""
echo "[1/6] Lint"
if npm --prefix "$HOMEBASE_ROOT" run lint 2>&1 | tail -5; then
  echo "  lint: pass"
else
  echo "  lint: FAIL"
  VERDICT=1
fi

echo ""
echo "[2/6] Tests"
if npm --prefix "$HOMEBASE_ROOT" test 2>&1 | tail -5; then
  echo "  tests: pass"
else
  echo "  tests: FAIL"
  VERDICT=1
fi

echo ""
echo "[3/6] Restart homebase"
if "$HOMEBASE_ROOT/bin/teddy-camera-restart.sh"; then
  echo "  restart: pass"
else
  echo "  restart: FAIL"
  VERDICT=1
fi

echo ""
echo "[4/6] Tailscale serve + funnel routes"
if "$HOMEBASE_ROOT/bin/tailscale-serve-verify.sh" --quiet; then
  echo "  tailscale: pass"
else
  say=$("$HOMEBASE_ROOT/bin/tailscale-serve-verify.sh" 2>&1)
  echo "$say" | head -10
  echo "  tailscale: drift detected — see above"
  # Not a hard fail; tailscale drift can be fixed in the GUI.
fi

echo ""
echo "[5/6] Run a full detect cycle: $LABEL (wait ${WAIT_S}s)"
if "$HOMEBASE_ROOT/bin/teddy-camera-cycle.sh" "$LABEL" "$WAIT_S"; then
  echo "  cycle: pass"
else
  echo "  cycle: FAIL"
  VERDICT=1
fi

echo ""
echo "[6/6] Tail the most recent log events"
"$HOMEBASE_ROOT/bin/teddy-camera-tail-log.sh" 10

echo ""
echo "================================================================"
if [ "$VERDICT" -eq 0 ]; then
  echo "  VERDICT: GREEN — keep going"
else
  echo "  VERDICT: RED — fix and re-verify"
fi
echo "================================================================"

exit "$VERDICT"

#!/bin/zsh

set -euo pipefail

repo_root="${0:A:h:h}"
node_bin="${NODE_BIN:-$(command -v node)}"
keychain_service="${HOMEBASE_DASHBOARD_KEYCHAIN_SERVICE:-teddy-homebase-dashboard-password}"
keychain_account="${HOMEBASE_DASHBOARD_KEYCHAIN_ACCOUNT:-dashboard}"

if [[ -z "${DASHBOARD_PASSWORD:-}" ]]; then
  dashboard_password="$(/usr/bin/security find-generic-password -s "$keychain_service" -a "$keychain_account" -w 2>/dev/null || true)"
  if [[ -z "$dashboard_password" ]]; then
    print -u2 "Homebase: dashboard password is unavailable in Keychain."
    exit 78
  fi
  export DASHBOARD_PASSWORD="$dashboard_password"
  unset dashboard_password
fi

cd "$repo_root"
exec "$node_bin" "$repo_root/server.cjs"

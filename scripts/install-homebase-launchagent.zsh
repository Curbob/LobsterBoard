#!/bin/zsh

set -euo pipefail

repo_root="${0:A:h:h}"
template="$repo_root/ops/com.teddy.house-lobsterboard.plist.template"
target="$HOME/Library/LaunchAgents/com.teddy.house-lobsterboard.plist"
backup_dir="$HOME/Library/Application Support/Teddy Homebase/launchagents"
label="com.teddy.house-lobsterboard"
mode="${1:-install}"
keychain_service="teddy-homebase-dashboard-password"
keychain_account="dashboard"

migrate_dashboard_password() {
  if /usr/bin/security find-generic-password -s "$keychain_service" -a "$keychain_account" -w >/dev/null 2>&1; then
    return
  fi
  local source_plist=""
  if [[ -f "$target" ]] && /usr/bin/plutil -extract EnvironmentVariables.DASHBOARD_PASSWORD raw -o - "$target" >/dev/null 2>&1; then
    source_plist="$target"
  else
    local candidate
    for candidate in "${(@f)$(find "$backup_dir" -type f -name '*.plist' -print 2>/dev/null | sort -r)}"; do
      if /usr/bin/plutil -extract EnvironmentVariables.DASHBOARD_PASSWORD raw -o - "$candidate" >/dev/null 2>&1; then
        source_plist="$candidate"
        break
      fi
    done
  fi
  [[ -n "$source_plist" ]] || { print -u2 "Homebase: no existing dashboard password was available to migrate."; exit 67; }
  local legacy_password
  legacy_password="$(/usr/bin/plutil -extract EnvironmentVariables.DASHBOARD_PASSWORD raw -o - "$source_plist" 2>/dev/null || true)"
  [[ -n "$legacy_password" ]] || { print -u2 "Homebase: existing dashboard password was empty."; exit 67; }
  /usr/bin/security add-generic-password -U -s "$keychain_service" -a "$keychain_account" -w "$legacy_password" >/dev/null
  unset legacy_password
}

render() {
  local output="$1"
  local node_bin="${NODE_BIN:-$(command -v node)}"
  local node_dir="${node_bin:h}"
  /usr/bin/sed \
    -e "s|__REPO_ROOT__|$repo_root|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__NODE_BIN__|$node_bin|g" \
    -e "s|__NODE_DIR__|$node_dir|g" \
    "$template" > "$output"
  /usr/bin/plutil -lint "$output" >/dev/null
  if /usr/bin/grep -q '<key>DASHBOARD_PASSWORD</key>' "$output"; then
    print -u2 "Homebase: rendered plist must not contain DASHBOARD_PASSWORD."
    exit 65
  fi
}

if [[ "$mode" == "--render" ]]; then
  [[ $# -eq 2 ]] || { print -u2 "usage: $0 --render OUTPUT"; exit 64; }
  render "$2"
  print -- "$2"
  exit 0
fi

if [[ "$mode" == "--check" ]]; then
  temp="$(mktemp -t homebase-launchagent.XXXXXX)"
  trap 'rm -f "$temp"' EXIT
  render "$temp"
  /usr/bin/security find-generic-password -s "$keychain_service" -a "$keychain_account" -w >/dev/null
  print "Homebase LaunchAgent template and Keychain dependency are ready."
  exit 0
fi

if [[ "$mode" == "--restore-latest" ]]; then
  latest="$(find "$backup_dir" -type f -name '*.plist' -print 2>/dev/null | sort | tail -1)"
  [[ -n "$latest" ]] || { print -u2 "Homebase: no LaunchAgent backup found."; exit 66; }
  /bin/cp "$latest" "$target"
  /bin/chmod 644 "$target"
else
  [[ "$mode" == "install" || "$mode" == "--install" ]] || {
    print -u2 "usage: $0 [--install|--check|--render OUTPUT|--restore-latest]"
    exit 64
  }
  /bin/mkdir -p "${target:h}" "$backup_dir" "$HOME/Library/Logs/TeddyHouse"
  migrate_dashboard_password
  if [[ -f "$target" ]]; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    /bin/cp "$target" "$backup_dir/$stamp.plist"
  fi
  temp="$(mktemp -t homebase-launchagent.XXXXXX)"
  trap 'rm -f "$temp"' EXIT
  render "$temp"
  if [[ -f "$target" ]] && /usr/bin/cmp -s "$temp" "$target"; then
    print "Homebase LaunchAgent already matches the repo template."
  else
    /bin/cp "$temp" "$target"
    /bin/chmod 644 "$target"
  fi
fi

/bin/launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
for _ in {1..20}; do
  if ! /bin/launchctl print "gui/$(id -u)/$label" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
bootstrapped=0
for _ in {1..5}; do
  if /bin/launchctl bootstrap "gui/$(id -u)" "$target" >/dev/null 2>&1; then
    bootstrapped=1
    break
  fi
  sleep 1
done
[[ "$bootstrapped" == "1" ]] || { print -u2 "Homebase: launchd bootstrap failed after retries."; exit 69; }
/bin/launchctl kickstart -k "gui/$(id -u)/$label"

for _ in {1..30}; do
  if /usr/bin/curl -fsS http://127.0.0.1:8080/api/pages/teddy-house/health >/dev/null 2>&1; then
    print "Homebase LaunchAgent installed and health API is responding."
    exit 0
  fi
  sleep 1
done

print -u2 "Homebase: LaunchAgent installed but health API did not respond."
exit 70

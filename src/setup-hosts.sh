#!/usr/bin/env bash
# Add (or remove) local nginx domain names in /etc/hosts.
# Requires sudo on macOS/Linux because /etc/hosts is owned by root.
set -euo pipefail

HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
MARKER="# prototype local domains"
ENTRY="127.0.0.1 adonis.app prototype.app ${MARKER}"

usage() {
  cat <<'EOF'
Usage: ./setup-hosts.sh [--remove]

  (default)  Add 127.0.0.1 adonis.app prototype.app to /etc/hosts if missing
  --remove   Delete the line previously added by this script
EOF
}

as_root() {
  if [[ "$(id -u)" -eq 0 ]] || [[ -w "$HOSTS_FILE" ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

already_present() {
  grep -Fq "$MARKER" "$HOSTS_FILE"
}

add_hosts() {
  if already_present; then
    echo "Already in ${HOSTS_FILE}: adonis.app prototype.app"
    return 0
  fi

  echo "Adding adonis.app and prototype.app to ${HOSTS_FILE}"
  printf '\n%s\n' "$ENTRY" | as_root tee -a "$HOSTS_FILE" >/dev/null
  echo "Done. https://adonis.app and https://prototype.app now resolve to 127.0.0.1"
}

remove_hosts() {
  if ! already_present; then
    echo "No prototype hosts entry found in ${HOSTS_FILE}"
    return 0
  fi

  echo "Removing prototype hosts entry from ${HOSTS_FILE}"
  as_root sed -i.bak -e "/${MARKER}/d" "$HOSTS_FILE"
  as_root rm -f "${HOSTS_FILE}.bak"
  echo "Done."
}

case "${1:-}" in
  -h|--help) usage ;;
  --remove) remove_hosts ;;
  "") add_hosts ;;
  *) usage >&2; exit 1 ;;
esac

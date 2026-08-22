#!/usr/bin/env bash
# Issue a locally trusted TLS cert for adonis.app and prototype.app.
# Browsers HSTS-preload the .app TLD, so HTTPS is required.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="${ROOT}/nginx/certs"

usage() {
  cat <<'EOF'
Usage: ./setup-certs.sh

  Installs a local CA (once) and writes nginx/certs/local.pem + local-key.pem
  Requires mkcert: brew install mkcert
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v mkcert >/dev/null 2>&1; then
  cat >&2 <<'EOF'
mkcert is not installed. It creates a local CA so browsers trust these certs.

  brew install mkcert
EOF
  exit 1
fi

mkdir -p "${CERT_DIR}"

echo "Installing mkcert local CA into the system trust store (sudo may prompt)..."
if ! mkcert -install; then
  echo "Warning: could not install the local CA. Certs will still be written, but browsers will keep showing a warning until you re-run: mkcert -install" >&2
fi

echo "Writing certs for adonis.app and prototype.app to ${CERT_DIR}"
mkcert \
  -cert-file "${CERT_DIR}/local.pem" \
  -key-file "${CERT_DIR}/local-key.pem" \
  adonis.app prototype.app

echo "Done. Recreate nginx if it is already running: docker compose up -d nginx"

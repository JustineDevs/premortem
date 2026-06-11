#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env.local"
  set +a
elif [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

BASE_URL="${PHOENIX_MCP_BASE_URL:-${PHOENIX_COLLECTOR_ENDPOINT:-https://app.phoenix.arize.com}}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/v1/traces}"

if [ -z "${PHOENIX_API_KEY:-}" ]; then
  echo "PHOENIX_API_KEY is required for Phoenix MCP." >&2
  exit 1
fi

exec npx -y @arizeai/phoenix-mcp@latest --baseUrl "$BASE_URL" --apiKey "$PHOENIX_API_KEY"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    npx -y pnpm@9.12.0 "$@"
  fi
}

cd "$ROOT_DIR"

run_pnpm --filter @premortem/agent-kit --filter @premortem/db --filter @premortem/llm --filter @premortem/workflow --filter @premortem/orchestrator --filter @premortem/api --filter @premortem/dashboard build

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  . "$ROOT_DIR/.env.local"
  set +a
elif [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

node --experimental-specifier-resolution=node "$ROOT_DIR/scripts/smoke/run-audit-flow.mjs"

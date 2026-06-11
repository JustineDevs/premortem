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

run_pnpm --filter @premortem/domain --filter @premortem/agent-kit --filter @premortem/db --filter @premortem/graph-model --filter @premortem/llm --filter @premortem/workflow --filter @premortem/gitlab-sync --filter @premortem/orchestrator --filter @premortem/api --filter @premortem/dashboard --filter @premortem/cli build

# load-smoke-env.mjs reads .env.local and picks mock vs configured mode from credentials.
export PREMORTEM_WEB_PORT="${PREMORTEM_WEB_PORT:-13000}"
export PREMORTEM_API_PORT="${PREMORTEM_API_PORT:-18787}"

npx tsx --tsconfig "$ROOT_DIR/tsconfig.base.json" "$ROOT_DIR/scripts/smoke/verify-runtime-pipeline.mjs"
npx tsx --tsconfig "$ROOT_DIR/tsconfig.base.json" "$ROOT_DIR/scripts/smoke/verify-web-bff.mjs"
node "$ROOT_DIR/scripts/smoke/run-audit-flow.mjs"

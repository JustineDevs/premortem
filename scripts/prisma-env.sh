#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse .env.local safely (quoted passwords, pooler normalization) before Prisma CLI.
eval "$(
  node <<'EOF'
import { loadPremortemLocalEnv } from './scripts/load-local-env.mjs';

loadPremortemLocalEnv();

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const value = process.env[key];
  if (value) {
    console.log(`export ${key}=${JSON.stringify(value)}`);
  }
}
EOF
)"

if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @premortem/db prisma "$@"
else
  npx -y pnpm@9.12.0 --filter @premortem/db prisma "$@"
fi

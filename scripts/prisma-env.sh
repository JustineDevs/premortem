#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  . "$ROOT_DIR/.env.local"
  set +a
elif [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

cd "$ROOT_DIR"

if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @premortem/db prisma "$@"
else
  npx -y pnpm@9.12.0 --filter @premortem/db prisma "$@"
fi

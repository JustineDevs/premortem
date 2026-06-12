#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

eval "$(
  node <<'EOF'
import { loadPremortemLocalEnv } from './scripts/load-local-env.mjs';

loadPremortemLocalEnv();
console.log(`export DATABASE_URL=${JSON.stringify(process.env.DATABASE_URL ?? '')}`);
EOF
)"

if [ -n "${POSTGRES_HOST:-}" ] && [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  exec npx -y @toolbox-sdk/server --prebuilt=postgres --stdio
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL or POSTGRES_* vars are required for Toolbox Postgres." >&2
  exit 1
fi

eval "$(
  node <<'EOF'
const input = process.env.DATABASE_URL;
if (!input) {
  process.exit(1);
}
const url = new URL(input);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.replace(/^\//, '') || 'postgres';
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);

for (const [key, value] of Object.entries({
  POSTGRES_HOST: host,
  POSTGRES_PORT: port,
  POSTGRES_DATABASE: database,
  POSTGRES_USER: user,
  POSTGRES_PASSWORD: password
})) {
  console.log(`export ${key}=${JSON.stringify(value)}`);
}
EOF
)"

exec npx -y @toolbox-sdk/server --prebuilt=postgres --stdio

#!/usr/bin/env bash
set -euo pipefail

npx tsx --tsconfig ./tsconfig.base.json ./scripts/smoke/run-local-stack.ts

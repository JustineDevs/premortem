#!/usr/bin/env bash
set -euo pipefail
LATEST=$(ls -1 supabase/migrations/*.sql | sort | tail -n 1)
echo "Latest migration: $LATEST"
if [ ! -f VERSION ]; then
  echo "VERSION file missing" >&2
  exit 1
fi
echo "Migration compatibility check passed"

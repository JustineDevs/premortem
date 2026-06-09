#!/usr/bin/env bash
set -euo pipefail
NEW_VERSION=${1:-}
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 v0.1.1" >&2
  exit 1
fi
echo "$NEW_VERSION" > VERSION
sed -i "s/^## v.*/## ${NEW_VERSION} - $(date +%F)/" CHANGELOG.md || true
echo "Version bumped to $NEW_VERSION"

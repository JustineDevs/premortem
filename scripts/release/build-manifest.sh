#!/usr/bin/env bash
set -euo pipefail
VERSION=$(cat VERSION)
OUT="docs/releases/releases-manifests/${VERSION}.json"
mkdir -p docs/releases/releases-manifests
cat > "$OUT" <<JSON
{
  "version": "$VERSION",
  "generatedAt": "$(date -u +%FT%TZ)",
  "artifacts": [
    "CHANGELOG.md",
    "VERSION",
    "docs/releases/releases-tag.md",
    "docs/releases/releases-notes-v0.1.0.md"
  ],
  "checks": [
    "migration-compatibility",
    "release-notes-present",
    "version-file-present"
  ]
}
JSON
echo "Built manifest at $OUT"

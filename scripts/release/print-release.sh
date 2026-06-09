#!/usr/bin/env bash
set -euo pipefail
VERSION=$(cat VERSION)
echo "Version: $VERSION"
echo "Notes: docs/releases/releases-notes-${VERSION#v}.md"
echo "Tag doc: docs/releases/releases-tag.md"

#!/usr/bin/env bash
set -euo pipefail
VERSION=$(cat VERSION)
git tag -a "$VERSION" -m "Release $VERSION"
echo "Created tag $VERSION"

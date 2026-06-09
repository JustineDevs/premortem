#!/usr/bin/env bash
set -euo pipefail

exec npx -y -p node@20 -p @ui-layouts/mcp sh -lc 'exec ui-layouts-mcp'

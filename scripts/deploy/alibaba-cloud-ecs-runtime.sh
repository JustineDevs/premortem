#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

require_env ECS_HOST
require_env ECS_USER
require_env ECS_PRIVATE_KEY
require_env ECS_APP_DIR
require_env ECS_DEPLOY_REF

ECS_PORT="${ECS_PORT:-22}"
ECS_PUBLIC_URL="${ECS_PUBLIC_URL:-http://${ECS_HOST}:18787}"
ARCHIVE_PATH="$(mktemp /tmp/premortem-api-image.XXXXXX.tar.gz)"

cleanup() {
  rm -f "$ARCHIVE_PATH"
}

trap cleanup EXIT

printf 'Building API image on runner...\n'
docker build -f apps/api/Dockerfile -t premortem-api:prod .
docker save premortem-api:prod | gzip -1 > "$ARCHIVE_PATH"
ls -lh "$ARCHIVE_PATH"

install -d -m 700 ~/.ssh
printf '%s\n' "$ECS_PRIVATE_KEY" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -p "$ECS_PORT" -H "$ECS_HOST" >> ~/.ssh/known_hosts

printf 'Copying API image archive to ECS...\n'
scp -P "$ECS_PORT" "$ARCHIVE_PATH" "$ECS_USER@$ECS_HOST:/tmp/premortem-api-image.tar.gz"

printf 'Deploying API container on ECS...\n'
ssh -p "$ECS_PORT" "$ECS_USER@$ECS_HOST" \
  "ECS_APP_DIR=$(printf '%q' "$ECS_APP_DIR") ECS_DEPLOY_REF=$(printf '%q' "$ECS_DEPLOY_REF") bash -se" <<'REMOTE'
set -euo pipefail

cd "$ECS_APP_DIR"
git fetch --all --prune
git checkout --detach "$ECS_DEPLOY_REF"

PREV_CONTAINER=""
if docker ps -a --format '{{.Names}}' | grep -qx 'premortem-api'; then
  PREV_CONTAINER="premortem-api-prev-$(date +%s)"
  docker rename premortem-api "$PREV_CONTAINER"
  docker stop "$PREV_CONTAINER" >/dev/null 2>&1 || true
fi

gunzip -c /tmp/premortem-api-image.tar.gz | docker load
rm -f /tmp/premortem-api-image.tar.gz

docker run -d \
  --name premortem-api \
  --restart unless-stopped \
  --env-file .env.production \
  -p 127.0.0.1:18787:18787 \
  premortem-api:prod

for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS http://127.0.0.1:18787/health >/tmp/premortem-api-health.json; then
    cat /tmp/premortem-api-health.json
    if [ -n "$PREV_CONTAINER" ]; then
      docker rm -f "$PREV_CONTAINER" >/dev/null 2>&1 || true
    fi
    exit 0
  fi
  sleep 5
done

echo "API health check failed after deployment" >&2
docker logs --tail 80 premortem-api >&2 || true
docker rm -f premortem-api >/dev/null 2>&1 || true

if [ -n "$PREV_CONTAINER" ]; then
  docker rename "$PREV_CONTAINER" premortem-api
  docker start premortem-api >/dev/null
fi

exit 1
REMOTE

printf 'API deploy completed. Public health target: %s\n' "$ECS_PUBLIC_URL/health"

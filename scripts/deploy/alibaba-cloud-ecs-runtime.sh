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
require_env ECS_APP_DIR
require_env ECS_DEPLOY_REF

ECS_PORT="${ECS_PORT:-22}"
ECS_PUBLIC_URL="${ECS_PUBLIC_URL:-http://${ECS_HOST}:18787}"
ECS_ENV_DIR="${ECS_ENV_DIR:-/etc/premortem}"
ECS_ENV_FILE="${ECS_ENV_FILE:-${ECS_ENV_DIR}/premortem-api.env}"
ARCHIVE_PATH="$(mktemp /tmp/premortem-api-image.XXXXXX.tar.gz)"
ASKPASS_SCRIPT=""

cleanup() {
  rm -f "$ARCHIVE_PATH"
  if [ -n "$ASKPASS_SCRIPT" ]; then
    rm -f "$ASKPASS_SCRIPT"
  fi
}

trap cleanup EXIT

printf 'Building API image on runner...\n'
docker build -f apps/api/Dockerfile -t premortem-api:prod .
docker save premortem-api:prod | gzip -1 > "$ARCHIVE_PATH"
ls -lh "$ARCHIVE_PATH"

if [ -n "${ECS_PRIVATE_KEY:-}" ]; then
  install -d -m 700 ~/.ssh
  printf '%s\n' "$ECS_PRIVATE_KEY" > ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
  ssh-keyscan -p "$ECS_PORT" -H "$ECS_HOST" >> ~/.ssh/known_hosts
else
  require_env ECS_PASSWORD
  ASKPASS_SCRIPT="$(mktemp /tmp/premortem-askpass.XXXXXX.sh)"
  cat > "$ASKPASS_SCRIPT" <<EOF
#!/usr/bin/env bash
printf '%s\n' "$ECS_PASSWORD"
EOF
  chmod 700 "$ASKPASS_SCRIPT"
fi

printf 'Copying API image archive to ECS...\n'
if [ -n "${ECS_PRIVATE_KEY:-}" ]; then
  ssh -p "$ECS_PORT" "$ECS_USER@$ECS_HOST" \
    "cat > /tmp/premortem-api-image.tar.gz" < "$ARCHIVE_PATH"
else
  setsid -w env \
    DISPLAY=:0 \
    SSH_ASKPASS="$ASKPASS_SCRIPT" \
    SSH_ASKPASS_REQUIRE=force \
    ssh \
    -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no \
    -o StrictHostKeyChecking=accept-new \
    -o NumberOfPasswordPrompts=1 \
    -P "$ECS_PORT" \
    "$ECS_USER@$ECS_HOST" \
    "cat > /tmp/premortem-api-image.tar.gz" < "$ARCHIVE_PATH"
fi

printf 'Deploying API container on ECS...\n'
if [ -n "${ECS_PRIVATE_KEY:-}" ]; then
  ssh -p "$ECS_PORT" "$ECS_USER@$ECS_HOST" \
    "ECS_APP_DIR=$(printf '%q' "$ECS_APP_DIR") ECS_DEPLOY_REF=$(printf '%q' "$ECS_DEPLOY_REF") ECS_PUBLIC_URL=$(printf '%q' "$ECS_PUBLIC_URL") ECS_ENV_DIR=$(printf '%q' "$ECS_ENV_DIR") ECS_ENV_FILE=$(printf '%q' "$ECS_ENV_FILE") bash -se" <<'REMOTE'
set -euo pipefail
trap 'rm -f "${ECS_ENV_FILE}.tmp"' EXIT

cd "$ECS_APP_DIR"
git fetch --all --prune >/dev/null 2>&1 || true
printf 'Deploy ref: %s\n' "$ECS_DEPLOY_REF"
install -d -m 700 "$ECS_ENV_DIR"

setup_edge_proxy() {
  local public_url="${ECS_PUBLIC_URL:-}"
  local public_host=""
  if [ -z "$public_url" ]; then
    return 0
  fi

  public_host="$(python3 - <<'PY'
from urllib.parse import urlparse
import os

value = os.environ.get("ECS_PUBLIC_URL", "").strip()
if not value:
    print("")
else:
    parsed = urlparse(value if "://" in value else f"https://{value}")
    print(parsed.hostname or "")
PY
)"

  if [ -z "$public_host" ]; then
    echo "Skipping edge proxy: unable to derive public host from ECS_PUBLIC_URL=${public_url}" >&2
    return 0
  fi

  if ss -H -ltn '( sport = :80 or sport = :443 )' 2>/dev/null | grep -q .; then
    echo "Skipping edge proxy: ports 80/443 are already in use on the host" >&2
    return 0
  fi

  mkdir -p /tmp/premortem-edge-proxy/data /tmp/premortem-edge-proxy/config
  cat > /tmp/premortem-edge-proxy/Caddyfile <<EOF
${public_host} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:18787
}
EOF

  docker rm -f premortem-edge >/dev/null 2>&1 || true
  docker pull caddy:2-alpine >/dev/null 2>&1 || true
  docker run -d \
    --name premortem-edge \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    -v /tmp/premortem-edge-proxy/data:/data \
    -v /tmp/premortem-edge-proxy/config:/config \
    -v /tmp/premortem-edge-proxy/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2-alpine
}

python3 - <<'PY'
from pathlib import Path
import os

source = Path('.env.production')
target = Path(os.environ['ECS_ENV_FILE'])
tmp_target = target.with_suffix(target.suffix + '.tmp')
lines = []
for line in source.read_text().splitlines():
    if '=' not in line or line.lstrip().startswith('#'):
        lines.append(line)
        continue
    key, value = line.split('=', 1)
    stripped = value.strip()
    if key in {'DATABASE_URL', 'DIRECT_URL'} and len(stripped) >= 2:
        if (stripped[0] == stripped[-1]) and stripped[0] in {'"', "'"}:
            stripped = stripped[1:-1]
    lines.append(f'{key}={stripped}')
tmp_target.write_text('\n'.join(lines) + '\n')
tmp_target.chmod(0o600)
tmp_target.replace(target)
PY

PREV_CONTAINER=""
if docker ps -a --format '{{.Names}}' | grep -qx 'premortem-api'; then
  PREV_CONTAINER="premortem-api-prev-$(date +%s)"
  docker rename premortem-api "$PREV_CONTAINER"
fi

gunzip -c /tmp/premortem-api-image.tar.gz | docker load
rm -f /tmp/premortem-api-image.tar.gz

if [ -n "$PREV_CONTAINER" ]; then
  docker stop "$PREV_CONTAINER" >/dev/null 2>&1 || true
fi

docker run -d \
  --name premortem-api \
  --restart unless-stopped \
  --env-file "$ECS_ENV_FILE" \
  -p 127.0.0.1:18787:18787 \
  premortem-api:prod

for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS http://127.0.0.1:18787/health >/tmp/premortem-api-health.json; then
    cat /tmp/premortem-api-health.json
    setup_edge_proxy
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
else
  setsid -w env \
    DISPLAY=:0 \
    SSH_ASKPASS="$ASKPASS_SCRIPT" \
    SSH_ASKPASS_REQUIRE=force \
    ssh \
    -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no \
    -o StrictHostKeyChecking=accept-new \
    -o NumberOfPasswordPrompts=1 \
    -p "$ECS_PORT" \
    "$ECS_USER@$ECS_HOST" \
    "ECS_APP_DIR=$(printf '%q' "$ECS_APP_DIR") ECS_DEPLOY_REF=$(printf '%q' "$ECS_DEPLOY_REF") ECS_PUBLIC_URL=$(printf '%q' "$ECS_PUBLIC_URL") ECS_ENV_DIR=$(printf '%q' "$ECS_ENV_DIR") ECS_ENV_FILE=$(printf '%q' "$ECS_ENV_FILE") bash -se" <<'REMOTE'
set -euo pipefail
trap 'rm -f "${ECS_ENV_FILE}.tmp"' EXIT

cd "$ECS_APP_DIR"
git fetch --all --prune >/dev/null 2>&1 || true
printf 'Deploy ref: %s\n' "$ECS_DEPLOY_REF"
install -d -m 700 "$ECS_ENV_DIR"

setup_edge_proxy() {
  local public_url="${ECS_PUBLIC_URL:-}"
  local public_host=""
  if [ -z "$public_url" ]; then
    return 0
  fi

  public_host="$(python3 - <<'PY'
from urllib.parse import urlparse
import os

value = os.environ.get("ECS_PUBLIC_URL", "").strip()
if not value:
    print("")
else:
    parsed = urlparse(value if "://" in value else f"https://{value}")
    print(parsed.hostname or "")
PY
)"

  if [ -z "$public_host" ]; then
    echo "Skipping edge proxy: unable to derive public host from ECS_PUBLIC_URL=${public_url}" >&2
    return 0
  fi

  mkdir -p /tmp/premortem-edge-proxy/data /tmp/premortem-edge-proxy/config
  cat > /tmp/premortem-edge-proxy/Caddyfile <<EOF
${public_host} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:18787
}
EOF

  docker rm -f premortem-edge >/dev/null 2>&1 || true
  docker pull caddy:2-alpine >/dev/null 2>&1 || true
  docker run -d \
    --name premortem-edge \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    -v /tmp/premortem-edge-proxy/data:/data \
    -v /tmp/premortem-edge-proxy/config:/config \
    -v /tmp/premortem-edge-proxy/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2-alpine
}

python3 - <<'PY'
from pathlib import Path
import os

source = Path('.env.production')
target = Path(os.environ['ECS_ENV_FILE'])
tmp_target = target.with_suffix(target.suffix + '.tmp')
lines = []
for line in source.read_text().splitlines():
    if '=' not in line or line.lstrip().startswith('#'):
        lines.append(line)
        continue
    key, value = line.split('=', 1)
    stripped = value.strip()
    if key in {'DATABASE_URL', 'DIRECT_URL'} and len(stripped) >= 2:
        if (stripped[0] == stripped[-1]) and stripped[0] in {'"', "'"}:
            stripped = stripped[1:-1]
    lines.append(f'{key}={stripped}')
tmp_target.write_text('\n'.join(lines) + '\n')
tmp_target.chmod(0o600)
tmp_target.replace(target)
PY

PREV_CONTAINER=""
if docker ps -a --format '{{.Names}}' | grep -qx 'premortem-api'; then
  PREV_CONTAINER="premortem-api-prev-$(date +%s)"
  docker rename premortem-api "$PREV_CONTAINER"
fi

gunzip -c /tmp/premortem-api-image.tar.gz | docker load
rm -f /tmp/premortem-api-image.tar.gz

if [ -n "$PREV_CONTAINER" ]; then
  docker stop "$PREV_CONTAINER" >/dev/null 2>&1 || true
fi

docker run -d \
  --name premortem-api \
  --restart unless-stopped \
  --env-file "$ECS_ENV_FILE" \
  -p 127.0.0.1:18787:18787 \
  premortem-api:prod

for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS http://127.0.0.1:18787/health >/tmp/premortem-api-health.json; then
    cat /tmp/premortem-api-health.json
    setup_edge_proxy
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
fi

printf 'API deploy completed. Public health target: %s\n' "$ECS_PUBLIC_URL/health"

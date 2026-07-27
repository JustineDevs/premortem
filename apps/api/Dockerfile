# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /repo

RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm dlx turbo@2.0.12 prune --scope=@premortem/api --docker

FROM base AS build

COPY tsconfig.base.json ./tsconfig.base.json
COPY scripts/fix-esm-imports.ts ./scripts/fix-esm-imports.ts
COPY scripts/setup-husky.ts ./scripts/setup-husky.ts
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/full/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts
RUN pnpm --filter @premortem/api... build
RUN pnpm --filter @premortem/api deploy --prod /tmp/premortem-api
RUN set -eu; \
    GENERATED_PRISMA_CLIENT="$(find node_modules -path '*/.prisma/client/default.js' -print -quit | xargs -r dirname)"; \
    DEPLOY_PRISMA_CLIENT="$(find /tmp/premortem-api/node_modules -path '*/.prisma/client/default.js' -print -quit | xargs -r dirname)"; \
    if [ -z "$GENERATED_PRISMA_CLIENT" ] || [ -z "$DEPLOY_PRISMA_CLIENT" ]; then \
      echo "Prisma client artifact not found in build or deploy tree" >&2; \
      exit 1; \
    fi; \
    rm -rf "$DEPLOY_PRISMA_CLIENT"; \
    cp -R "$GENERATED_PRISMA_CLIENT" "$DEPLOY_PRISMA_CLIENT"

FROM base AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 premortem \
  && useradd --system --uid 1001 --gid 1001 --create-home premortem

COPY --from=build --chown=premortem:premortem /tmp/premortem-api/ ./

USER premortem

EXPOSE 18787

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:18787/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/apps/api/src/server.js"]

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

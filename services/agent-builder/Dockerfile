# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts

FROM base AS build

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @premortem/agent-builder... build
RUN pnpm --filter @premortem/agent-builder deploy --prod /tmp/premortem-agent-builder

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 premortem \
  && useradd --system --uid 1001 --gid 1001 --create-home premortem

COPY --from=build --chown=premortem:premortem /tmp/premortem-agent-builder/ ./

USER premortem

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/services/agent-builder/src/server.js"]

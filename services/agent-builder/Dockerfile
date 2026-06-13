FROM node:22-slim AS build

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY docs ./docs
COPY packages ./packages
COPY services ./services
COPY tsconfig.base.json ./

RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @premortem/agent-builder build

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/services/agent-builder/dist ./dist
COPY --from=build /repo/services/agent-builder/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/services/agent-builder/src/server.js"]

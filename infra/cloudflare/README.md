# Cloudflare setup

## Services
- `apps/api` runs as a Cloudflare Worker via Wrangler.
- Static frontends can later target Cloudflare Pages.

## First commands
- `pnpm --filter @premortem/api dev`
- `pnpm --filter @premortem/api deploy`

## Recommended bindings to add next
- KV for audit webhook idempotency keys
- R2 for graph snapshots and exported audit artifacts
- Queues for async audit scheduling
- Durable Objects only if you need long-lived coordination

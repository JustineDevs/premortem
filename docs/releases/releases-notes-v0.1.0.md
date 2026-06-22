# Premortem v0.1.0 release notes

## Summary
Premortem v0.1.0 establishes the GitLab-first foundation for predictive repository audits, structured issue synthesis, dedupe clustering, review-ready issue candidates, and publish/reconcile workflows.

This tag is the foundation cut for the alpha channel: it proves the end-to-end loop from repository ingest to clustered findings, reviewer approval, and GitLab publish/reconcile, with Cloudflare, Supabase, Neo4j, Gemini, and observability wiring in place for the public runtime surfaces.

## Included
- Agent registry, policies, real specialist prompts, and strict Zod validation.
- Prisma persistence, Supabase starter schema, and RLS/auth migration starters.
- LLM adapter seams for Gemini.
- Neo4j driver-backed graph snapshot write path.
- GitLab publish and reconciliation worker starters.
- Queueing, idempotency, leasing, dead-letter, observability, eval, billing, notification, and enterprise-readiness scaffolding.
- Release metadata, release notes, and version entry files.
- Release manifest generation and tag bookkeeping for `v0.1.0`.
- Local development, smoke, and production deployment runbooks for the GitLab-first loop.

## Known limits
- Several systems are scaffold-level rather than fully production-hardened.
- Queue workers, notifications, and dashboard flows still need runnable implementation depth.
- GitHub parity and enterprise auth are not part of this release baseline.
- Cloudflare deployment auth depends on the configured secrets in GitHub Actions and Cloudflare.
- Release notes track the public `v0.1.0` foundation cut only; the next version should layer on additional provider parity and enterprise surfaces.

## Verification (2026-06-12)
- `pnpm --filter @premortem/web test` — full local stack smoke passed end-to-end after hardening the repo-enable path, review-write transactions, and smoke assertions.
- `pnpm run smoke:production-readiness` — stranger self-serve, publish, Neo4j graph.
- `pnpm run smoke:full-app-stress` — 66 route/BFF checks (marketing, docs, auth, billing guards, audits).
- `pnpm run smoke:verify-gitlab-publish` — publish path guard verified for GitLab issue write access.
- Stripe test catalog wired (`Premortem Starter` / `Premortem Growth` price IDs).
- Deploy guide: [DEPLOY-PRODUCTION.md](./DEPLOY-PRODUCTION.md).

## Production hardening
- Repository discovery now respects the global `(provider, externalProjectId)` uniqueness contract and reuses existing projects safely.
- Review approve/edit flows use lighter transaction paths with bounded wait/timeout settings.
- The local smoke now targets the real default branch and validates the audits list contract instead of a history-order assumption.
- GitLab MCP is the primary provider path for repository publish and reconcile flows in the released surface.
- Cloudflare queue bootstrap and deploy wiring are part of the production path for the API Worker.

## Upgrade notes
- Apply Supabase migrations in order.
- Rebuild generated Prisma client after schema changes.
- Set all required provider environment variables before attempting publish or graph flows.

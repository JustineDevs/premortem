# Premortem v0.1.0 release notes

## Summary
Premortem v0.1.0 establishes the GitLab-first foundation for predictive repository audits, structured issue synthesis, dedupe clustering, review-ready issue candidates, and publish/reconcile workflows.

## Included
- Agent registry, policies, real specialist prompts, and strict Zod validation.
- Prisma persistence, Supabase starter schema, and RLS/auth migration starters.
- LLM adapter seams for Gemini and Azure OpenAI.
- Neo4j driver-backed graph snapshot write path.
- GitLab publish and reconciliation worker starters.
- Queueing, idempotency, leasing, dead-letter, observability, eval, billing, notification, and enterprise-readiness scaffolding.

## Known limits
- Several systems are scaffold-level rather than fully production-hardened.
- Queue workers, notifications, and dashboard flows still need runnable implementation depth.
- GitHub parity and enterprise auth are not part of this release baseline.

## Verification (2026-06-12)
- `pnpm --filter @premortem/web test` — full local stack smoke passed end-to-end after hardening the repo-enable path, review-write transactions, and smoke assertions.
- `pnpm run smoke:production-readiness` — stranger self-serve, publish, Neo4j graph.
- `pnpm run smoke:full-app-stress` — 66 route/BFF checks (marketing, docs, auth, billing guards, audits).
- Stripe test catalog wired (`Premortem Starter` / `Premortem Growth` price IDs).
- Deploy guide: [DEPLOY-PRODUCTION.md](./DEPLOY-PRODUCTION.md).

## Production hardening
- Repository discovery now respects the global `(provider, externalProjectId)` uniqueness contract and reuses existing projects safely.
- Review approve/edit flows use lighter transaction paths with bounded wait/timeout settings.
- The local smoke now targets the real default branch and validates the audits list contract instead of a history-order assumption.

## Upgrade notes
- Apply Supabase migrations in order.
- Rebuild generated Prisma client after schema changes.
- Set all required provider environment variables before attempting publish or graph flows.

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

## Upgrade notes
- Apply Supabase migrations in order.
- Rebuild generated Prisma client after schema changes.
- Set all required provider environment variables before attempting publish or graph flows.

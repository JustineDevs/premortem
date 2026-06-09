# Premortem Starter Monorepo

Starter scaffold for Premortem: a graph-backed multi-agent predictive audit system for repositories.

## Included
- Agent registry, policies, prompts, and strict validation
- Prisma and Supabase schema/migration starters
- Orchestrator, GitLab sync, graph builder, and Cloudflare API worker scaffolds
- Neo4j, Gemini, Azure OpenAI, and provider integration seams
- Missing-system blueprint files for workflow, security, notifications, billing, evals, queues, and enterprise readiness
- Real local stack entrypoints for:
  - Supabase-backed Prisma schema sync
  - local Node API runtime
  - Next.js reviewer web app with public landing, `/app`, and `/audits/[auditRunId]`

## Added missing areas
- Async job control, idempotency, leasing, and dead-letter schema starters
- Secrets/session design starter docs
- Product-flow docs for onboarding, invitations, review, and traceability
- Observability, disaster recovery, graph strategy, and enterprise-readiness docs
- Eval fixtures, benchmark fixtures, prompt version fixtures, and webhook idempotency fixtures

## Next implementation tasks
- Turn the queue, notification, billing, eval, and control-plane skeletons into runnable services
- Expand Supabase SQL parity for all remaining tables and policies
- Add publish/reconciliation reviewer surfaces beyond audit detail
- Add Slack/email notification workers and provider reconnect UX

## Local development
- `pnpm run dev`
  - syncs Prisma to the configured Supabase database
  - starts the local API runtime
  - starts the Next.js web app
- `pnpm run smoke:local`
  - verifies `/health`, `/`, `/app`, and `/audits/[auditRunId]`
  - submits a real audit through the local API
  - confirms persisted findings and issue candidates

## Release management
- Canonical version entry: `VERSION`
- Changelog: `CHANGELOG.md`
- Release tag metadata: `docs/releases/releases-tag.md`
- Release notes: `docs/releases/releases-notes-v0.1.0.md`
- Changesets config and initial entry included

- Automated release workflow: `.github/workflows/release.yml`
- Migration compatibility check: `scripts/release/check-migrations.sh`
- Version bump script: `scripts/release/bump-version.sh`
- Release manifest builder: `scripts/release/build-manifest.sh`
- Initial artifact manifest: `docs/releases/releases-manifests/v0.1.0.json`

## Private and generated file policy
- Private/internal docs are reserved for `/internal`, `/.internal`, and `/docs/internal` (gitignored)
- Generated screenshots, archives, exports, and submission bundles belong under `/artifacts` (gitignored)
- Local secret files belong under `/secrets` (gitignored)
- Private vendor drops belong under `/dependencies/vendor` or `/dependencies/private` (gitignored)

## Community and security
- Security policy: `SECURITY.md`
- Code of conduct: `CODE_OF_CONDUCT.md`

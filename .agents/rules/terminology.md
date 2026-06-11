# Terminology

Canonical domain: mandatory product vocabulary. Do not substitute casually.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Mandatory terms

| Term | Meaning | Code / UI hooks |
|------|---------|-----------------|
| Audit run | Single execution of the Premortem workflow over a defined scope | `AuditRun`, snapshot `runId`, `/app` audits |
| Finding | Structured specialist observation about risk, behavior, or inconsistency | Snapshot findings, specialist output |
| Cluster | Deduped or related group of findings | Dashboard risk clusters, `dedupeClusters` |
| Issue candidate | Publishable draft derived from findings or clusters | `issueCandidates` in snapshot, review queue |
| Review action | Human action: approve, reject, edit, merge, duplicate, defer | `ReviewAction`, `ConsoleReviewAction` in `@premortem/domain` |
| Graph context | Dependency and relationship context from repo and adjacent systems | Neo4j, workflow canvas |
| Provenance | Trace linking output to inputs and execution steps | Evidence arrays, audit history |
| Publish | Create a real issue in an external issue system | GitLab publish route, `publishedUrl` |
| Scope | Bounded data surface included in a run | Project, branch, paths in finding scope |
| Specialist | Domain-constrained analysis component with explicit output contract | `.agents/prompts/*.md`, swarm lanes |

## Console vs API vocabulary

Console gestures map to persisted review verbs via `packages/domain/src/review.ts`:

| Console | Persisted review |
|---------|------------------|
| CONFIRM / RESOLVE | approve |
| DISMISS | reject |
| MERGE | merge |
| SPLIT | split |
| PUBLISH | publish |
| DEFER | (deferred state, no publish) |

## Forbidden naming

Do not introduce cute or vague identifiers in code, events, or schemas:

- `insight_magic`, `brain_mode`, `super_agent_output`, `deep_think_result`

Prefer literal names: `issue_candidate`, `review_state`, `publish_target`, `graph_context`, `finding_schema_v1`.

## Consistency surfaces

Use the same terms in:

- TypeScript types (`@premortem/domain`, `@premortem/orchestrator`)
- Prisma models (`packages/db`)
- BFF JSON responses
- PostHog / canonical events (`apps/web/src/lib/canonical/events.ts`)
- `/docs` and marketing where accuracy matters

Beginner-friendly UI labels may simplify display text but must not rename the underlying concept in APIs or events.

## Work Item Attributes

Integration providers sync Work Item Attributes as automated metadata/tags via workspace APIs. This is operational metadata, not a substitute for findings or issue candidates.

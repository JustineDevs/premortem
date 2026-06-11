# Workflows

Canonical domain: happy path, failure path, demo path, and resume semantics.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [MISSION.md](MISSION.md) · [PREDICTION-POLICY.md](PREDICTION-POLICY.md)

## Happy path

```text
Connect repo
-> ingest repo and CI context
-> build graph/dependency map
-> predict outcomes (specialist swarm)
-> collect findings
-> dedupe and cluster
-> rank by impact and likelihood
-> generate issue candidates
-> review candidates
-> approve/edit one candidate
-> publish to issue system
-> store audit history
```

Implementation map:

| Step | Primary surfaces |
|------|------------------|
| Connect repo | Settings integrations, GitLab OAuth BFF |
| Ingest / graph | `@premortem/orchestrator`, Neo4j graph store |
| Schedule specialists | Audit run enqueue, swarm lanes |
| Findings / clusters | Snapshot read model, dashboard risk clusters |
| Review | `/app` AuditsView, issue action routes |
| Publish | `POST /api/issues/[issueId]/publish`, GitLab integration |
| History | Audit history view, persisted audit runs |

## Failure path

```text
Connect repo
-> validation or execution fails
-> preserve partial state
-> identify exact failed boundary
-> communicate corrective action
-> resume from failed step
```

Rules:

- Paused checkpointed runs support per-audit **Resume** (`POST /api/audits/[id]/resume`)
- **Stop all** cancels queued/running/paused and disables continuous audit (`POST /api/workspace/runtime/stop-all`)
- Turning continuous audit OFF does not cancel in-flight runs (see `AGENTS.md`)

Failures must name the boundary (auth, ingest, specialist, synthesizer, publish), not a generic “something went wrong.” See [failure-policy.md](failure-policy.md).

## Demo path

```text
Use known repo
-> bounded graph scope
-> 3-5 curated specialist findings
-> one strong issue candidate
-> explicit review
-> publish to test destination
-> show provenance chain
```

Local fixture IDs: `LOCAL_DEV_FIXTURE` in `@premortem/domain` / `@premortem/db`.

Smoke entrypoints:

- `pnpm run smoke:onboarding-e2e`
- `pnpm run smoke:production-readiness`
- `scripts/smoke/verify-runtime-pipeline.mjs`

## Continuous audit mode

| Toggle | Behavior |
|--------|----------|
| OFF (default) | Manual scans only |
| ON | ~90s idle rotation when no active run; does not cancel in-flight work when turned OFF |

UI: sidebar + dashboard continuous audit toggle.

## Documentation alignment

All product docs, onboarding, and marketing flows must map to one of the three paths above. Diátaxis placement:

- Tutorials: demo path
- How-to guides: happy path steps
- Reference: object model and API
- Concepts: identity and workflow truth (`apps/web/app/docs/concepts/`)

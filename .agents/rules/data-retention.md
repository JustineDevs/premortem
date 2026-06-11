# Data Retention

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Purpose

Defines what Premortem stores, how long it stores it, and how deletion and export work. Premortem depends on stored history for auditability; retention must still be deliberate.

## Data classes

| Class | Examples | Why stored |
|-------|----------|------------|
| Workspace metadata | org, settings, entitlements | Identity and policy |
| Repo metadata | projects, branches, integration links | Scoped audit context |
| Audit runs | run id, status, checkpoints | Traceability and resume |
| Findings | specialist output, severity, evidence | Prediction lineage |
| Clusters | dedupe groups, merge rationale | Ranked risk view |
| Issue candidates | draft titles, bodies, metadata | Review before publish |
| Review history | approve, edit, reject actions | Governance |
| Published issue links | external issue ids, URLs | Reconciliation |
| Analytics events | product usage (PostHog) | Product improvement |
| Logs | ops and error traces (Sentry, app logs) | Support and debugging |

Primary persistence: Supabase Postgres via Prisma (`packages/db`). Artifacts may use Supabase Storage when configured.

## Retention policy (defaults)

Define per class in deployment policy. Until workspace-specific controls ship:

| Class | Default retention | Notes |
|-------|-------------------|-------|
| Workspace / repo metadata | Life of workspace | Deleted with workspace when permitted |
| Audit runs and findings | Life of workspace | Export before delete if required |
| Review history | Life of workspace | Required for audit trail |
| Published issue links | Life of workspace | May outlive internal audit rows if exported to GitLab |
| Analytics events | Per PostHog project settings | No secrets in event properties |
| Application logs | Minimum needed for ops | Prefer structured, redacted logs |

Adjust durations for compliance requirements before enterprise rollout.

## Deletion rules

- Users must be able to delete their workspace data when permitted by plan and role
- Published issue links may need separate handling from internal audit data (external GitLab issues are not automatically deleted)
- Logs must be retained only as long as needed for ops and support
- Credentials, tokens, and raw secrets must never be retained in logs or finding text
- Deletion must be explicit; no silent orphan of review records without policy

## Export rules

- Users must be able to export audit history and findings where product supports it
- Exports must not leak secrets (tokens, env values, private keys)
- Exports should preserve provenance: run id, specialist, evidence pointers, review actions

## Backup and recovery

- Production Postgres: follow Supabase backup and point-in-time recovery for the chosen tier
- Neo4j graph: backup policy must match graph store deployment (local dev uses `docker-compose.yml`)
- Recovery window must be documented for operators before claiming production readiness

## Minimum retention gate

Premortem is not production-ready unless the team can state exactly:

1. What data is stored
2. Why it is stored
3. How it is deleted
4. How exports work without leaking secrets

Cross-reference: [production-boundaries.md](production-boundaries.md), [SECURITY.md](../../SECURITY.md)

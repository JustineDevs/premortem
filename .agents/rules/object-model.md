# Object Model

Canonical domain: structural shapes for findings, clusters, issue candidates, and reviews.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

JSON Schema mirrors: `.agents/schemas/` (see `finding.v1.json`, `cluster.v1.json`, `issue-candidate.v1.json`, `review-record.v1.json`).

## Finding

Logical contract (aligns with synthesizer and specialist output):

```json
{
  "id": "finding_123",
  "run_id": "run_123",
  "specialist": "ci-regression-specialist",
  "title": "Flaky job pattern in deployment pipeline",
  "summary": "A deployment job shows unstable retries across recent CI runs.",
  "severity": "medium",
  "confidence": 0.82,
  "scope": {
    "repo": "group/project",
    "branch": "main",
    "paths": [".gitlab-ci.yml"]
  },
  "evidence": [
    {
      "type": "ci_log_reference",
      "pointer": "pipeline:456/job:deploy"
    }
  ],
  "reasoning": {
    "hypothesis": "retry masking may hide deploy instability",
    "why_it_matters": "unstable deploys reduce release confidence"
  },
  "status": "candidate"
}
```

Runtime: stored inside `AuditRunSnapshot` and projected for console via `projectIssueCandidateToConsoleFinding` and related mappers in `packages/domain` and `apps/web/src/lib/premortem-api/map-runtime-to-console.ts`.

## Cluster

```json
{
  "id": "cluster_123",
  "run_id": "run_123",
  "finding_ids": ["finding_123", "finding_124"],
  "theme": "deployment instability",
  "dedupe_reason": "same failure mode across related jobs",
  "status": "open"
}
```

Dashboard “Active Risk Clusters” must link to real audit/issue scope (`auditRunId` on cluster projection).

## Issue candidate

```json
{
  "id": "issue_candidate_123",
  "run_id": "run_123",
  "cluster_id": "cluster_123",
  "title": "Investigate unstable deployment retries in main pipeline",
  "body": "Structured issue body here",
  "source_finding_ids": ["finding_123", "finding_124"],
  "review_state": "pending",
  "version": 1,
  "publish_target": "gitlab"
}
```

Review state enums: `ReviewStatus` in `packages/domain/src/review.ts`. Edits must bump version; publish requires approved/edited state per production boundaries.

## Review record

```json
{
  "id": "review_123",
  "issue_candidate_id": "issue_candidate_123",
  "action": "approve",
  "reviewer": "user_123",
  "notes": "Title is good. Body edited for clarity.",
  "version_before": 1,
  "version_after": 2,
  "timestamp": "2026-06-11T11:00:00Z"
}
```

## Mutable artifact rule

Any user-visible edit to an issue candidate creates a new version. Non-versioned edits are a production anti-pattern.

## Schema validation

Agent and BFF layers should validate against schemas before persisting or displaying as canonical. Eval gate: `packages/evals/` validates synthesizer JSON shape.

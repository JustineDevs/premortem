# Failure Policy

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [workflows.md](workflows.md)

## Purpose

Defines how Premortem behaves when parts of the system fail. Failure is normal. Hidden failure is not.

## Failure principles

| Principle | Meaning |
|-----------|---------|
| Fail fast on invalid setup | Misconfigured auth, missing GitLab, or bad env surfaces before work starts |
| Preserve partial progress | Findings and checkpoints saved when a later stage fails |
| Tell the user exactly what failed | Name boundary, not generic errors |
| Keep the system resumable | Paused checkpointed runs support Resume where implemented |
| Never fake success | No green UI for failed publish, ingest, or specialist stages |

## Common failure categories

| Category | Typical cause | User-facing need |
|----------|---------------|------------------|
| GitLab auth failure | Expired token, missing OAuth | Reconnect integration |
| Azure / LLM deployment failure | Bad endpoint, quota, timeout | Fix provider config |
| Model timeout | Slow or overloaded model | Retry or narrow scope |
| Specialist execution failure | Single agent error | Show which specialist; continue others if safe |
| Clustering / synthesis failure | Invalid JSON, schema reject | Show validation error; preserve raw findings |
| Publish failure | Permission, duplicate, API error | Show external system response; guard duplicates |
| Stripe webhook failure | Signature, misconfiguration | Ops alert; no entitlement drift |
| Storage write failure | DB or object store | Retry idempotent writes; do not lose review state |

Implementation surfaces: `AuditReadinessError` in `@premortem/db`, BFF 4xx/5xx with `code` and `field`, runtime console stage labels.

## Required behavior per failure

For each failure class the system must know and communicate:

1. **What** failed
2. **Where** it failed (ingest, specialist id, publish, etc.)
3. **Whether any data was saved**
4. **Whether the user can retry**
5. **What the user should fix next**

Structured refusal envelope when skipping work: see [refusal-and-anti-patterns.md](refusal-and-anti-patterns.md).

## Retry policy

- Safe retries are allowed for idempotent reads and bounded re-runs
- Duplicate publish attempts must be guarded (idempotency keys or state checks)
- Idempotent steps should remain idempotent under retry
- Non-idempotent steps must be explicitly protected before external writes

## Resume policy

```text
Connect repo
-> validation or execution fails
-> preserve partial state
-> identify exact failed boundary
-> communicate corrective action
-> resume from failed step
```

Rules:

- Failed runs should resume from the last valid checkpoint where possible (`POST /api/audits/[id]/resume`)
- **Stop all** cancels queued/running/paused and disables continuous audit (`POST /api/workspace/runtime/stop-all`)
- Turning continuous audit OFF does not cancel in-flight runs
- If resume is impossible, preserve artifacts and explain why

## UI and ops

- Runtime console must show failed stage truthfully ([ux-behavior.md](ux-behavior.md))
- Sentry captures unhandled exceptions; PostHog for product funnels, not secret payloads
- Smoke verification: `pnpm run smoke:production-readiness`, `scripts/smoke/verify-web-bff.mjs`

## Minimum failure gate

Premortem is not production-ready unless failure paths are explicit, recoverable, and visible to users.

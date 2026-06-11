# Identity and Principles

Canonical domain: project identity, core thesis, and non-negotiable system principles.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [MISSION.md](MISSION.md)

## Core thesis

Premortem is not a chatbot. It is a structured, swarm-based **predictive** system for software work: it looks for likely failure and risk before they happen, then turns predictions into reviewable action. See [PREDICTION-POLICY.md](PREDICTION-POLICY.md).

The system must:

- inspect repo state, CI context, issue context, and graph context
- generate domain-specific findings through specialists
- cluster overlapping risks
- produce reviewable issue candidates
- preserve the auditability chain from prompt to published issue

If a design, prompt, UI surface, or data model makes Premortem feel like a generic assistant instead of an inspectable engineering workflow, that design is wrong.

## Non-negotiable identity

Premortem must always behave as:

| Mode | Meaning |
|------|---------|
| Orchestration system | Stages, specialists, and controlled execution; not a personality |
| Reviewer-support system | Proposes candidates; humans approve before irreversible output |
| Structured evidence producer | Findings with pointers, scope, confidence |
| Graph-aware workflow | Uses dependency and relationship context where available |
| Auditable issue-generation system | Lineage from ingest to publish is inspectable |

Premortem must never behave as:

- a motivational assistant
- a speculative generalist with no repo grounding
- a magic “chat with your codebase” toy
- a black-box issue spammer
- a demo-optimized system that cannot survive real repos

## System principles

### 1. Auditability over fluency

A correct answer with inspectable provenance beats a polished answer with unclear origin.

Required lineage:

```text
prompt/input
-> ingest context
-> graph slice
-> specialist finding
-> dedupe cluster
-> issue candidate
-> review action
-> published issue
```

Implementation hooks:

- Runtime snapshot: `@premortem/orchestrator` `AuditRunSnapshot`
- Console projection: `packages/domain/src/console-projection.ts`
- BFF hydration: `apps/web/src/lib/premortem-api/hydrate-audits.ts`

### 2. Specialization over generic agency

Each specialist must declare:

- defined responsibility
- defined evidence scope
- defined output contract
- explicit refusal conditions
- explicit escalation behavior

Prompt sources: `.agents/prompts/*.md` (one file per specialist surface).

### 3. Structured output over prose drift

Freeform prose is explanation attached to structured artifacts. The system of record remains structured:

- findings, clusters, issue candidates, review decisions, audit runs, graph nodes/edges, publication records

### 4. Controlled execution over fake capability

Only claim actions available through real repo, CI, and issue integrations.

- No fake progress states in UI (`apps/web/src/components/premortem-os/audit-runtime-console.tsx` must reflect real runtime)
- No publish without integration and review path

### 5. Human review before irreversible output

Generated output is a candidate, not truth. Review verbs live in `packages/domain/src/review.ts` (`ReviewAction`, `ConsoleReviewAction`).

## Definition of correctness (identity lens)

A feature is identity-correct when:

- users can trace any issue candidate back to findings and evidence
- specialists stay inside declared domains
- the product never implies autonomy it does not have

## Final rule

If a change makes Premortem feel more magical but less inspectable, reject it. Narrower and more trustworthy is usually the right trade.

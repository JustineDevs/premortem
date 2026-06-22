# Premortem ADR 0001

> [!IMPORTANT]
> This ADR is the canonical single-file product and system design record for Premortem. It is intended to hold the deepest tracked architectural context for the project in one place: problem framing, system model, trust boundaries, stack choices, reviewer workflow, artifact model, runtime states, delivery constraints, and rejected alternatives.

> [!NOTE]
> This file is the tracked architecture authority for the current Premortem direction. It is intentionally detailed. It should be read together with `docs/product/flows.md`, `docs/security/session-design.md`, `docs/runbooks/queueing.md`, `docs/releases/releases-notes-v0.1.0.md`, and the current implementation notes, but this ADR is the single-file reference that unifies them.

---

## 1. Executive Definition

Premortem is a reviewer-first, graph-aware, swarm-orchestrated predictive repository intelligence system.

Its central claim is:

> Repositories should be treated as living delivery systems whose likely future failures can be predicted, structured, reviewed, and converted into accountable engineering action before production damage occurs.

In practical terms, Premortem combines:

- bounded repository and CI ingestion
- specialist-agent swarm execution
- structured finding validation
- conservative clustering and synthesis
- reviewer-controlled issue generation
- full auditability from run configuration to published artifact

Premortem is not a generic AI assistant and not merely a scanner wrapper. It is an operational reasoning and review layer for software delivery risk.

---

## 2. Status and Scope

### Status

Current status:

- architecture defined
- implementation active
- `v0.1.0` scope locked

### Scope of this ADR

This ADR defines:

- what Premortem is
- what it is not
- which technologies are canonical
- which trust boundaries are mandatory
- which workflow states must exist
- what `v0.1.0` must prove

This ADR does not claim that every subsystem is already complete in the current checkout.

---

## 3. Project Mission

The mission of Premortem is to create the reviewer-trusted orchestration layer for repository intelligence.

That means building one product that can:

- connect to repository and CI surfaces
- construct a shared operational truth substrate
- run specialist agents over the same bounded context
- predict likely delivery failures instead of merely reporting static defects
- convert those predictions into structured and inspectable issue candidates
- preserve accountability across every generated recommendation and publication decision

### Mission outcomes

| Outcome | Meaning |
| --- | --- |
| Better foresight | Teams see likely failure modes before they become incidents |
| Better review | Findings are structured, inspectable, and human-approvable |
| Better coordination | Specialist agents operate over shared truth instead of isolated prompt context |
| Better accountability | Every candidate can be traced back to evidence and review actions |
| Better delivery hygiene | Repository, CI, and issue workflows become one governed loop |

---

## 4. Problem Statement

Modern engineering teams do not usually fail because they lack tools.

They fail because they lack a coherent way to answer:

> What is this repository likely to break next, why, and what should be done before shipping?

### Current failure pattern

Most teams accumulate:

- CI failures
- scanner alerts
- issue backlogs
- undocumented tribal knowledge
- ownership gaps
- release friction
- disconnected AI summaries

### System-level failures this creates

| Failure | What Happens | Why It Matters |
| --- | --- | --- |
| Flat detection | Tools report isolated facts instead of system behavior | Higher-order risk patterns stay hidden |
| Weak prediction | Most tools describe present state, not likely failure | Reviews remain reactive |
| Context fragmentation | Code, CI, ownership, and issue state live in separate systems | No single runtime sees the operational picture |
| Generic AI output | Assistants produce plausible text without system grounding | Findings feel untrustworthy |
| Low accountability | Teams cannot explain how an issue candidate was generated | Review confidence collapses |

### Deeper problem

The deeper problem is not simply “too many findings.”

The deeper problem is that repository behavior is rarely modeled as an evolving, graph-shaped system with accountable predictive reasoning.

Without that model:

- agents cannot coordinate precisely
- context remains shallow
- future risk collapses into present-state linting
- review becomes noisy and subjective
- publishable engineering action remains slow and brittle

---

## 5. Product Identity

Premortem is:

- graph-aware
- swarm-orchestrated
- reviewer-first
- evidence-backed
- traceability-driven
- GitLab-first for `v0.1.0`

Premortem is not:

- a generic chatbot over code
- an analysis dashboard
- an autonomous issue bot
- a markdown summary generator
- a loose collection of prompts with no lifecycle governance

### Identity table

| Premortem is | Premortem is not |
| --- | --- |
| predictive | purely descriptive |
| structured | prose-only |
| reviewer-gated | autopublishing |
| accountable | opaque |
| graph-aware | flat-text only |
| swarm-based | single-generalist only |

---

## 6. Architecture Thesis

Premortem is shaped by the following architectural theses.

| Thesis | Architectural Meaning |
| --- | --- |
| Repositories are systems | Code, CI, ownership, and issue state form one operational surface |
| Prediction matters more than enumeration | The product must reason about likely future failure, not only current defects |
| Swarm beats monolith | Many specialist agents with bounded scope outperform one generic auditor |
| Shared truth is first-class | All agents should operate over the same bounded context model |
| Review is part of runtime | Human review is a core product surface, not post-processing |
| Accountability is mandatory | Every publishable artifact must be traceable |
| Structured artifacts beat prose | Findings, clusters, candidates, and histories must be strongly typed |
| State clarity matters | Audit and publication states must be explicit and inspectable |
| Calm systems win trust | UI and workflow should reduce noise while exposing hard truths |

---

## 7. Canonical Stack Decision

The canonical technology direction is:

- `Next.js` for the application shell
- `Supabase Auth` as the only primary application auth/session authority
- `Supabase Postgres` as the only database
- `Supabase Storage` for artifacts when required
- `Prisma` for schema ownership and application data access
- `Cloudflare Queues` for bounded async audit execution
- `TanStack Query` for reviewer-console server state
- `Sentry` for runtime errors, traces, and failure visibility
- `PostHog` for analytics, feature flags, and product telemetry
- `Stripe` for billing, subscriptions, and commercial state
- `GitLab` as the only provider in `v0.1.0`

### Why this stack is canonical

Each subsystem has one job:

| System | Role |
| --- | --- |
| Next.js | route shell, public surface, reviewer surface |
| Supabase Auth | identity and session authority |
| Supabase Postgres | product data and relational source of truth |
| Supabase Storage | artifacts and evidence blobs |
| Prisma | data modeling and repository access layer |
| Cloudflare Queues | audit fan-out and bounded async execution |
| TanStack Query | reviewer mutations, invalidation, and queue refresh state |
| Sentry | operational failure visibility |
| PostHog | product behavior analytics and flags |
| Stripe | billing and commercial state |
| GitLab | repository, CI, issue provider |

### Rejected alternatives

| Alternative | Why Rejected |
| --- | --- |
| dual-primary auth systems | creates identity ambiguity and RLS drift |
| separate PostgreSQL outside Supabase | adds infrastructure without solving a current product problem |
| replacing queue execution with a second workflow platform now | widens the platform surface too early |
| Stripe-driven identity | billing is not application auth |
| generic client-side state only | reviewer workflow is server-state heavy and mutation-sensitive |

---

## 8. Non-Negotiable Boundary Rules

The following rules are mandatory.

### Identity

- Supabase Auth is the only primary app identity authority.
- No second auth system may become a parallel reviewer-session authority.
- Stripe must not become an identity or reviewer-session system.

### Data

- Supabase Postgres is the only database.
- No separate PostgreSQL system should be introduced for the main product path.
- Product entitlements mirrored from Stripe must live in Supabase-owned product tables.

### Provider authority

- GitLab provider tokens remain backend-only.
- Raw provider secrets must never enter browser code.

### Reviewability

- candidate edits must be versioned
- destructive overwrite is forbidden
- publish and reconciliation are distinct states

### Routing

- the reviewer application must converge on one canonical route
- duplicate primary reviewer entrypoints are not acceptable long-term

---

## 9. Core System Model

At the center of Premortem is one orchestrated runtime composed of:

- repository provider connections
- bounded ingestion
- shared audit context
- specialist-agent swarm execution
- validation and clustering
- reviewer-controlled publication flows
- explicit reconciliation

### High-level system diagram

```text
+------------------------------------------------------------------------+
|                           Premortem Runtime                            |
+------------------------------------------------------------------------+
| Public Surface | Reviewer App | API Routes | Queue Workers | Provider  |
+----------------+--------------+------------+---------------+-----------+
        |                |               |               |          |
        v                v               v               v          v
  Next.js static   Next.js reviewer   Auth/session   Async audit   GitLab
  landing/docs     console            enforcement    execution     and issue APIs
        |                |               |               |          |
        +----------------+---------------+---------------+----------+
                                |
                                v
                    Supabase Postgres + Storage
                                |
                                v
                 Findings -> Clusters -> Candidate Versions
                                |
                                v
                   Review Action -> Publish -> Reconcile
```

---

## 10. Product Surfaces

Premortem has two primary surfaces.

### 1. Public surface

Purpose:

- explain the product
- explain the workflow
- drive sign-in and onboarding
- present docs, pricing, and policy material

Characteristics:

- static by default
- zero provider authority
- no fake reviewer data

### 2. Reviewer surface

Purpose:

- select project and branch
- start audits
- inspect queue state
- review findings and candidates
- approve, reject, edit, split, merge, publish, and reconcile

Characteristics:

- authenticated
- evidence-first
- operational rather than decorative
- mutation-aware and state-explicit

---

## 11. Core Workflow Model

The product loop is:

1. connect project/provider
2. create audit
3. enqueue bounded async run
4. ingest bounded repository context
5. run specialist agents
6. validate findings
7. cluster and synthesize candidates
8. review candidates
9. publish approved issue
10. reconcile external state

### Happy path

For `v0.1.0`, the happy path is:

1. reviewer signs in
2. reviewer connects one GitLab project
3. reviewer selects one branch
4. reviewer starts one audit
5. system enqueues one bounded audit job
6. findings and candidates become reviewable
7. reviewer edits or approves one candidate
8. system publishes one approved issue to GitLab
9. reconciliation confirms external truth

### Failure path

The system must also express:

- reconnect required
- enqueue failure
- partial audit success
- invalid output rejection
- publish failure
- reconciliation drift

---

## 12. Audit Lifecycle

Audit lifecycle must be explicit.

### Canonical audit states

- `draft`
- `created`
- `enqueued`
- `running`
- `partial`
- `completed`
- `failed`
- `cancelled`

### Audit invariants

- `created` is not the same as `enqueued`
- `enqueued` is not the same as `running`
- retries must not create uncontrolled duplicate runs
- cancellation prevents new lease renewal
- dead-letter behavior must preserve diagnostic context

---

## 13. Candidate Lifecycle

Issue candidate lifecycle must be explicit and versioned.

### Canonical candidate states

- `generated`
- `validated`
- `reviewable`
- `edited`
- `approved`
- `rejected`
- `published`
- `reconciled`
- `drifted`

### Candidate invariants

- every edit creates a new candidate version
- publishability depends on validation, evidence, and review state
- `published` is not the same as `reconciled`
- rejected items remain historically inspectable

---

## 14. Trust Boundaries

### Browser boundary

Browser may access:

- Supabase-authenticated session state
- reviewer-visible data permitted by product authorization
- public docs and marketing content

Browser must not access:

- GitLab provider tokens
- Supabase service role keys
- queue credentials
- internal signing or worker secrets

### Backend boundary

Backend may access:

- session validation helpers
- service keys where necessary
- GitLab provider token references
- queue bindings
- analytics and error reporting credentials

### Worker boundary

Workers may access:

- scoped service authority
- queue payloads
- ingestion and analysis execution context
- publish and reconciliation internals when required

### Commercial boundary

Stripe may own:

- customers
- subscriptions
- invoices
- checkout sessions
- commercial entitlements inputs

Stripe must not own:

- primary app identity
- reviewer session state
- direct reviewer authorization decisions without mirrored product-state mediation

---

## 15. Auth and Authorization Model

### Auth model

- application sign-in is handled by Supabase Auth
- reviewer session authority is Supabase-only
- Stripe does not participate in primary auth

### Authorization model

Authorization should be derived from:

- authenticated user identity
- organization membership
- project/provider connection ownership
- reviewer role permissions
- mirrored entitlement state where commercial gating exists

### Authorization invariants

- commercial state must not bypass reviewer role checks
- entitlements may gate features, not identity truth
- RLS and backend authorization must agree on the same user identity basis

---

## 16. Data Model

The following entity set is canonical.

### Identity and orgs

- `users`
- `organizations`
- `organization_memberships`

### Provider and project context

- `provider_connections`
- `projects`
- `project_branches`

### Audit runtime

- `audit_runs`
- `agent_runs`
- `audit_events`

### Finding and synthesis

- `findings`
- `finding_evidence`
- `finding_clusters`

### Review and publication

- `issue_candidates`
- `issue_candidate_versions`
- `review_actions`
- `published_issues`
- `reconciliation_events`

### Commercial state

- `billing_customers`
- `billing_subscriptions`
- `feature_entitlements`

### Why this model

This model keeps:

- runtime state relational
- review history explicit
- candidate lineage durable
- billing state separate from identity

---

## 17. Auditability Chain

The auditability chain is mandatory:

`run_config -> agent_run -> finding -> cluster -> candidate_version -> review_action -> published_issue -> reconciliation_event`

### Why it exists

Without this chain:

- reviewers cannot trust candidates
- edit history loses meaning
- published issues become hard to defend
- regressions become difficult to analyze

Lineage is not optional debugging metadata. It is part of the product contract.

---

## 18. Reviewer Experience Principles

The reviewer surface should optimize for:

- clarity
- evidence
- explicit state
- minimal ambiguity
- low mutation surprise

### UX rules

- one primary reviewer route
- one dominant object chain:
  - project -> audit -> candidate -> publish
- one dominant action per screen
- state changes must be visible and explainable
- error and partial states must be first-class, not hidden

---

## 19. Observability

Observability is required for both product and runtime trust.

### Runtime observability

Use Sentry for:

- server route errors
- worker failures
- publish errors
- reconciliation failures
- trace correlation across audit runs

### Product observability

Use PostHog for:

- onboarding funnel events
- reviewer interaction patterns
- queue and publish behavior analysis
- controlled feature rollout

### Observability rule

Telemetry must not become a second source of truth for core workflow state. Product state lives in the database.

---

## 20. Queueing and Async Execution

Cloudflare Queues is the canonical async mechanism for `v0.1.0`.

### Queue model

- audit creation generates idempotency-aware enqueue requests
- workers lease jobs before execution
- retries are capped
- poison jobs move to dead-letter storage
- cancellation prevents further lease renewal

### Why this remains canonical

The bounded queue model matches the product better than an overly broad workflow platform at the current stage.

---

## 21. Security and Sensitive Data Paths

Sensitive paths include:

- provider OAuth tokens
- Supabase service keys
- queue credentials
- repository-derived evidence and internal paths
- billing customer identifiers

### Sensitive data handling rules

- provider secrets remain backend-only
- service credentials never enter browser bundles
- internal-only security detail stays in ignored/private docs
- public docs remain reusable and non-sensitive

---

## 22. `v0.1.0` Delivery Contract

`v0.1.0` must prove one coherent loop:

- one GitLab-first provider path
- one bounded async audit path
- one reviewer-first queue
- one candidate review flow
- one publish and reconcile flow
- one traceability chain

### In scope

- Supabase-authenticated reviewer flow
- GitLab project connection
- branch selection
- queue-backed audit execution
- findings and issue candidates
- versioned review actions
- publish to GitLab
- reconciliation visibility

### Out of scope

- GitHub parity
- enterprise auth rollout
- workflow-engine replacement
- advanced graph diffing
- multi-provider expansion
- billing automation beyond bounded commercial support

---

## 23. Rejected Alternatives

The following alternatives are intentionally rejected for the current direction.

### 1. Dual auth systems

Rejected because:

- identity becomes ambiguous
- RLS semantics become brittle
- session truth fragments

### 2. Separate PostgreSQL outside Supabase

Rejected because:

- it adds operational burden
- it duplicates data infrastructure
- it solves no current architectural gap

### 3. Commercial platform as auth platform

Rejected because:

- billing systems should not own reviewer identity
- commercial state should influence entitlements, not primary session authority

### 4. Unbounded workflow platform expansion now

Rejected because:

- platform complexity grows faster than product value
- queue-backed bounded execution is sufficient for current scope

---

## 24. Open Questions

The following questions remain valid but non-blocking if managed carefully:

1. Which single reviewer route should become canonical long-term?
2. How should Stripe-backed entitlement state mirror into product feature access?
3. What is the exact conflict policy when two reviewers edit or publish the same candidate near-simultaneously?
4. How much evidence should remain inline versus referenced as artifacts?

---

## 25. Final Decision

Premortem will be built as a reviewer-first, GitLab-first, swarm-orchestrated repository intelligence system using:

- Next.js
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Prisma
- Cloudflare Queues
- TanStack Query
- Sentry
- PostHog
- Stripe

The architecture is explicitly designed to preserve:

- one identity authority
- one database
- one bounded async runtime
- one reviewer-controlled publication model
- one full auditability chain

That is the canonical system design direction unless a later ADR supersedes it.

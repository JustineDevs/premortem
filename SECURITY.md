# Security Policy

Security is mandatory. Premortem handles repository access tokens, LLM provider keys, reviewer identity, billing state, and GitLab publication paths. Authentication, authorization, secret isolation, webhook verification, and audit traceability are required, not optional.

Repository hygiene is enforced with Knip for dead-code and dependency drift (`pnpm run lint:deadcode`) and TruffleHog for secret scanning (`pnpm run scan:secrets`).

---

## System Architecture Overview

Premortem is a layered platform. Each layer has distinct security responsibilities and trust boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                                │
│  Marketing + auth (Next.js) │ Reviewer console (/app) │ Supabase session    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BFF LAYER (apps/web route handlers)                                       │
│  Actor context forwarding │ Stripe checkout/webhooks │ Integration OAuth   │
│  No raw provider secrets in browser bundles                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API RUNTIME LAYER (apps/api)                                                │
│  Supabase JWT validation │ org-scoped authorization │ CORS │ audit enqueue  │
│  Dev-only: PREMORTEM_AUTH_DISABLED + LOCAL_DEV_FIXTURE (never in prod)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR LAYER (services/orchestrator)                                 │
│  Queue-backed audit jobs │ specialist execution │ pause/resume checkpoints │
│  Publish/reconcile to GitLab │ structured audit events                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  DATA LAYER      │    │  PROVIDER LAYER   │    │  COMMERCIAL      │
│  Supabase        │    │  GitLab OAuth /   │    │  Stripe checkout │
│  Postgres        │    │  tokens, ingest,  │    │  webhooks, plan  │
│  (Prisma),       │    │  issue publish    │    │  entitlements    │
│  Storage, RLS    │    │                   │    │  (not identity)  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

Canonical trust-boundary reference: [docs/architecture/adr-0001-canonical-product-and-system-design.md](./docs/architecture/adr-0001-canonical-product-and-system-design.md) (sections 14, 15, 21).

---

## Layer 1: Client (Web)

| Component | Security responsibility |
|-----------|-------------------------|
| **Marketing & auth** | Public pages and Supabase Auth sign-in; session tokens stay in browser cookie/session storage patterns supported by `@supabase/ssr`. |
| **Reviewer console (`/app`)** | Thin client over BFF routes; displays only data permitted by org membership and entitlements. |
| **Provider connect** | OAuth completion flows; tokens are persisted server-side, not exposed to client bundles. |
| **LLM configuration** | Provider keys and deployment settings are submitted over HTTPS to server routes; never embedded in client JavaScript. |
| **CORS** | Production reviewer origin is constrained via `CORS_ORIGIN` on the API runtime. |

The browser must not receive GitLab tokens, Supabase service-role keys, queue credentials, Stripe secrets, or internal signing material.

---

## Layer 2: BFF (Next.js Route Handlers)

| Component | Security responsibility |
|-----------|-------------------------|
| **Actor forwarding** | BFF resolves the signed-in user and forwards actor headers (`x-premortem-actor-id`, organization context) to `apps/api`. |
| **Auth routes** | Supabase callback, logout, and session refresh remain server-side. |
| **Audit & workspace APIs** | Proxy to runtime API with actor context; no direct DB access from arbitrary client-supplied org IDs without server validation. |
| **Stripe checkout** | Checkout session creation uses server-only `STRIPE_SECRET_KEY`. |
| **Stripe webhooks** | Signature verification via `STRIPE_WEBHOOK_SECRET` before mutating billing state (`apps/web/app/api/stripe/webhook/route.ts`). |

BFF owns HTTP edge behavior for the web app. Pipeline logic, token storage, and publish authority live in API + orchestrator layers.

---

## Layer 3: API Runtime

| Component | Security responsibility |
|-----------|-------------------------|
| **JWT auth** | `resolveApiActorContext` verifies Supabase access tokens on protected routes unless `PREMORTEM_AUTH_DISABLED=1` (local dev only). |
| **Organization scope** | Mutations derive `organizationId` from authenticated profile membership, not from unvalidated client body fields alone. |
| **Entitlements** | Repo registration, audit enqueue, and publish paths enforce `PLAN_LIMITS` server-side (`packages/db/src/entitlements.ts`). |
| **CORS** | `CORS_ORIGIN` restricts browser cross-origin access to the API in deployed environments. |
| **Runtime stop-all** | `POST /api/workspace/runtime/stop-all` cancels active runs and disables continuous audit for the org (operator control, auth-gated). |

**Required env (typical production):** `DATABASE_URL`, `DIRECT_URL`, Supabase URL/keys, valid Supabase JWT verification path, `CORS_ORIGIN` aligned with the deployed web origin.

**Local dev only:** `PREMORTEM_AUTH_DISABLED=1` with `LOCAL_DEV_FIXTURE`. Never enable in production.

---

## Layer 4: Orchestrator

| Component | Security responsibility |
|-----------|-------------------------|
| **Job execution** | Audit jobs run with scoped service authority; payloads contain org/project/run IDs, not end-user passwords. |
| **Cooperative pause/resume** | Pause saves checkpoints; resume re-enqueues from persisted state. Stop all cancels via API, not client-side race. |
| **Specialist outputs** | Malformed agent output is dropped or marked failed; validation gates feed reviewable findings only. |
| **Publish path** | GitLab publish uses stored provider tokens server-side; no silent publish without reviewer approval on first-run paths. |
| **Reconciliation** | Drift events are persisted for inspectability; failed publish leaves approved-but-unpublished state with retryable errors. |

Orchestrator never logs raw LLM keys or provider OAuth secrets.

---

## Layer 5: Data Layer

| Store | Security responsibility |
|-------|-------------------------|
| **Supabase Postgres** | Canonical product schema via Prisma: orgs, memberships, provider connections, audit runs, findings, candidates, review actions, published issues, reconciliation, billing accounts. RLS and backend authorization must agree on the same user identity basis. |
| **Supabase Storage** | Artifact bucket (`SUPABASE_STORAGE_BUCKET`); no secrets in pinned objects. |
| **Provider token storage** | GitLab (and future provider) tokens stored as backend references; browser receives connection status, not plaintext tokens. |
| **Audit events** | Structured lifecycle events for inspectability and support reconstruction. |

Storage policy: public docs stay non-sensitive; internal security assessments and customer notes belong in gitignored `/internal`, `/.internal`, or `/docs/internal` (see [docs/security/public-vs-private-docs.md](./docs/security/public-vs-private-docs.md)).

---

## Layer 6: Providers and Commercial

| Integration | Security responsibility |
|-------------|-------------------------|
| **GitLab** | OAuth (`GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`) or scoped token; separate validation for repo read vs issue write before onboarding continues. |
| **LLM providers** | `GEMINI_API_KEY` is server-only; used inside orchestrator/LLM packages, never shipped to the client. |
| **Stripe** | Owns customers, subscriptions, checkout, and webhook-driven plan inputs. Must not become primary app identity or reviewer session authority. |
| **Observability** | `SENTRY_DSN`, `POSTHOG_*` keys: configure server vs public DSN/key split correctly; do not leak PII in custom event payloads. |

---

## Sensitive Data Handling Rules

Sensitive paths include:

- provider OAuth and API tokens
- Supabase service-role keys
- queue and worker credentials
- LLM provider keys
- billing customer identifiers and webhook secrets
- repository-derived evidence and internal paths

Hard rules:

- Provider secrets remain backend-only.
- Service credentials never enter browser bundles or `NEXT_PUBLIC_*` variables.
- Never commit credentials to the repository. Use `.env.local` (gitignored) or deployment secret stores.
- Review actions and publish decisions must remain traceable to authenticated reviewers.

Session boundary summary: [docs/security/session-design.md](./docs/security/session-design.md).

---

## Inbound Webhooks

| Webhook | Secret env | Verification |
|---------|------------|--------------|
| Stripe billing | `STRIPE_WEBHOOK_SECRET` | `stripe.webhooks.constructEvent` on raw body; reject missing/invalid signatures |

Canonical route: `POST /api/stripe/webhook`. In production, missing webhook secrets should fail closed (503) where implemented.

Organization notification webhooks (if enabled) should use signed payloads and shared secrets configured per workspace policy, verified before mutating alert state.

---

## Authorization and Review Governance

Non-negotiable product gates (see [.agents/rules/production-boundaries.md](./.agents/rules/production-boundaries.md)):

| Invariant | Requirement |
|-----------|-------------|
| Review before publish | No issue auto-published on first-run paths without explicit human approval. |
| Auditability chain | Prompt → finding → cluster → candidate → review action → published issue must be inspectable. |
| Bounded first run | Initial audit scope stays intentionally narrow for cost and safety. |
| Permission safety | Repo and issue APIs accessed through controlled, permission-scoped execution. |
| Commercial vs identity | Stripe entitlements may gate features; they must not bypass reviewer role checks. |

---

## Deployment Checklist

1. Set `DATABASE_URL` and `DIRECT_URL` (Supabase pooler + direct).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Disable `PREMORTEM_AUTH_DISABLED` in production; verify Supabase JWT validation on API routes.
4. Set `CORS_ORIGIN` to the production web origin (e.g. `https://premortem.jstn.site` per `.env.example`).
5. Configure GitLab OAuth or token vars; verify repo read and issue write separately before onboarding.
6. Set `GEMINI_API_KEY` server-side only.
7. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` when billing is enabled; test webhooks in Stripe test mode first.
8. Configure Sentry and PostHog with appropriate public vs server key split.
9. Confirm entitlements enforcement (`PLAN_LIMITS`) for repo count, monthly audits, and publish capability.
10. Run smoke verification: `scripts/smoke/verify-runtime-pipeline.mjs`, `scripts/smoke/verify-web-bff.mjs`, and `pnpm run smoke:production-readiness`.
11. Keep internal-only security detail out of public docs and tracked markdown when it exposes operational weaknesses or customer data.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| `v0.1.0` (latest tagged) | Yes |
| Earlier / untagged checkouts | No |

This project is in active development. Security fixes target the latest release line first.

---

## Policy vs Implementation

This file is the policy. Deeper technical architecture, rejected alternatives, and production go/no-go gates live in:

- [.agents/rules/CORE-BEHAVIOR.md](./.agents/rules/CORE-BEHAVIOR.md) and domain rules (mission, prediction, retention, failure)
- [docs/architecture/adr-0001-canonical-product-and-system-design.md](./docs/architecture/adr-0001-canonical-product-and-system-design.md)
- [docs/security/session-design.md](./docs/security/session-design.md)

Treat ADR trust boundaries as the source of truth when implementation and policy appear to diverge.

---

## Reporting Vulnerabilities

Report security issues privately. **Do not open public issues for vulnerabilities.**

Email: `justinedevs@jstn.site`

Include:

- A clear description of the issue
- Reproduction steps or proof of concept
- Affected files, services, or environments
- Severity estimate and possible impact
- Suggested remediation if available

We aim to acknowledge valid reports promptly, reproduce the issue, assess severity, prepare a fix, and coordinate disclosure timing with the reporter.

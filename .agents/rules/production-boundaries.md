# Production Boundaries

Canonical domain: logging, traceability, versioning, publish guards, metrics.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Minimum production criteria

- All critical actions logged
- All external writes traceable
- All review edits versioned
- Publish actions idempotent or safely guarded
- Agent outputs schema-validated
- Failures preserve recoverable state (see [failure-policy.md](failure-policy.md))
- Onboarding and workflow health metrics measurable

Reference checklist: [production-boundaries.md](production-boundaries.md), `pnpm run smoke:production-readiness`

## Hard boundaries

```text
No hidden operator intervention for ordinary runs.
No secret manual patching of missing findings.
No direct publish without explicit review state.
No non-versioned edits to issue candidates.
No opaque confidence values without evidence boundary.
```

## Stack observability

| Concern | Integration |
|---------|-------------|
| Errors | Sentry (`packages/observability`) |
| Product analytics | PostHog |
| LLM prompts/scores (optional) | Langfuse |
| Canonical verification | `node scripts/canonical/verify-stack.mjs` |

## Auth and BFF

- Supabase auth for user sessions
- BFF routes proxy to API with actor headers (`resolveRequestActorContext`, `actorHeaders`)
- Rate limits: `apps/web/src/lib/server/bff-rate-limit.ts`

## Billing and entitlements

Plan limits: `PLAN_LIMITS` in `@premortem/db`. Stripe checkout uses monthly/annual price env vars.

## Local dev

- Web `:13000`, API `:18787` via `pnpm run dev`
- `PREMORTEM_AUTH_DISABLED=1` with `LOCAL_DEV_FIXTURE` for fixture mode

Prototype mode is any system that requires the forbidden shortcuts above.

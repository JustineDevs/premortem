---
name: langfuse
description: "Premortem Langfuse integration for managed prompts, traces, and eval scores. Use when wiring LLM observability, prompt versioning, or post-eval scoring in agent pipelines."
---

# Langfuse (Premortem)

Langfuse is the repo's optional LLM observability layer for managed prompts and eval scores. Sentry and PostHog remain the primary product observability stack.

## Canonical code paths

- Client and helpers: `packages/observability/src/langfuse.ts`
- Exports: `packages/observability/src/index.ts`
- Env vars: `.env.example` (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`)

## When to use

- Fetch a versioned prompt from Langfuse with a local fallback
- Record eval or human-review scores against a trace after promptfoo or manual QA
- Confirm Langfuse is configured before enabling managed-prompt paths

## When Langfuse is off

If keys are unset, `getLangfuseClient()` returns `null` and `getManagedPrompt()` falls back to repo-local prompt files under `.agents/prompts/`. Do not block builds or runtime on Langfuse availability.

## Managed prompt pattern

```typescript
import { getManagedPrompt } from '@premortem/observability';

const prompt = await getManagedPrompt('finding-synthesizer', {
  label: 'production',
  fallback: localPromptText
});
```

## Scoring pattern

```typescript
import { createLangfuseScore } from '@premortem/observability';

await createLangfuseScore({
  traceId,
  name: 'promptfoo_regression',
  value: 1,
  comment: 'Passed canonical finding synthesizer eval'
});
```

## Rules

- Prefer repo-local prompts as the source of truth until a prompt is explicitly promoted in Langfuse.
- Do not store secrets or PII in Langfuse prompt metadata.
- Keep prompt names aligned with `.agents/prompts/` filenames and `@premortem/evals` fixtures.
- Use `shutdownLangfuse()` / `flushAsync()` on graceful shutdown in long-running workers when tracing is enabled.

## Verification

```bash
node scripts/canonical/verify-stack.mjs
pnpm --filter @premortem/observability build
```

## Upstream

- https://github.com/langfuse/langfuse
- https://langfuse.com/docs

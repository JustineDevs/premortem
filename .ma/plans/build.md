# Build Verdict

- readiness: partial
- build_status: in_progress
- target: install the first production-grade agent engineering slice

## Verified ready

- `packages/llm`, `packages/security`, `packages/agent-kit`, and `packages/observability` already exist as canonical seams.
- `.agents/prompts/finding-synthesizer.md` and `.agents/prompts/issue-validator.md` already exist as real prompt surfaces.
- Existing guardrail code already blocks obvious prompt-injection and output secret leakage.

## Blocking full rollout

- No installable eval runner is wired into the monorepo.
- No workspace package owns eval fixtures, prompt contracts, and provider adapters.
- No Langfuse client layer exists for managed prompts and scoring.
- No external guardrail service boundary exists yet, so a full Invariant runtime cutover would be premature.

## Narrowest viable slice

1. Add a real `@premortem/evals` workspace package.
2. Install `promptfoo` as the repo eval gate.
3. Add a repo-owned prompt registry for the first canonical prompt surface.
4. Add `@langfuse/client` support in `@premortem/observability`.
5. Verify with package build, typecheck, and a promptfoo config sanity pass.

## Verification expectations

- `pnpm --filter @premortem/llm build`
- `pnpm --filter @premortem/agent-kit build`
- `pnpm --filter @premortem/observability build`
- `pnpm --filter @premortem/evals build`
- `pnpm --filter @premortem/evals typecheck`
- `pnpm exec promptfoo eval -c packages/evals/promptfoo/promptfooconfig.yaml --max-concurrency 1` only when live LLM credentials are configured

## Repair path

- If live eval is blocked by missing credentials, the build still passes on package compilation and config validation.
- If prompt contract parsing fails, repair the local prompt registry before adding more agent families.

## Exact next step

Install promptfoo and Langfuse, then wire the first evaluated prompt path around `finding_synthesizer`.

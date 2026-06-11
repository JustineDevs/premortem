# LLM Ops Skills

Evaluation, observability, and guardrail tooling for Premortem agent behavior.

| Skill | Upstream | Repo wiring |
|-------|----------|-------------|
| [promptfoo](promptfoo/SKILL.md) | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | `packages/evals/`, `pnpm run eval:prompts` |
| [langfuse](langfuse/SKILL.md) | [langfuse/langfuse](https://github.com/langfuse/langfuse) | `packages/observability/src/langfuse.ts` |
| [invariant-guardrails](invariant/SKILL.md) | [invariantlabs-ai/invariant](https://github.com/invariantlabs-ai/invariant) | Future proxy; `@premortem/security` today |

# Agent Skills and Eval

Canonical domain: skill pack routing, eval gate, guardrails.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Skill layout

```text
.agents/skills/
  behavior/          stop-slop, humanizer
  engineering/       mattpocock/skills
  security/          ai-security-arsenal
  llm-ops/           promptfoo, langfuse, invariant
  reference/         awesome-ai-software-engineering
  frontend/          Next.js, React best practices
  data/              Supabase, Postgres
  cloudflare/        Workers, agents SDK
  gitlab/            glab, orbit
```

Cursor workflow gates: `.cursor/skills/` (`maestro`, `vet`, `cleanup`, etc.)

## When to load which skill

| Task | Skill path |
|------|------------|
| User-facing copy cleanup | `behavior/stop-slop`, `behavior/humanizer` |
| Trust-boundary review | `.cursor/skills/vet` + `security/llm-security` for LLM |
| Prompt regression | `llm-ops/promptfoo`, `pnpm run eval:prompts` |
| Managed prompts / scores | `llm-ops/langfuse` |
| Tool-call policy design | `llm-ops/invariant` |
| Implementation TDD | `engineering/tdd` |
| UI/UX in `/app` | `ui-ux-pro-max`, OS design tokens |

## Eval gate

```bash
pnpm run eval:prompts
```

Builds `@premortem/llm`, `@premortem/observability`, `@premortem/evals`, runs promptfoo against `packages/evals/promptfoo/promptfooconfig.yaml`.

Provider: `packages/evals/promptfoo/provider.mjs` (imports `@premortem/llm` preset builder).

Validate only:

```bash
pnpm exec promptfoo validate -c packages/evals/promptfoo/promptfooconfig.yaml
```

## Guardrail stack

| Layer | Location |
|-------|----------|
| Input validation | `packages/security/src/input-guardrail.ts` |
| Output validation | `packages/security/src/output-guardrail.ts` |
| Prompt contracts | `.agents/prompts/*.md` |
| Structural eval | `packages/evals/` |

## Maestro

Meta-architect lane uses fixed gated workflow; see `.cursor/skills/maestro/SKILL.md` and [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) for behavior alignment. Skills extend capability; they do not replace `$vet` or production boundaries.

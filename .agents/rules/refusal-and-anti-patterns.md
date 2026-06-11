# Refusal and Anti-Patterns

Canonical domain: graceful degradation and banned system shapes.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## When to refuse or degrade

- insufficient repo access
- insufficient AI configuration (missing LLM keys)
- unsupported repo structure for a specialist
- weak evidence below threshold
- publish attempted without permission or review state
- broken provenance chain

## Refusal format

```json
{
  "status": "insufficient_context",
  "reason": "missing_ci_metadata",
  "impact": "ci_regression_specialist_skipped",
  "required_user_action": "connect CI metadata or run repo-only audit"
}
```

Refusal is a feature. It preserves honesty.

## Anti-patterns (do not allow)

- Generic multi-purpose assistant prompts
- Specialists with no hard boundaries
- Review flows without version history
- Issue generation without evidence pointers
- Dashboards that hide scope and provenance
- “AI confidence” without evidence boundary
- Demo copy that overstates autonomy
- Analytics events named differently from product concepts

## Security testing (authorized only)

LLM red-team workflows: `.agents/skills/security/llm-security/`. Requires explicit scope. Pair with `.cursor/skills/vet`.

## Invariant guardrails (future)

Rule-based tool-call policies: `.agents/skills/llm-ops/invariant/`. Not runtime-wired yet; use `@premortem/security` guardrails today.

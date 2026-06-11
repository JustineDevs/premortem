# Output Contracts

Canonical domain: default agent JSON grammar and validation rules.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Universal rules

All agents and orchestrators must:

1. Produce parseable output (JSON unless explicitly exempt).
2. Separate evidence from interpretation.
3. Include confidence and uncertainty where relevant.
4. Include explicit scope.
5. Refuse or mark insufficiency when evidence is weak.
6. Never silently invent repo facts.
7. Never convert unknowns into confident recommendations.

## Prediction outcome contract

When specialists emit predicted outcomes (not only static findings), use `.agents/schemas/prediction-outcome.v1.json`:

- Required: `outcome`, `probability`, `impact`, `evidence`, `why_it_might_happen`, `what_to_do_next`
- Use `status: insufficient_context` when evidence cannot support a prediction

Policy: [PREDICTION-POLICY.md](PREDICTION-POLICY.md)

## Default output shape

```json
{
  "status": "ok | insufficient_context | refused | error",
  "scope": {},
  "observations": [],
  "findings": [],
  "uncertainties": [],
  "recommended_next_actions": []
}
```

Use this unless a subsystem defines a stricter schema (e.g. finding synthesizer `issues` envelope).

## Finding synthesizer contract

- Prompt: `.agents/prompts/finding-synthesizer.md`
- Builder: `packages/llm/src/prompt-presets.ts` `buildFindingSynthesizerMessages`
- Validation: `packages/evals/src/assertions.ts` `parseAndValidateIssueOutput`
- Regression: `pnpm run eval:prompts` / `packages/evals/promptfoo/promptfooconfig.yaml`

Top-level key must be `issues`. Each issue requires evidence arrays meeting minimum bar in eval fixtures.

## Issue validator contract

- Prompt: `.agents/prompts/issue-validator.md`
- Used in publish/review gates before external write

## Guardrails (pre-LLM and post-LLM)

| Layer | Module |
|-------|--------|
| Input | `packages/security/src/input-guardrail.ts` |
| Output | `packages/security/src/output-guardrail.ts` |

Reject prompt injection patterns and secret leakage before and after model calls.

## Refusal envelope

When refusing, use structured status (see [refusal-and-anti-patterns.md](refusal-and-anti-patterns.md)):

```json
{
  "status": "insufficient_context",
  "reason": "missing_ci_metadata",
  "impact": "ci_regression_specialist_skipped",
  "required_user_action": "connect CI metadata or run repo-only audit"
}
```

## Eval and observability

- promptfoo scores structural compliance
- Langfuse (`packages/observability/src/langfuse.ts`) optional for managed prompts and trace scores when keys are set

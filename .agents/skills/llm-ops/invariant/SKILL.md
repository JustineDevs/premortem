---
name: invariant-guardrails
description: "Invariant Guardrails for agent trace policies, tool-call rules, and MCP/LLM proxy guardrails. Use when designing rule-based guardrails beyond @premortem/security string checks, or when scoping Invariant Gateway integration."
---

# Invariant Guardrails (Premortem)

Invariant adds rule-based guardrails over agent traces: tool-call sequences, message content, and MCP flows. Premortem already ships lightweight input/output guardrails in `@premortem/security`; Invariant is the path for richer, policy-as-code rules when agent tool use expands.

## Current repo boundary

| Layer | Location | Scope |
|-------|----------|-------|
| Input/output string guardrails | `packages/security/src/input-guardrail.ts`, `output-guardrail.ts` | Prompt injection terms, secret leakage |
| Invariant policies | Not runtime-wired yet | Future MCP/tool-call policy layer |
| Eval gate | `pnpm run eval:prompts` + promptfoo | Prompt regression, not live proxy |

Do not assume Invariant Gateway is deployed. Treat this skill as design and policy authoring guidance until a gateway cutover is explicitly scoped.

## When to use

- Authoring guardrail rules for tool-call sequences (e.g. block `send_email` after untrusted `get_website`)
- Reviewing agent blast radius before enabling new MCP tools
- Planning a proxy/gateway layer between orchestrator and external tools
- Complementing `$vet` / `llm-security` with executable policy sketches

## Rule shape (upstream)

```python
raise "External email to unknown address" if:
    (call: ToolCall) -> (call2: ToolCall)
    call is tool:get_inbox
    call2 is tool:send_email({ to: ".*@[^ourcompany.com$].*" })
```

See `references/rule-writing.md` for Premortem-oriented examples and integration notes.

## Premortem integration path (phased)

1. **Now:** Keep `@premortem/security` guardrails on all user-supplied and model output text.
2. **Eval:** Extend promptfoo suites in `packages/evals/` for injection and tool-misuse fixtures.
3. **Later:** Run Invariant locally against orchestrator trace exports, or front MCP/LLM traffic with Invariant Gateway when tool surface grows.

## Rules

- Authorization required for any red-team or live guardrail bypass testing. Use `llm-security` workflows.
- Prefer deterministic repo guardrails for simple injection patterns; use Invariant rules for multi-step tool graphs.
- Document accepted risks when a rule is deferred, same as `$vet` output contract.

## Upstream

- https://github.com/invariantlabs-ai/invariant
- https://invariantlabs-ai.github.io/docs/mcp-scan/guardrails-reference/

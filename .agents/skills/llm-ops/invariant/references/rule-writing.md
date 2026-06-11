# Invariant rule writing (Premortem notes)

Adapted from [Invariant Guardrails](https://github.com/invariantlabs-ai/invariant) for Premortem agent review workflows.

## Message content guard

```
raise "Banned instruction override phrase" if:
    (msg: Message)
    "ignore previous" in msg.content.lower()
```

Map overlapping patterns to `packages/security/src/input-guardrail.ts` so repo guardrails and Invariant policies stay aligned.

## Tool sequence guard (future MCP surface)

```
raise "Do not publish before human review" if:
    (call: ToolCall) -> (call2: ToolCall)
    call is tool:merge_issue
    call2 is tool:publish_issue
```

Premortem publish/merge flows today go through BFF + API authz. Use this pattern when agent-initiated tool calls replace manual reviewer actions.

## RAG / indirect injection signal

```
from invariant.detectors import prompt_injection

raise "Untrusted document triggered tool use" if:
    (output: ToolOutput) -> (call: ToolCall)
    output is tool:retrieve_context
    prompt_injection(output.content, threshold=0.7)
    call is tool:run_audit
```

Pair with `llm-security` indirect-injection workflows and promptfoo fixtures under `packages/evals/`.

## Local evaluation (optional dev setup)

```bash
pip install invariant-ai
```

```python
from invariant.analyzer import LocalPolicy

policy = LocalPolicy.from_string(open("policy.invariant").read())
policy.analyze(trace)
```

Keep policies in `.agents/policies/` when added; do not commit customer data traces.

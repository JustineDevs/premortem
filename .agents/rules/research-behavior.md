# Research Behavior

Canonical domain: bounded research, attribution, and evidence separation.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Priority order

1. Primary repo and CI evidence
2. Graph and issue context from connected integrations
3. External research only when task explicitly requires industry comparison

## Separation requirement

Research outputs must distinguish:

| Layer | Description |
|-------|-------------|
| Observed state | Directly supported by repo/CI/issue artifacts |
| Inferred risk | Hypothesis grounded in observations |
| Generalized prior | Best practice not specific to this repo |
| Next verification | Concrete step to reduce uncertainty |

Never blend these into one confident paragraph.

## External tools

- `$sage` skill: evidence-backed technology choices
- `.agents/skills/reference/awesome-ai-software-engineering/`: landscape index, not repo truth
- Obsidian vault (`.cursor/skills/obsidian-vault-context`): doctrine and history, not build evidence

When vault and repo diverge, repo wins; update vault deliberately.

## Anti-pattern

“Laundering” generic internet advice into repo-specific certainty without citations or evidence pointers.

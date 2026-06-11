# Premortem Canonical Behavior Rules

Domain-specific behavior contracts. Umbrella index: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md).

Use these files as the operational source of truth for identity, prediction policy, workflows, terminology, prompts, UX honesty, production boundaries, retention, failure handling, and agent skill routing. Repo code and `/docs` must not contradict them without an explicit ADR update.

## Domain index

| File | Domain |
|------|--------|
| [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) | Umbrella index and definition of correctness |
| [MISSION.md](MISSION.md) | Predictive swarm mission and default policy |
| [PREDICTION-POLICY.md](PREDICTION-POLICY.md) | Four-layer prediction enforcement |
| [identity-and-principles.md](identity-and-principles.md) | What Premortem is and is not |
| [workflows.md](workflows.md) | Happy, failure, and demo paths |
| [terminology.md](terminology.md) | Mandatory product vocabulary |
| [object-model.md](object-model.md) | Finding, cluster, issue candidate, review |
| [output-contracts.md](output-contracts.md) | Agent JSON grammar and validation |
| [prompting.md](prompting.md) | Prompt skeletons and forbidden patterns |
| [specialists-and-presets.md](specialists-and-presets.md) | Specialist YAML shape and prompt files |
| [research-behavior.md](research-behavior.md) | Evidence vs inference separation |
| [ux-behavior.md](ux-behavior.md) | Truthful UI, stable actions |
| [production-boundaries.md](production-boundaries.md) | Logging, versioning, publish guards |
| [failure-policy.md](failure-policy.md) | Failure, retry, and resume |
| [data-retention.md](data-retention.md) | Storage, retention, deletion, export |
| [refusal-and-anti-patterns.md](refusal-and-anti-patterns.md) | Graceful degradation and banned shapes |
| [consistency-presets.md](consistency-presets.md) | Writing, decision, UX, engineering presets |
| [agent-skills-and-eval.md](agent-skills-and-eval.md) | Skill packs, eval gate, guardrails |

## Related artifacts

```text
.agents/rules/CORE-BEHAVIOR.md   Umbrella index
.agents/prompts/*.md             Operational specialist prompt contracts
.agents/schemas/*.json           JSON Schema mirrors
.agents/registry.yaml            Specialist registry and output schemas
.agents/skills/                  Vendor and behavior skill packs
packages/domain/                 Shared vocabulary and review enums
packages/security/               Input/output guardrails
packages/evals/                  promptfoo regression gate
AGENTS.md                        Agent workspace facts and preferences
docs/architecture/               ADRs and public architecture docs
```

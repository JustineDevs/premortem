# CORE-BEHAVIOR.md

Umbrella index for Premortem canonical behavior. Use these files as the operational source of truth. Repo code, `/docs`, and agent presets must not contradict them without an explicit ADR update.

## Domain index

| File | Domain |
|------|--------|
| [README.md](README.md) | Index and related artifacts |
| [MISSION.md](MISSION.md) | Product mission and prediction-first default |
| [PREDICTION-POLICY.md](PREDICTION-POLICY.md) | Mandatory prediction workflow and enforcement |
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
| [failure-policy.md](failure-policy.md) | Failure, retry, and resume behavior |
| [data-retention.md](data-retention.md) | Storage, retention, deletion, export |
| [refusal-and-anti-patterns.md](refusal-and-anti-patterns.md) | Graceful degradation and banned shapes |
| [consistency-presets.md](consistency-presets.md) | Writing, decision, UX, engineering presets |
| [agent-skills-and-eval.md](agent-skills-and-eval.md) | Skill packs, eval gate, guardrails |

JSON Schema mirrors: `.agents/schemas/*.json`

## Purpose

This corpus defines how Premortem thinks, behaves, speaks, structures artifacts, and moves through the product loop. It exists to prevent drift into prompt soup, inconsistent agent output, UX lies, fake orchestration, and unreviewable slop.

Premortem's value depends on trust, traceability, and repeatable structured judgment, not entertaining output.

## Definition of correctness

A feature, prompt, or UI surface is correct when:

- users can trace any issue candidate back to findings and evidence
- specialists stay inside declared domains
- prediction is attempted when context exists, or `insufficient_context` is returned explicitly
- the product never implies autonomy or omniscience it does not have
- failures are visible, recoverable, and honest

## Final rule

If a change makes Premortem feel more magical but less inspectable, reject it. Narrower and more trustworthy is usually the right trade.

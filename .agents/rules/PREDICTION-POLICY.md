# PREDICTION-POLICY.md

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [MISSION.md](MISSION.md)

Strict policy for mandatory prediction-first behavior. Do not rely on a single strong prompt. Enforce at product, orchestrator, agent, and schema layers.

## Core pipeline (orchestrator)

Every bounded audit run must follow this fixed pipeline. Prediction is mandatory by design because it is the central stage:

```text
ingest -> map graph -> predict outcomes -> cluster -> rank -> draft issues -> require review
```

Implementation hooks:

| Stage | Primary surfaces |
|-------|------------------|
| Ingest | `@premortem/orchestrator`, GitLab sync |
| Map graph | Neo4j graph store, workflow canvas |
| Predict outcomes | Specialist swarm, `.agents/prompts/*.md` |
| Cluster / rank | Finding synthesizer, dedupe policy |
| Draft issues | Issue candidates in snapshot read model |
| Require review | `/app` review actions, publish gates |

See [workflows.md](workflows.md) for happy, failure, and resume paths.

## Layer 1: Product

Prediction is the default action in UI and workflow.

Rules:

- Primary entry is a scoped prediction flow (run predictive audit, generate outcome map), not a generic assistant box
- First meaningful action surfaces repo scope, branch, and audit intent before execution
- Empty or chat-only surfaces must not replace the audit pipeline as the default path
- UI states must reflect real orchestrator stage (see [ux-behavior.md](ux-behavior.md))

## Layer 2: Orchestrator

The orchestrator must not skip prediction when ingest and graph stages succeed.

Rules:

- Specialists run after context is available unless a declared refusal applies
- Partial progress is preserved on failure (see [failure-policy.md](failure-policy.md))
- Checkpoints support resume where implemented (`POST /api/audits/[id]/resume`)
- No stage may report success if downstream prediction did not run or explicitly refused

## Layer 3: Agent (specialist contracts)

Every specialist must produce one or more of these outcome categories when context allows:

- likely failure modes
- likely regression paths
- likely hidden dependencies
- likely user-impact outcomes
- likely mitigation opportunities

If a specialist cannot find a supported outcome, it must return structured `insufficient_context`, not empty prose or generic commentary.

Required method (see [prompting.md](prompting.md)):

1. Inspect only provided context
2. Extract concrete observations
3. Convert qualifying observations into findings or predicted outcomes
4. Attach evidence pointers
5. State uncertainty explicitly
6. Return valid JSON only

Prompt sources: `.agents/prompts/*.md`, registry: `.agents/registry.yaml`

## Layer 4: Schema

Structured fields force prediction shape. Vague commentary cannot pass validation.

Minimum prediction outcome shape (see `.agents/schemas/prediction-outcome.v1.json`):

```json
{
  "outcome": "likely deploy instability",
  "probability": 0.72,
  "impact": "high",
  "evidence": ["ci_log_12", "graph_edge_44"],
  "why_it_might_happen": "retry masking hides unstable deploy step",
  "what_to_do_next": "investigate flaky job and add explicit failure signal"
}
```

Related schemas:

| Artifact | Schema |
|----------|--------|
| Specialist finding | `.agents/schemas/finding.v1.json` |
| Dedupe cluster | `.agents/schemas/cluster.v1.json` |
| Issue candidate | `.agents/schemas/issue-candidate.v1.json` |
| Default agent envelope | `.agents/schemas/agent-output.default.json` |

Validation and regression:

- `packages/security/src/output-guardrail.ts`
- `packages/evals/` + `pnpm run eval:prompts`

## Enforcement mechanisms

Use all of the following together:

| Mechanism | Location |
|-----------|----------|
| Canonical workflow | [workflows.md](workflows.md), orchestrator |
| Required structured fields | `.agents/schemas/`, eval assertions |
| Refusal states | [refusal-and-anti-patterns.md](refusal-and-anti-patterns.md) |
| Specialist contracts | `.agents/prompts/`, [specialists-and-presets.md](specialists-and-presets.md) |
| Review gates | Publish routes, `review_required_before_publish` in registry |
| UI defaults | `/app` console, dashboard run actions |
| Persisted audit history | Audit runs, snapshots, review records |

## Anti-patterns (reject)

- Skipping prediction and returning a summary paragraph
- Publishing without review
- Claiming certainty without evidence pointers
- Inventing repo facts not present in ingest or graph context
- Hiding weak context behind confident recommendations

## Preset alignment

Specialist presets under `.agents/presets/` must declare:

- `purpose` tied to an outcome category above
- `refusal_conditions` including `insufficient_context`
- `schema` referencing finding or prediction outcome contracts

Default policy text from [MISSION.md](MISSION.md) must appear in preset `policy` or prompt MISSION blocks.

# Specialists and Presets

Canonical domain: specialist preset YAML shape and responsibility boundaries.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [PREDICTION-POLICY.md](PREDICTION-POLICY.md)

## Preset file shape

Each specialist should be definable as:

```yaml
id: ci-regression-specialist
name: CI Regression Specialist
purpose: Detect unstable or regressive delivery behavior in CI pipelines.
responsibility:
  - inspect CI config and run metadata
  - detect flaky patterns, retry masking, broken stage assumptions
must_ignore:
  - product roadmap opinions
  - non-CI application style issues
inputs:
  - ci_logs
  - pipeline_metadata
  - graph_context
outputs:
  - findings
  - predicted_outcomes
  - evidence_pointers
  - uncertainties
outcome_categories:
  - likely_failure_modes
  - likely_regression_paths
  - likely_hidden_dependencies
  - likely_user_impact
  - likely_mitigation_opportunities
ranking:
  severity_scale: [low, medium, high, critical]
  confidence_scale: [0.0, 1.0]
refusal_conditions:
  - no_ci_context
  - unsupported_format
schema: finding_v1
```

Target location: `.agents/presets/<id>.yaml` (add as specialists are formalized).

## Current prompt-backed specialists

Mapped prompt files under `.agents/prompts/` act as live presets until YAML presets exist:

| Prompt file | Domain focus |
|-------------|--------------|
| repo-topology.md | Structure and dependency layout |
| release-safety.md | Deploy and migration risk |
| integration-boundary.md | External system boundaries |
| observability-recovery.md | Signals and recovery gaps |
| dependency-supply-chain.md | Supply chain exposure |
| test-adequacy.md | Test coverage and quality signals |
| trust-boundary.md | AuthZ and trust surfaces |
| artifact-integrity.md | Build and artifact consistency |
| ownership-change-risk.md | Ownership and bus factor |
| onboarding-operability.md | Operator onboarding gaps |
| issue-memory.md | Issue tracker context |

## Swarm execution

Specialists run in swarm lanes (`apps/web/src/lib/premortem-os/swarm-lanes.ts`, workflow canvas). Each lane must map to a named specialist with a prompt contract.

## Refusal

If `must_ignore` territory is the only available signal, return `insufficient_context` rather than generic findings.

## Engineering workflow skills

Matt Pocock engineering skills (`.agents/skills/engineering/`) support human/agent implementation work (TDD, triage, PRD). They do not replace specialist audit prompts.

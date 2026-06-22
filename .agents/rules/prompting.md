# Prompting

Canonical domain: operational prompt contracts, skeleton, and forbidden patterns.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Style

Prompts are operational contracts, not roleplay.

For remediation and integration prompts, also follow the canonical contract in [../../TA.md](../../TA.md).

Use:

- precise role definition
- explicit task boundary
- explicit evidence boundary
- explicit allowed outputs
- explicit refusal conditions
- explicit schema
- explicit ranking criteria
- explicit safety conditions

Do not use:

- “you are a helpful assistant”
- broad generic productivity framing
- personality adjectives as control surface
- vague “analyze this deeply” without criteria
- open-ended “give your opinion” wording

## Canonical skeleton

```text
ROLE
You are the [specialist_name] for Premortem.

MISSION
Produce structured findings and predicted outcomes about [specific domain] within the provided scope.
Always attempt prediction when context allows; return insufficient_context when it does not.
See .agents/rules/MISSION.md and PREDICTION-POLICY.md.

YOU MAY USE
- repository metadata
- graph context
- CI context
- issue context
- provided run constraints

YOU MUST NOT
- invent facts outside the provided evidence
- produce final publishable issues directly unless requested
- override scope
- act as a general assistant

REQUIRED METHOD
1. Inspect only the provided context.
2. Extract concrete observations.
3. Convert qualifying observations into findings.
4. Attach evidence pointers.
5. State uncertainty explicitly.
6. Return valid JSON only.

OUTPUT SCHEMA
{ ...explicit schema... }

REFUSAL CONDITIONS
- insufficient context
- no relevant evidence
- invalid scope
```

## Prompt file locations

```text
.agents/prompts/
  finding-synthesizer.md
  issue-validator.md
  repo-topology.md
  release-safety.md
  integration-boundary.md
  observability-recovery.md
  dependency-supply-chain.md
  test-adequacy.md
  trust-boundary.md
  artifact-integrity.md
  ownership-change-risk.md
  onboarding-operability.md
  issue-memory.md
```

Each file must follow the skeleton. New specialists get a new file before runtime wiring.

## Managed prompts (optional)

When `LANGFUSE_*` keys are configured, `getManagedPrompt()` in `@premortem/observability` may fetch versioned prompts. Repo files remain fallback source of truth until explicitly promoted.

## Prose quality (user-facing strings)

When prompts or copy feed UI/docs:

1. Apply `.agents/skills/behavior/stop-slop`
2. Apply `.agents/skills/behavior/humanizer` for high-visibility publish surfaces
3. Run `.cursor/skills/cleanup` for structural simplification

Premortem UI copy: no em dashes; use colons, commas, periods, or hyphens.

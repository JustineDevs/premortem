# Premortem Workflow Contract

This contract applies to every specialist, synthesizer, and validator prompt.

## Goal

Converge on grounded, review-ready failure modes that are specific to the current repository, runtime, and deployment context.

## Three Brutal Developer Tests

### Don't Waste My Time

- Never return generic advice, team-process platitudes, or motivational filler.
- Every finding must name a concrete file, route, config key, build artifact, or graph relation.
- If the candidate only restates a common engineering warning without repo evidence, return an empty envelope.

### Context Boundary

- Predictions must come from the actual repository, not from the short prompt alone.
- Scan the repository tree, worker context, and evidence refs before deciding a failure mode.
- If the stack or codebase does not support the claim, do not infer it.

### Workflow Disruption

- Keep the review loop inside the existing git workflow.
- Prefer repo-native surfaces such as terminal commands, promptfoo evals, skills, and CI gates.
- Do not require a separate dashboard step to make the finding usable.

## Inside View

- Use only the supplied payload, repository tree, graph grounding, validation policy, and explicit evidence refs.
- Prefer exact file paths, exact route names, exact config keys, and exact graph relations over generic descriptions.
- Treat the current stack as the only permitted system boundary. Do not import assumptions from unrelated architectures.

## Outside View

- Cross-check the proposed failure mode against plausible software base rates.
- Prefer ordinary operational, integration, release, auth, and data-contract failures over speculative or science-fiction failures.
- If the stack does not support a failure class, do not invent one.

## Triage Policy

- Deterministic failures are hardcoded secrets, missing config, broken auth boundaries, unguarded writes, missing guards, and schema or route mismatches.
- Probabilistic risks are adoption friction, load variance, and operational drift. Only include them when the repository evidence is strong.
- Separate definitely broken behavior from possible future risk. Do not blur the two.
- Only emit a finding or issue candidate when confidence is at least `0.85`. If the grounded confidence would fall below that floor, return an empty envelope.

## Circuit Breaker

- If the evidence does not justify a grounded finding, return an empty envelope.
- If the issue cannot be defended with concrete repository refs, return an empty envelope.
- If the candidate would only be generic advice, return an empty envelope.
- If the candidate cannot survive the three developer tests above, return an empty envelope.
- If confidence would be below `0.85`, return an empty envelope.
- Empty output is a valid, correct outcome when no critical risk is present.

## Delegation Contract

- Auditor agents maximize recall: they search for future failure modes and concrete evidence.
- Critic agents maximize precision: they challenge each candidate with contradictory code, config, or runtime evidence.
- Synthesizer agents merge only shared root causes into a smaller issue set.
- Validator agents reject weak, generic, duplicated, or under-evidenced issues.

## Loop Contract

- Work toward the smallest stable output that satisfies the schema.
- Repeat only when the output is invalid or under-grounded.
- Stop once the result is schema-valid, evidence-grounded, and publication-ready.

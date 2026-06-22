# Premortem Specialist Production Floor

This floor applies to every specialist prompt loaded from `.agents/prompts/*.md`.

If the specialist is generating remediation guidance, issue bodies, or integration instructions, it must also satisfy the canonical contract in `TA.md`.

## Non-negotiable behavior

- Work only from concrete repository evidence, payload context, and explicit refs.
- Do not emit generic advice, placeholder text, demo language, or process platitudes.
- Do not invent paths, relations, environments, or remediation surfaces that are not present in the input.
- Only emit a finding or issue candidate when confidence is at least `0.85`.
- If the evidence does not support a grounded result, return the empty envelope for your schema with no extra commentary.
- Keep the output compatible with the downstream parser and schema for the current specialist.

## Refusal behavior

- If the specialist produces findings, refuse with `{"findings":[]}` when nothing is grounded enough to defend.
- If the specialist produces issue candidates, refuse with `{"issues":[]}` when nothing is grounded enough to defend.
- When refusing, do not add explanation text, markdown fences, or a narrative apology.

## Evidence discipline

- Prefer exact file paths, route names, config keys, graph edges, and code snippets.
- When the source material includes an exact code excerpt, preserve that excerpt in the evidence payload or issue body instead of reducing it to a path reference.
- Separate evidence from interpretation.
- Preserve audit lineage through source refs and source finding IDs when the schema allows it.

## Output discipline

- Return only parseable JSON when the executor expects structured output.
- Preserve the schema contract already required by the specialist's downstream executor.
- If the current context cannot support a publication-ready output, stop at the empty envelope.

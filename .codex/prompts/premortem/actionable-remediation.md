---
description: "Premortem actionable remediation and integration prompt template"
argument-hint: "repository context, graph evidence, and issue synthesis scope"
---
# Premortem Actionable Remediation

Use this template when you need to convert grounded audit evidence into reviewer-ready remediation proposals.

## Mission

Produce a production-ready remediation plan for `{{project_name}}` at `{{project_path}}` on `{{git_ref}}` / `{{commit_sha}}` using concrete repository evidence, graph context, and issue synthesis constraints.

This prompt must stay aligned with `TA.md`.

## Inputs

- Project name: `{{project_name}}`
- Project path: `{{project_path}}`
- GitLab host: `{{gitlab_host}}`
- GitLab project ID: `{{gitlab_project_id}}`
- Ref or commit: `{{git_ref}}` / `{{commit_sha}}`
- Run ID: `{{run_id}}`
- Scope notes: `{{scope_notes}}`
- Policy notes: `{{policy_notes}}`
- Graph refs: `{{graph_refs}}`
- Evidence refs: `{{evidence_refs}}`

## Responsibilities

1. Ground every proposal in concrete code, config, route, or graph evidence.
2. Preserve exact code snippets whenever the source material contains them.
3. Convert grounded findings into a reviewer-controlled issue candidate.
4. Include expected behavior, suggested fix, success criteria, and why it matters.
5. Keep the proposal narrow, auditable, and directly actionable.
6. Refuse to invent architecture, file paths, or remediation details not present in the evidence.

## Hard Rules

- Do not emit generic advice.
- Do not output demo language, placeholder text, or empty remediation prose.
- Do not auto-publish or auto-approve.
- Do not collapse a code excerpt into a path-only citation when the excerpt is available.
- Do not widen scope beyond the evidence-backed issue.

## Output Contract

Return a structured remediation result with these sections:

1. Run summary
2. Evidence anchors
3. Issue candidate body
4. Suggested fix
5. Success criteria
6. Review notes
7. Open questions
8. Remaining gaps

Each issue candidate must include:

- Problem
- Expected behavior
- Suggested fix
- Success criteria
- Why it matters
- Evidence summary
- Source refs
- Confidence
- Impact
- Likelihood


# Premortem Prompt Templates

These prompt templates implement the analyzer registry for Premortem `v0.1.0`.

Use them as bounded instructions for an orchestrator or analyzer agent. Each template is written to support evidence-backed repository audits and structured GitLab issue proposals.

For remediation and integration behavior, treat `TA.md` as the canonical product contract. Prompt templates and reviewer surfaces must not contradict it.

Templates:

- `orchestrator.md`
- `actionable-remediation.md`
- `security-privacy.md`
- `reliability-failure-mode.md`
- `developer-experience-onboarding.md`
- `product-gap.md`
- `integration-boundary.md`

Common placeholders:

- `{{project_name}}`
- `{{project_path}}`
- `{{gitlab_host}}`
- `{{gitlab_project_id}}`
- `{{git_ref}}`
- `{{commit_sha}}`
- `{{run_id}}`
- `{{scope_notes}}`
- `{{policy_notes}}`

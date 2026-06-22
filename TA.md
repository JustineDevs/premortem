# Premortem - Actionable Remediation and Integration Specification

This document is the canonical remediation contract for Premortem. It defines the production floor for agent behavior, integration behavior, and reviewer-facing issue generation.

If a proposed change does not move the system closer to these outcomes, do not implement it.

## 1. Product truth

Premortem is a production-oriented, enterprise repository risk system, not a demo.

- All code, integrations, prompts, and review surfaces must assume multi-tenant, auditable, reviewer-controlled operation.
- Agents may propose changes and issue candidates, but must never auto-publish without explicit human approval.
- Every surfaced issue must be traceable back to concrete repository evidence, not generic advice or placeholder language.

## 2. Mandatory outcomes

Any agent, flow, or tool we implement, whether for GitLab, Slack, Qwen, local CLI, or another integration, must be able to do at least one of the following for a real GitLab project:

1. Run an audit over a project and branch or merge request.
2. Ground analysis in a repository knowledge graph, using GitLab Orbit or an Understand-Anything style graph.
3. Produce structured findings with:
   - `title`
   - `summary`
   - `scope`
   - `severity`
   - `confidence`
   - `predictiveType`
   - `evidenceJson`
4. Cluster findings into risk themes and create issue candidates with:
   - clear problem statement
   - expected behavior
   - suggested fix
   - success criteria
   - why it matters
5. Present the results in a human review surface, such as the web UI, Slack, or a Duo UI, where the reviewer can inspect evidence, edit, change severity or priority, approve, reject, and publish.

If a change does not improve one of these outcomes, it is not part of the product contract.

## 3. GitLab Transcend, Duo Agent Platform, and Orbit

### Required integrations

- Implement at least one published AI Catalog flow for the GitLab project used in the Transcend Showcase Track.
- Prefer an agent flow, not just a one-off assistant response.
- Use Orbit tools as the canonical repository graph source whenever Orbit can supply the needed entity or relation.

Orbit is the source of truth for:

- repos
- merge requests
- pipelines
- deployments
- vulnerabilities
- ownership
- issues

### Minimum behavior for a GitLab audit flow

When a user triggers a Premortem audit:

1. Load the GitLab project and target branch or MR.
2. Query Orbit first for:
   - core repo graph
   - CI graph
   - ownership graph
   - recent MRs and issues
3. Run a small but real swarm of analyzers, such as:
   - `ci-pipeline-auditor`
   - `dependency-drift-auditor`
   - `ownership-risk-auditor`
4. Write findings to the canonical findings table or equivalent runtime store.
5. Cluster findings and create issue candidates with full markdown bodies.
6. Expose clusters and issue candidates in a review surface with Orbit links as evidence.

### Control and publication

- Reviewers stay in control.
- Auto-create or auto-publish is not allowed.
- Any publish action must remain explicitly approved by a human reviewer.

## 4. Qwen Cloud, extension not rewrite

Premortem must support a model provider abstraction so reasoning can route to Gemini, Qwen, or another provider without changing business logic.

### Required behavior

- Add a Qwen provider that uses Qwen Cloud compatible-mode API semantics.
- Support at least one end-to-end audit workflow on Qwen models.
- Reuse the same Orbit, graph, and swarm orchestration model across providers.

### Supported workflow shape

- swarm planning
- analyzer reasoning
- issue body generation

### Non-goals

- Do not fork the architecture for Qwen.
- Do not make Qwen a special-case demo path.
- Do not make the provider abstraction leak into product behavior.

## 5. Understand-Anything style graph grounding

Premortem must behave like a repository graph system, not flat RAG.

### Graph construction principles

- Separate structural parsing from semantic summarization.
- Build the graph once per commit or tag, then reuse it.
- Represent graph nodes for:
  - repo
  - service
  - package
  - pipeline
  - owner
  - artifact
  - issue
- Use Orbit as the primary graph when it is available.
- For local or non-Orbit runs, use an Understand-Anything style pipeline that produces a compatible graph shape.

### Agent usage of graph

All swarm agents must:

1. Query graph nodes and edges before calling an LLM.
2. Include graph-based evidence in every finding.
3. Avoid hallucinating structure the graph can already provide.

## 6. Open Agents style runtime layering

Premortem runtime should use a layered design.

### Layer 1: Agent orchestrator

- Lives outside the sandbox.
- Owns workflow truth.
- Connects repo, refreshes graph, schedules swarm runs, collects findings, clusters output, and routes review or publish actions.

### Layer 2: Execution sandboxes

- Optional.
- Used only for code execution, static analysis, or test runs.
- Must be isolated, disposable, and resumable when needed.
- Must not hold long-lived state.

### Layer 3: Integration layer

- GitLab APIs and Orbit tools.
- Slack Agent Builder or MCP endpoints.
- Qwen and Gemini provider adapters.

### Tooling contract

- Use a tool registry or skill manifest.
- Do not hard-wire tools directly into prompts.
- Log tool invocations and link them to agent runs for auditability.

## 7. UI and infra principles

### Reviewer UI

- Keep the UI calm, operational, and reviewer-first.
- Use light neutral surfaces, strong typography, and minimal chrome.
- Show short, high-signal summaries first.
- Keep deeper evidence behind explicit expansion.

### Issue and evidence presentation

Each issue candidate should show:

- headline
- core explanation
- evidence links
- primary action such as review, edit, or publish

If the source data has an attached code snippet, the issue body and review UI must include that snippet alongside the evidence reference.

### Local development and infrastructure

- Prefer stable localhost hostnames over ephemeral numeric ports when possible.
- Keep production paths pointed at real services with correct auth.
- Use emulation only for local or integration test support, not as the product runtime.

## 8. Guardrails

- Do not implement chatty assistants that never produce structured findings or issue candidates.
- Do not bypass Orbit for data Orbit already supplies.
- Do not auto-create issues or merge code without explicit human approval.
- Do not optimize for demo polish at the expense of reliability, auditability, or schema consistency.
- Do not degrade findings into generic best practices, empty platitudes, or placeholder remediation text.

## 9. Canonical output contract for remediation prompts

Any remediation prompt or issue-body generator that implements this spec must require:

- a deterministic target scope
- a concrete code or graph anchor
- a structured evidence payload
- an explicit suggested fix
- an explicit success criterion
- a reviewer action

If the prompt cannot support those fields, it is not production-ready.

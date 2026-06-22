# Enterprise readiness

Premortem is designed to make enterprise review possible without pretending it already has every provider or packaging mode shipped.

## Developer tests

Premortem only earns reviewer trust when the output passes three checks:

- Don't Waste My Time: findings must be concrete, structural, and code-specific.
- Context Boundary: findings must be grounded in the repository, not guessed from a short prompt alone.
- Workflow Disruption: the review loop must stay inside the existing git workflow, terminal commands, and repo-native evals.

If the system cannot point at a real file, route, config key, graph edge, or CI artifact, it should return no finding instead of generic advice.

## Data gateway

- Repository content is consumed by background workers and reduced into structured findings, clusters, issue candidates, and audit snapshots.
- The reviewer console persists operational artifacts, not a copy of the repository tree.
- Provider tokens remain server-side and are scoped to the integration needed for the task.

## AI privacy

- Prompts are shaped by a workflow contract that rejects generic output and refuses weak evidence.
- Consensus validation drops low-confidence worker noise before it reaches reviewer queues.
- Output scrubbing removes sensitive strings from generated text before persistence or publish.

## Tenant isolation

- Organization-scoped queries, Supabase RLS, and server-side session context separate workspace data.
- Webhook handlers validate inbound signatures before they can enqueue work.
- The worker boundary is designed so one tenant cannot read another tenant’s audit state.

## Provider support matrix

- GitLab: supported for connect, ingest, publish, and reconciliation.
- GitHub: sign-in and auth primitives exist; repository integration is roadmap.
- Bitbucket: roadmap.
- Azure DevOps: roadmap.
- Gitea: roadmap.

## Operational controls

- Audit runs are logged with actor, organization, timestamps, and workflow state.
- Review gates prevent direct agent-to-provider publish.
- Dedicated stop and resume controls make background runs observable and reversible.

## Compliance evidence

- Audit trails should capture who triggered the run, which workspace it used, and what was approved.
- The system is structured to support SOC 2 style evidence collection through immutable run records and reconciliation history.
- Exportable audit history and workspace settings make security review evidence easier to assemble.

## Deployment modes

- SaaS is the default operational mode.
- The web, API, orchestrator, database, and graph layers are separated so a private-cloud deployment can be reasoned about cleanly.
- Self-hosted or BYOK packaging is a separate delivery track and should be documented before any enterprise commitment.

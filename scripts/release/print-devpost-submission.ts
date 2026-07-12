#!/usr/bin/env node

const submission = `# Premortem Devpost Submission Brief

## One-liner

Premortem is a reviewer-first predictive audit system that turns repository context into grounded, review-ready failure modes instead of generic AI noise.

## Problem

Engineering teams already have scanners and dashboards. They still struggle with alert fatigue, shallow AI summaries, and issue queues that do not connect findings to evidence, remediation, and review state.

## What Premortem does

- Runs bounded audits over repository, CI, and integration context.
- Uses parallel specialist lanes with consensus validation so single-agent noise does not reach reviewers.
- Clusters and deduplicates findings before they become issue candidates.
- Requires human approval before publishing to GitLab.
- Keeps tenant boundaries and workflow state explicit for enterprise review.

## Why it is different

- It is grounded in concrete repository refs, not generic risk advice.
- It filters out low-signal anomalies before the reviewer queue.
- It produces a mitigation triplet: risk, impact, and remediation surface.
- It is designed for auditability, not magic.

## Security defensibility

- GitLab repository connect, publish, and reconcile are live.
- GitHub sign-in primitives exist, but GitHub repository integration, Bitbucket, Azure DevOps, and Gitea are roadmap surfaces in this release.
- Organization-scoped queries, RLS, webhook validation, and review gates keep workspace data isolated.
- The docs now include an enterprise readiness brief and a public FAQ for security reviewers.

## Demo flow

1. Sign in.
2. Connect GitLab.
3. Register a repository.
4. Run an audit.
5. Review clustered findings.
6. Approve one candidate and publish it to GitLab.

## The alert-fatigue claim

Premortem does not surface every worker opinion. It converges parallel analysis through consensus validation, clustering, and reviewer gates so the output is smaller, more actionable, and easier to trust.
`;

process.stdout.write(`${submission}\n`);

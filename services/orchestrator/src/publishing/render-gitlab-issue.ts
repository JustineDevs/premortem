import type { IssueCandidate } from '@premortem/agent-kit';

export interface GitLabIssueRenderContext {
  issueCandidateId?: string;
  auditRunId?: string;
  branch?: string | null;
  commitSha?: string | null;
  projectPath?: string | null;
  reviewerStatus?: string;
  priority?: string;
  assignee?: string | null;
  milestone?: string | null;
  dueDate?: string | null;
  timeEstimate?: string | null;
  weight?: number | null;
}

function formatEvidenceLine(item: { kind: string; ref: string; reason: string }) {
  const ref = item.ref.includes(' ') ? item.ref : `\`${item.ref}\``;
  return `- **${item.kind}** ${ref}: ${item.reason}`;
}

export function renderGitLabIssue(issue: IssueCandidate, context: GitLabIssueRenderContext = {}): string {
  const sections: string[] = [];

  sections.push(
    '## Predicted failure',
    issue.predicted_failure_summary,
    '',
    '## Why this matters',
    issue.why_it_matters
  );

  if (context.projectPath || context.branch || context.commitSha) {
    sections.push(
      '',
      '## Repository context',
      `- **Project**: ${context.projectPath ?? 'unknown'}`,
      ...(context.branch ? [`- **Branch**: \`${context.branch}\``] : []),
      ...(context.commitSha ? [`- **Commit**: \`${context.commitSha}\``] : [])
    );
  }

  sections.push(
    '',
    '## Trigger conditions',
    ...issue.trigger_conditions.map((condition) => `- ${condition}`),
    '',
    '## Evidence',
    ...issue.evidence.map(formatEvidenceLine),
    '',
    '## Affected assets',
    ...issue.affected_assets.map((asset) => `- \`${asset}\``),
    '',
    '## Recommended action',
    issue.recommended_action_summary,
    '',
    '## Implementation steps',
    ...issue.implementation_steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Success criteria',
    ...issue.done_criteria.map((criterion) => `- [ ] ${criterion}`),
    '',
    '## Lineage',
    `- **Category**: \`${issue.category}\``,
    `- **Severity**: \`${issue.severity}\``,
    `- **Confidence**: ${issue.confidence.toFixed(3)}`,
    `- **Source agents**: ${issue.source_agents.map((agent) => `\`${agent}\``).join(', ')}`,
    `- **Source findings**: ${issue.source_findings.map((id) => `\`${id}\``).join(', ')}`
  );

  if (
    context.auditRunId ||
    context.issueCandidateId ||
    context.reviewerStatus ||
    context.priority
  ) {
    sections.push(
      '',
      '## Premortem traceability',
      '| Field | Value |',
      '| --- | --- |',
      ...(context.issueCandidateId
        ? [`| Issue candidate | \`${context.issueCandidateId}\` |`]
        : []),
      ...(context.auditRunId ? [`| Audit run | \`${context.auditRunId}\` |`] : []),
      ...(context.reviewerStatus ? [`| Reviewer status | \`${context.reviewerStatus}\` |`] : []),
      ...(context.priority ? [`| Priority | \`${context.priority}\` |`] : [])
    );
  }

  const scheduling: string[] = [];
  if (context.assignee) scheduling.push(`- **Assignee**: @${context.assignee}`);
  if (context.milestone) scheduling.push(`- **Milestone**: ${context.milestone}`);
  if (context.dueDate) scheduling.push(`- **Due date**: ${context.dueDate}`);
  if (context.timeEstimate) scheduling.push(`- **Time estimate**: ${context.timeEstimate}`);
  if (context.weight != null) scheduling.push(`- **Weight**: ${context.weight}`);

  if (scheduling.length > 0) {
    sections.push('', '## Work item scheduling', ...scheduling);
  }

  return sections.join('\n');
}

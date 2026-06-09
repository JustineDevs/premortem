import type { IssueCandidate } from '@premortem/agent-kit';

export function renderGitLabIssue(issue: IssueCandidate): string {
  return [
    '## Summary',
    issue.predicted_failure_summary,
    '',
    '## Why this matters',
    issue.why_it_matters,
    '',
    '## Trigger conditions',
    ...issue.trigger_conditions.map((x) => `- ${x}`),
    '',
    '## Evidence',
    ...issue.evidence.map((x) => `- \`${x.ref}\`: ${x.reason}`),
    '',
    '## Implementation steps',
    ...issue.implementation_steps.map((x, i) => `${i + 1}. ${x}`),
    '',
    '## Success criteria',
    ...issue.done_criteria.map((x) => `- [ ] ${x}`)
  ].join('\n');
}

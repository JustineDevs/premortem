import type { CanonicalFinding, IssueCandidate } from './types';

export function validateFinding(finding: CanonicalFinding): string[] {
  const errors: string[] = [];
  if (!finding.category) errors.push('missing category');
  if (!finding.finding_type) errors.push('missing finding_type');
  if (!finding.predicted_failure?.summary) errors.push('missing predicted_failure.summary');
  if ((finding.evidence?.length ?? 0) < 2) errors.push('not enough evidence');
  if ((finding.recommended_controls?.length ?? 0) < 2) errors.push('not enough recommended_controls');
  return errors;
}

export function validateIssueCandidate(issue: IssueCandidate): string[] {
  const errors: string[] = [];
  if (!issue.title || issue.title.length < 12) errors.push('weak title');
  if ((issue.evidence?.length ?? 0) < 2) errors.push('not enough evidence');
  if ((issue.trigger_conditions?.length ?? 0) < 2) errors.push('not enough trigger conditions');
  if ((issue.implementation_steps?.length ?? 0) < 2) errors.push('not enough implementation steps');
  if ((issue.done_criteria?.length ?? 0) < 2) errors.push('not enough done criteria');
  return errors;
}

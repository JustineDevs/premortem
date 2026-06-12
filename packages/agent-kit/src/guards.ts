import type { CanonicalFinding, IssueCandidate } from './types';

const SYNTHETIC_EVIDENCE_REF =
  /^repo:\/\/[^/]+\/[^/]+\/\d+\/(primary|secondary)$|^repo:\/\/[0-9a-f-]{36}\//i;

const GENERIC_ISSUE_TITLE =
  /^contain .+ failures before production rollout$/i;

export function isSyntheticEvidenceRef(ref: string): boolean {
  return SYNTHETIC_EVIDENCE_REF.test(ref.trim());
}

export function validateFinding(finding: CanonicalFinding): string[] {
  const errors: string[] = [];
  if (!finding.category) errors.push('missing category');
  if (!finding.finding_type) errors.push('missing finding_type');
  if (!finding.predicted_failure?.summary) errors.push('missing predicted_failure.summary');
  if ((finding.evidence?.length ?? 0) < 2) errors.push('not enough evidence');
  if ((finding.recommended_controls?.length ?? 0) < 2) errors.push('not enough recommended_controls');

  for (const item of finding.evidence ?? []) {
    if (isSyntheticEvidenceRef(item.ref)) {
      errors.push(`synthetic evidence ref: ${item.ref}`);
    }
  }

  return errors;
}

export function validateIssueCandidate(issue: IssueCandidate): string[] {
  const errors: string[] = [];
  if (!issue.title || issue.title.length < 12) errors.push('weak title');
  if (GENERIC_ISSUE_TITLE.test(issue.title.trim())) errors.push('generic mock-style title');
  if ((issue.evidence?.length ?? 0) < 2) errors.push('not enough evidence');
  if ((issue.trigger_conditions?.length ?? 0) < 2) errors.push('not enough trigger conditions');
  if ((issue.implementation_steps?.length ?? 0) < 2) errors.push('not enough implementation steps');
  if ((issue.done_criteria?.length ?? 0) < 2) errors.push('not enough done criteria');
  if ((issue.affected_assets?.length ?? 0) < 1) errors.push('missing affected assets');
  if ((issue.source_findings?.length ?? 0) < 1) errors.push('missing source findings');

  for (const item of issue.evidence ?? []) {
    if (isSyntheticEvidenceRef(item.ref)) {
      errors.push(`synthetic evidence ref: ${item.ref}`);
    }
  }

  if (
    issue.predicted_failure_summary.length < 30 ||
    (!issue.predicted_failure_summary.includes('`') &&
      !/\/[\w.-]+\.\w+/.test(issue.predicted_failure_summary))
  ) {
    errors.push('predicted failure summary lacks concrete repository context');
  }

  return errors;
}

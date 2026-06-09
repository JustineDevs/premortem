import { validateIssueCandidate, type IssueCandidate } from '@premortem/agent-kit';

export function validateIssues(issueCandidates: IssueCandidate[]) {
  return issueCandidates.map((issue) => ({
    issue,
    errors: validateIssueCandidate(issue)
  }));
}

import { parseIssueEnvelope, validateIssueCandidate } from '@premortem/agent-kit';

export interface IssueEvalSummary {
  issueCount: number;
  categories: string[];
  titles: string[];
}

export function parseAndValidateIssueOutput(text: string): IssueEvalSummary {
  const issues = parseIssueEnvelope(text);
  const failures = issues.flatMap((issue) =>
    validateIssueCandidate(issue).map((message) => `${issue.title}: ${message}`)
  );

  if (failures.length > 0) {
    throw new Error(`Issue candidate validation failed: ${failures.join('; ')}`);
  }

  return {
    issueCount: issues.length,
    categories: [...new Set(issues.map((issue) => issue.category))].sort(),
    titles: issues.map((issue) => issue.title)
  };
}

import type { IssueCandidate } from '@premortem/agent-kit';

export interface SynthesizedIssueGroundingCheck {
  issue: IssueCandidate;
  groundingErrors: string[];
}

export interface SynthesizedIssueEvalGateAssertion {
  assertionKey: string;
  status: 'pass' | 'fail';
  score: number;
  details: Record<string, unknown>;
}

export interface SynthesizedIssueEvalGateResult {
  passedIssues: IssueCandidate[];
  rejectedIssues: Array<{ issue: IssueCandidate; groundingErrors: string[] }>;
  assertions: SynthesizedIssueEvalGateAssertion[];
  metrics: {
    issueCount: number;
    passedCount: number;
    rejectedCount: number;
    passRate: number;
  };
}

export function evaluateSynthesizedIssueGroundingGate(
  checks: SynthesizedIssueGroundingCheck[]
): SynthesizedIssueEvalGateResult {
  const passedIssues: IssueCandidate[] = [];
  const rejectedIssues: Array<{ issue: IssueCandidate; groundingErrors: string[] }> = [];
  const assertions: SynthesizedIssueEvalGateAssertion[] = [];

  checks.forEach((check, index) => {
    const grounded = check.groundingErrors.length === 0;
    const assertionKey = `synthesized_issue_${index + 1}_grounding`;

    assertions.push({
      assertionKey,
      status: grounded ? 'pass' : 'fail',
      score: grounded ? 1 : 0,
      details: {
        issueTitle: check.issue.title,
        category: check.issue.category,
        severity: check.issue.severity,
        groundingErrorCount: check.groundingErrors.length,
        groundingErrors: check.groundingErrors
      }
    });

    if (grounded) {
      passedIssues.push(check.issue);
      return;
    }

    rejectedIssues.push({
      issue: check.issue,
      groundingErrors: check.groundingErrors
    });
  });

  const issueCount = checks.length;
  const passedCount = passedIssues.length;
  const rejectedCount = rejectedIssues.length;
  const passRate = issueCount > 0 ? passedCount / issueCount : 1;

  assertions.unshift({
    assertionKey: 'synthesized_issue_grounding_gate',
    status: rejectedCount === 0 ? 'pass' : 'fail',
    score: passRate,
    details: {
      issueCount,
      passedCount,
      rejectedCount,
      passRate
    }
  });

  return {
    passedIssues,
    rejectedIssues,
    assertions,
    metrics: {
      issueCount,
      passedCount,
      rejectedCount,
      passRate
    }
  };
}

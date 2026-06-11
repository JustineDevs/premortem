import { prisma } from '@premortem/db';

import { publishIssueCandidateToGitHub } from '../lib/publish-to-github';
import { publishIssueCandidateToGitLab } from '../lib/publish-to-gitlab';

export async function publishIssueCandidate(issueCandidateId: string) {
  const issue = await prisma.issueCandidate.findUnique({
    where: { id: issueCandidateId },
    include: {
      project: true,
      auditRun: { select: { branch: true, commitSha: true } },
      publishedIssue: true
    }
  });

  if (!issue) {
    throw new Error(`Issue candidate ${issueCandidateId} not found`);
  }

  if (issue.project.provider === 'github') {
    return publishIssueCandidateToGitHub(issue);
  }

  return publishIssueCandidateToGitLab(issue);
}

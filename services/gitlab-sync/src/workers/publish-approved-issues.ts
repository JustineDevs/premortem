import { prisma } from '@premortem/db';

import { publishIssueCandidateToGitLab } from '../lib/publish-to-gitlab';

export async function publishApprovedIssues() {
  const issues = await prisma.issueCandidate.findMany({
    where: {
      reviewerStatus: { in: ['approved', 'edited'] },
      publishedIssue: null
    },
    include: {
      cluster: {
        select: { id: true }
      },
      project: true,
      auditRun: { select: { branch: true, commitSha: true } },
      publishedIssue: true
    },
    take: 25
  });

  let publishedCount = 0;
  for (const issue of issues) {
    await publishIssueCandidateToGitLab({
      ...issue,
      clusterId: issue.cluster?.id ?? null
    });
    publishedCount += 1;
  }

  return { publishedCount };
}

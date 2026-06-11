import { prisma } from '@premortem/db';

import { publishIssueCandidateToGitLab } from '../lib/publish-to-gitlab';

export async function publishApprovedIssues() {
  const issues = await prisma.issueCandidate.findMany({
    where: {
      reviewerStatus: { in: ['approved', 'edited'] },
      publishedIssue: null
    },
    include: {
      project: true,
      publishedIssue: true
    },
    take: 25
  });

  let publishedCount = 0;
  for (const issue of issues) {
    await publishIssueCandidateToGitLab(issue);
    publishedCount += 1;
  }

  return { publishedCount };
}

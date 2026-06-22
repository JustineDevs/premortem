import type { Prisma } from '@prisma/client';

import { prisma } from './client';

export type PublishedIssueOutcomeType = 'true_positive' | 'false_positive' | 'not_applicable' | 'wont_fix';

export interface PublishedIssueAccuracySummary {
  totalPublishedIssues: number;
  classifiedPublishedIssues: number;
  truePositives: number;
  falsePositives: number;
  notApplicable: number;
  wontFix: number;
  precision: number | null;
  coverage: number | null;
}

/** Persist reviewer outcome feedback for a published issue. */
export async function recordPublishedIssueOutcome(input: {
  organizationId: string;
  projectId: string;
  publishedIssueId: string;
  outcomeType: PublishedIssueOutcomeType;
  outcomeNotes?: string | null;
}) {
  const publishedIssue = await prisma.publishedIssue.findUnique({
    where: { id: input.publishedIssueId },
    select: { id: true, organizationId: true, projectId: true }
  });

  if (!publishedIssue || publishedIssue.organizationId !== input.organizationId || publishedIssue.projectId !== input.projectId) {
    return null;
  }

  return prisma.publishedIssue.update({
    where: { id: input.publishedIssueId },
    data: {
      outcomeType: input.outcomeType,
      outcomeNotes: input.outcomeNotes?.trim() || null,
      outcomeAt: new Date()
    }
  });
}

/** Summarize reviewer outcomes for a project so enterprise accuracy can be displayed. */
export async function getPublishedIssueAccuracyForProject(input: {
  organizationId: string;
  projectId: string;
}): Promise<PublishedIssueAccuracySummary> {
  const [totalPublishedIssues, grouped] = await Promise.all([
    prisma.publishedIssue.count({
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId
      }
    }),
    prisma.publishedIssue.groupBy({
      by: ['outcomeType'],
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        outcomeType: { not: null }
      },
      _count: {
        outcomeType: true
      }
    })
  ]);

  const counts = new Map<string, number>();
  for (const row of grouped) {
    if (!row.outcomeType) continue;
    counts.set(row.outcomeType, row._count.outcomeType);
  }

  const truePositives = counts.get('true_positive') ?? 0;
  const falsePositives = counts.get('false_positive') ?? 0;
  const notApplicable = counts.get('not_applicable') ?? 0;
  const wontFix = counts.get('wont_fix') ?? 0;
  const classifiedPublishedIssues = truePositives + falsePositives + notApplicable + wontFix;

  return {
    totalPublishedIssues,
    classifiedPublishedIssues,
    truePositives,
    falsePositives,
    notApplicable,
    wontFix,
    precision: classifiedPublishedIssues > 0 ? truePositives / classifiedPublishedIssues : null,
    coverage: totalPublishedIssues > 0 ? classifiedPublishedIssues / totalPublishedIssues : null
  };
}


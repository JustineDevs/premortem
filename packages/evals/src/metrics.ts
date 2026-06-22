import { prisma } from '@premortem/db';

export interface EvalMetric {
  name: 'precision' | 'merge_quality' | 'duplicate_suppression' | 'false_positive_rate';
  value: number;
}

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Compute the core audit evaluation metrics for a completed run.
 *
 * The metrics are intentionally simple ratios so they can be trend-tracked
 * across audits without depending on any external evaluation service.
 */
export async function computeEvalMetrics(auditRunId: string): Promise<EvalMetric[]> {
  const [
    totalIssueCandidates,
    approvedIssues,
    rejectedIssues,
    findingCount,
    clusterCount,
    validationSummary
  ] =
    await Promise.all([
      prisma.issueCandidate.count({
        where: { auditRunId }
      }),
      prisma.issueCandidate.count({
        where: { auditRunId, reviewerStatus: 'approved' }
      }),
      prisma.issueCandidate.count({
        where: { auditRunId, reviewerStatus: 'rejected' }
      }),
      prisma.finding.count({
        where: { auditRunId }
      }),
      prisma.dedupeCluster.count({
        where: { auditRunId }
      }),
      prisma.issueValidationResult.aggregate({
        where: {
          issueCandidate: {
            auditRunId
          }
        },
        _avg: {
          score: true
        }
      })
    ]);

  const precision = totalIssueCandidates > 0 ? approvedIssues / totalIssueCandidates : 0;
  const falsePositiveRate = totalIssueCandidates > 0 ? rejectedIssues / totalIssueCandidates : 0;
  const duplicateSuppression =
    findingCount > 0 ? Math.max(0, 1 - clusterCount / findingCount) : 0;
  const mergeQuality = toNumber(validationSummary._avg.score);

  return [
    { name: 'precision', value: precision },
    { name: 'merge_quality', value: mergeQuality },
    { name: 'duplicate_suppression', value: duplicateSuppression },
    { name: 'false_positive_rate', value: falsePositiveRate }
  ];
}

import { issueCandidateToConsoleStatus } from './review';
import { runStatusToConsoleRunStatus, scoreFromReviewQueueCounts, scoreFromSeverityCounts } from './status';
import { countSeverities, severityToConsole } from './severity';

export interface RuntimeIssueCandidateRow {
  id: string;
  title: string;
  validationStatus: string;
  reviewerStatus: string;
  publishedUrl?: string | null;
}

export interface RuntimeFindingRow {
  id: string;
  title: string;
  category: string;
  severity: string;
  predictedFailureSummary: string;
  agentRunId: string;
}

export interface RuntimeLineageRow {
  stage: string;
  id: string;
  label: string;
  parentId?: string;
}

export interface RuntimeAuditSnapshotLike {
  auditRunId: string;
  projectId: string;
  branch: string;
  runStatus: string;
  issueCandidates: RuntimeIssueCandidateRow[];
  findings: RuntimeFindingRow[];
  lineage: RuntimeLineageRow[];
  events: ReadonlyArray<{ eventType: string }>;
  clusters?: ReadonlyArray<{
    id: string;
    categoryOwner: string;
    titleHint?: string | null;
    severity: string;
    findingCount: number;
  }>;
}

export interface ConsoleFindingProjection {
  id: string;
  title: string;
  severity: ReturnType<typeof severityToConsole>;
  status: ReturnType<typeof issueCandidateToConsoleStatus>;
  category: string;
  filepath: string;
  line: number;
  description: string;
  evidence: string;
  trace: Array<{ step: number; description: string; location: string }>;
  recommendation: string;
  aiReasoning: string;
  gitlabIssueId?: string;
  whyItMatters?: string;
}

export function projectIssueCandidateToConsoleFinding(
  snapshot: RuntimeAuditSnapshotLike,
  issue: RuntimeIssueCandidateRow
): ConsoleFindingProjection {
  const lineageEntry = snapshot.lineage.find(
    (entry) => entry.stage === 'issue_candidate' && entry.id === issue.id
  );
  const cluster = lineageEntry?.parentId
    ? snapshot.clusters?.find((item) => item.id === lineageEntry.parentId)
    : undefined;
  const relatedFinding = snapshot.findings.find((finding) =>
    snapshot.lineage.some(
      (entry) =>
        entry.stage === 'finding' &&
        entry.id === finding.id &&
        entry.parentId &&
        cluster &&
        snapshot.lineage.some(
          (clusterEntry) =>
            clusterEntry.stage === 'cluster' &&
            clusterEntry.id === cluster.id &&
            clusterEntry.id === lineageEntry?.parentId
        )
    )
  );
  const severity = severityToConsole(
    cluster?.severity ?? relatedFinding?.severity ?? snapshot.findings[0]?.severity ?? 'high'
  );

  return {
    id: issue.id,
    title: issue.title,
    severity,
    status: issueCandidateToConsoleStatus(issue),
    category: 'issue_candidate',
    filepath: snapshot.branch,
    line: 0,
    description: issue.title,
    evidence: `Validation: ${issue.validationStatus}. Reviewer: ${issue.reviewerStatus}.`,
    trace: snapshot.lineage
      .filter((entry) => entry.stage === 'issue_candidate' && entry.id === issue.id)
      .map((entry, index) => ({
        step: index + 1,
        description: entry.label,
        location: entry.parentId ?? snapshot.auditRunId
      })),
    recommendation: 'Review and approve before publish.',
    aiReasoning:
      snapshot.findings[0]?.predictedFailureSummary ??
      'Structured issue candidate synthesized from specialist swarm findings.',
    gitlabIssueId: issue.publishedUrl ?? undefined,
    whyItMatters: issue.title
  };
}

export function projectSnapshotToConsoleAudit(
  snapshot: RuntimeAuditSnapshotLike,
  projectName: string,
  createdAt?: string
) {
  const severityCounts = countSeverities(snapshot.findings);
  return {
    id: snapshot.auditRunId,
    projectId: snapshot.projectId,
    projectName,
    score: scoreFromSeverityCounts(severityCounts),
    status: runStatusToConsoleRunStatus(snapshot.runStatus),
    date: createdAt ?? new Date().toISOString(),
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    findings: snapshot.issueCandidates.map((issue) =>
      projectIssueCandidateToConsoleFinding(snapshot, issue)
    ),
    runtimeEventTypes: snapshot.events.map((event) => event.eventType)
  };
}

export function projectAuditListItemToConsoleAudit(
  item: {
    auditRunId: string;
    projectId: string;
    branch: string;
    runStatus: string;
    createdAt: string;
    reviewableIssueCount: number;
    rejectedIssueCount: number;
  },
  projectName: string
) {
  return {
    id: item.auditRunId,
    projectId: item.projectId,
    projectName,
    score: scoreFromReviewQueueCounts(item.reviewableIssueCount, item.rejectedIssueCount),
    status: runStatusToConsoleRunStatus(item.runStatus),
    date: item.createdAt,
    criticalCount: 0,
    highCount: item.reviewableIssueCount,
    mediumCount: item.rejectedIssueCount,
    lowCount: 0,
    findings: [] as ConsoleFindingProjection[]
  };
}

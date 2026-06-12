import type { EvidenceRefLike } from './evidence-projection';
import {
  buildTraceFromEvidence,
  formatRecommendedPatch,
  formatSourceCodeEvidence,
  normalizeEvidenceRefs,
  primaryEvidenceLocation
} from './evidence-projection';
import { issueCandidateToConsoleStatus } from './review';
import { runStatusToConsoleRunStatus, scoreFromReviewQueueCounts, scoreFromSeverityCounts } from './status';
import { countSeverities, severityToConsole } from './severity';

export type { EvidenceRefLike };

export interface RuntimeIssueCandidateRow {
  id: string;
  title: string;
  validationStatus: string;
  reviewerStatus: string;
  publishedUrl?: string | null;
  category?: string;
  predictedFailureSummary?: string;
  whyItMatters?: string;
  recommendedActionSummary?: string;
  implementationSteps?: string[];
  doneCriteria?: string[];
  affectedAssets?: string[];
  sourceFindings?: string[];
  clusterId?: string;
  evidence?: EvidenceRefLike[];
}

export interface RuntimeFindingRow {
  id: string;
  findingKey: string;
  title: string;
  category: string;
  severity: string;
  predictedFailureSummary: string;
  agentRunId: string;
  whyItMatters?: string | null;
  failureMode?: string | null;
  triggerConditions?: string[];
  affectedAssets?: string[];
  recommendedControls?: string[];
  evidence?: EvidenceRefLike[];
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
    memberFindingIds?: string[];
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
  trace: Array<{ step: number; description: string; location: string; codeSnippet?: string }>;
  recommendation: string;
  aiReasoning: string;
  gitlabIssueId?: string;
  whyItMatters?: string;
  suggestedPatchCode?: string;
  expectedBehavior?: string;
  successCriteria?: string;
}

function relatedFindingsForIssue(snapshot: RuntimeAuditSnapshotLike, issue: RuntimeIssueCandidateRow) {
  const sourceKeys = new Set(issue.sourceFindings ?? []);
  if (sourceKeys.size > 0) {
    return snapshot.findings.filter(
      (finding) => sourceKeys.has(finding.findingKey) || sourceKeys.has(finding.id)
    );
  }

  const lineageEntry = snapshot.lineage.find(
    (entry) => entry.stage === 'issue_candidate' && entry.id === issue.id
  );
  const clusterId = issue.clusterId ?? lineageEntry?.parentId;
  if (!clusterId) return [];

  const cluster = snapshot.clusters?.find((item) => item.id === clusterId);
  const memberIds = new Set(cluster?.memberFindingIds ?? []);
  if (memberIds.size === 0) return [];

  return snapshot.findings.filter((finding) => memberIds.has(finding.id)).slice(0, 6);
}

function collectIssueEvidence(snapshot: RuntimeAuditSnapshotLike, issue: RuntimeIssueCandidateRow) {
  const issueEvidence = normalizeEvidenceRefs(issue.evidence);
  if (issueEvidence.length >= 2) return issueEvidence;

  const related = relatedFindingsForIssue(snapshot, issue);
  const findingEvidence = related.flatMap((finding) => normalizeEvidenceRefs(finding.evidence));
  const merged = [...issueEvidence];
  for (const item of findingEvidence) {
    const duplicate = merged.some(
      (existing) => existing.ref === item.ref && existing.reason === item.reason
    );
    if (!duplicate) merged.push(item);
  }
  return merged.slice(0, 8);
}

export function projectIssueCandidateToConsoleFinding(
  snapshot: RuntimeAuditSnapshotLike,
  issue: RuntimeIssueCandidateRow
): ConsoleFindingProjection {
  const relatedFindings = relatedFindingsForIssue(snapshot, issue);
  const primaryFinding = relatedFindings[0];
  const cluster = snapshot.lineage.find(
    (entry) => entry.stage === 'issue_candidate' && entry.id === issue.id
  )?.parentId
    ? snapshot.clusters?.find(
        (item) =>
          item.id ===
          snapshot.lineage.find(
            (entry) => entry.stage === 'issue_candidate' && entry.id === issue.id
          )?.parentId
      )
    : undefined;

  const evidenceItems = collectIssueEvidence(snapshot, issue);
  const location = primaryEvidenceLocation(evidenceItems);
  const severity = severityToConsole(
    cluster?.severity ?? primaryFinding?.severity ?? relatedFindings[0]?.severity ?? 'high'
  );

  const recommendedControls = relatedFindings.flatMap((finding) => finding.recommendedControls ?? []);
  const suggestedPatchCode = formatRecommendedPatch({
    recommendedActionSummary: issue.recommendedActionSummary,
    implementationSteps: issue.implementationSteps,
    recommendedControls
  });

  return {
    id: issue.id,
    title: issue.title,
    severity,
    status: issueCandidateToConsoleStatus(issue),
    category: primaryFinding?.category ?? issue.category ?? 'issue_candidate',
    filepath: location.filepath,
    line: location.line,
    description:
      issue.predictedFailureSummary?.trim() ||
      primaryFinding?.predictedFailureSummary ||
      issue.title,
    evidence: formatSourceCodeEvidence(evidenceItems),
    trace: buildTraceFromEvidence(evidenceItems),
    recommendation:
      issue.recommendedActionSummary?.trim() ||
      formatRecommendedPatch({ recommendedControls }) ||
      'Review and approve before publish.',
    aiReasoning:
      issue.whyItMatters?.trim() ||
      primaryFinding?.whyItMatters?.trim() ||
      primaryFinding?.predictedFailureSummary ||
      'Structured issue candidate synthesized from specialist swarm findings.',
    gitlabIssueId: issue.publishedUrl ?? undefined,
    whyItMatters: issue.whyItMatters ?? primaryFinding?.whyItMatters ?? undefined,
    suggestedPatchCode,
    expectedBehavior: primaryFinding?.failureMode ?? undefined,
    successCriteria: (issue.doneCriteria ?? []).join('\n') || undefined
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

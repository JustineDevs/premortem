import type { EvidenceRefLike } from './evidence-projection';
import {
  buildTraceFromEvidence,
  formatRecommendedPatch,
  formatSourceCodeEvidence,
  parseFileEvidenceRef,
  normalizeEvidenceRefs,
  primaryEvidenceLocation
} from './evidence-projection';
import { renderPublishedIssueBodyMarkdown } from './issue-body';
import { ConsoleIssueStatus, issueCandidateToConsoleStatus } from './review';
import { runStatusToConsoleRunStatus, scoreFromReviewQueueCounts, scoreFromSeverityCounts } from './status';
import { countSeverities, severityToConsole } from './severity';

export type { EvidenceRefLike };

function buildRecommendedCodeDnaSnippet(
  title: string,
  evidence: EvidenceRefLike[],
  recommendedActionSummary?: string,
  implementationSteps: string[] = [],
  recommendedControls: string[] = []
) {
  const primarySnippet = evidence.find((item) => item.codeSnippet?.trim());
  const citedEvidence = evidence.slice(0, 4).map((item, index) => {
    const parsed = parseFileEvidenceRef(item.ref);
    const citation = parsed
      ? `${parsed.filePath}:${parsed.startLine}${parsed.endLine > parsed.startLine ? `-${parsed.endLine}` : ''}`
      : item.ref;
    const reason = item.reason ? ` — ${item.reason}` : '';
    return `// Evidence citation ${index + 1}: ${citation}${reason}`;
  });

  const sourceExcerpt = primarySnippet?.codeSnippet?.trim()
    ? primarySnippet.codeSnippet
        .trim()
        .split('\n')
        .slice(0, 8)
        .map((line) => `// ${line}`)
    : ['// Source excerpt unavailable in this snapshot.'];

  const steps = implementationSteps.length > 0
    ? implementationSteps.map((step, index) => `  // Step ${index + 1}: ${step}`)
    : ['  // Step 1: Apply the smallest safe fix grounded in the cited evidence.'];

  const controls = recommendedControls.length > 0
    ? recommendedControls.map((control) => `  // Control: ${control}`)
    : ['  // Control: Keep the change scoped to the cited file and add a regression test.'];

  return [
    `// Recommended code DNA for ${title}`,
    `// Goal: ${recommendedActionSummary?.trim() || 'Apply the smallest safe fix grounded in the cited evidence.'}`,
    ...citedEvidence,
    '',
    ...sourceExcerpt,
    '',
    'export function applyRecommendedChange() {',
    ...steps,
    ...controls,
    '  return true;',
    '}'
  ].join('\n');
}

export interface RuntimeIssueCandidateRow {
  id: string;
  title: string;
  createdAt?: string;
  validationStatus: string;
  reviewerStatus: string;
  publishedUrl?: string | null;
  category?: string;
  confidence?: number;
  priority?: string;
  predictedFailureSummary?: string;
  whyItMatters?: string;
  triggerConditions?: string[];
  recommendedActionSummary?: string;
  implementationSteps?: string[];
  doneCriteria?: string[];
  affectedAssets?: string[];
  sourceAgents?: string[];
  sourceFindings?: string[];
  clusterId?: string;
  evidence?: EvidenceRefLike[];
  evidenceRefs?: EvidenceRefLike[];
  publishedIssueBodyMarkdown?: string | null;
}

export interface RuntimeFindingRow {
  id: string;
  findingKey: string;
  title: string;
  category: string;
  severity: string;
  predictedFailureSummary: string;
  agentRunId: string;
  confidence?: number;
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
  evidenceRefs?: EvidenceRefLike[];
  trace: Array<{ step: number; description: string; location: string; codeSnippet?: string }>;
  recommendation: string;
  aiReasoning: string;
  gitlabIssueId?: string;
  publishedIssueBodyMarkdown?: string;
  whyItMatters?: string;
  suggestedPatchCode?: string;
  expectedBehavior?: string;
  successCriteria?: string;
}

function projectRuntimeFindingToConsoleFinding(
  snapshot: RuntimeAuditSnapshotLike,
  finding: RuntimeFindingRow
): ConsoleFindingProjection {
  const evidence = normalizeEvidenceRefs(finding.evidence);
  const location = primaryEvidenceLocation(evidence);
  const recommendedControls = finding.recommendedControls ?? [];
  const title = finding.title?.trim() || finding.predictedFailureSummary?.trim() || finding.category;

  return {
    id: finding.id,
    title,
    severity: severityToConsole(finding.severity),
    status: ConsoleIssueStatus.OPEN,
    category: finding.category,
    filepath: location.filepath,
    line: location.line,
    description: finding.predictedFailureSummary?.trim() || title,
    evidence: formatSourceCodeEvidence(evidence),
    evidenceRefs: evidence,
    trace: buildTraceFromEvidence(evidence),
    recommendation: formatRecommendedPatch({
      recommendedActionSummary: finding.whyItMatters?.trim(),
      recommendedControls
    }) || finding.failureMode?.trim() || 'Review and convert to a published issue candidate.',
    aiReasoning:
      finding.whyItMatters?.trim() ||
      finding.predictedFailureSummary?.trim() ||
      'Runtime specialist finding projected from audit snapshot.',
    suggestedPatchCode: formatRecommendedPatch({
      recommendedControls,
      recommendedActionSummary: finding.whyItMatters?.trim()
    }),
    expectedBehavior: finding.failureMode?.trim() || undefined,
    successCriteria: (finding.affectedAssets ?? []).join('\n') || undefined
  };
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
  const issueEvidence = normalizeEvidenceRefs(issue.evidenceRefs ?? issue.evidence);
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
  const recommendedControls = relatedFindings.flatMap((finding) => finding.recommendedControls ?? []);
  const severity = severityToConsole(
    cluster?.severity ?? primaryFinding?.severity ?? relatedFindings[0]?.severity ?? 'high'
  );
  const publishedIssueBodyMarkdown =
    issue.publishedIssueBodyMarkdown?.trim() ||
      renderPublishedIssueBodyMarkdown(
      {
        title: issue.title,
        category: primaryFinding?.category ?? issue.category ?? 'issue_candidate',
        severity: String(primaryFinding?.severity ?? relatedFindings[0]?.severity ?? 'high'),
        confidence: Number(issue.confidence ?? primaryFinding?.confidence ?? 0.5),
        predictedFailureSummary:
          issue.predictedFailureSummary?.trim() ||
          primaryFinding?.predictedFailureSummary ||
          issue.title,
        whyItMatters:
          issue.whyItMatters?.trim() ||
          primaryFinding?.whyItMatters?.trim() ||
          primaryFinding?.predictedFailureSummary ||
          'Structured issue candidate synthesized from specialist swarm findings.',
        triggerConditions: issue.triggerConditions ?? [],
        evidence: evidenceItems,
        recommendedActionSummary:
          issue.recommendedActionSummary?.trim() ||
          formatRecommendedPatch({ recommendedControls }) ||
          'Review and approve before publish.',
        implementationSteps: issue.implementationSteps ?? [],
        doneCriteria: issue.doneCriteria ?? [],
        affectedAssets: issue.affectedAssets ?? [],
        sourceAgents: issue.sourceAgents ?? [],
        sourceFindings: issue.sourceFindings ?? []
      },
      {
        issueCandidateId: issue.id,
        auditRunId: snapshot.auditRunId,
        branch: snapshot.branch,
        createdAt: issue.createdAt,
        reviewerStatus: issue.reviewerStatus,
        priority: issue.priority
      }
    );

  const suggestedPatchCode = formatRecommendedPatch({
    recommendedActionSummary: issue.recommendedActionSummary,
    implementationSteps: issue.implementationSteps,
    recommendedControls
  });
  const suggestedPatchSnippet = buildRecommendedCodeDnaSnippet(
    issue.title,
    evidenceItems,
    issue.recommendedActionSummary,
    issue.implementationSteps,
    recommendedControls
  );

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
    evidenceRefs: evidenceItems,
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
    publishedIssueBodyMarkdown,
    whyItMatters: issue.whyItMatters ?? primaryFinding?.whyItMatters ?? undefined,
    suggestedPatchCode: suggestedPatchSnippet || suggestedPatchCode,
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
  const projectedIssueCandidates = snapshot.issueCandidates.map((issue) =>
    projectIssueCandidateToConsoleFinding(snapshot, issue)
  );
  const projectedRuntimeFindings =
    projectedIssueCandidates.length === 0
      ? snapshot.findings.map((finding) => projectRuntimeFindingToConsoleFinding(snapshot, finding))
      : [];
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
    findings: projectedIssueCandidates.length > 0 ? projectedIssueCandidates : projectedRuntimeFindings,
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
    findingCount?: number;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    reviewableIssueCount: number;
    rejectedIssueCount: number;
  },
  projectName: string
) {
  const hasSeverityCounts =
    typeof item.criticalCount === 'number' ||
    typeof item.highCount === 'number' ||
    typeof item.mediumCount === 'number' ||
    typeof item.lowCount === 'number';
  const criticalCount = item.criticalCount ?? 0;
  const highCount = item.highCount ?? 0;
  const mediumCount = item.mediumCount ?? 0;
  const lowCount = item.lowCount ?? 0;
  const findingCount =
    typeof item.findingCount === 'number'
      ? item.findingCount
      : criticalCount + highCount + mediumCount + lowCount;
  const score = hasSeverityCounts
    ? scoreFromSeverityCounts({
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      })
    : scoreFromReviewQueueCounts(item.reviewableIssueCount, item.rejectedIssueCount);

  return {
    id: item.auditRunId,
    projectId: item.projectId,
    projectName,
    score,
    status: runStatusToConsoleRunStatus(item.runStatus),
    date: item.createdAt,
    criticalCount,
    highCount: hasSeverityCounts ? highCount : item.reviewableIssueCount,
    mediumCount: hasSeverityCounts ? mediumCount : item.rejectedIssueCount,
    lowCount,
    reviewableCount: item.reviewableIssueCount,
    rejectedCount: item.rejectedIssueCount,
    findingCount,
    findings: [] as ConsoleFindingProjection[]
  };
}

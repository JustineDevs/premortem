import { prisma, resolveGitLabCredentialsForProject, listRecentAuditRunsForOrganization } from '@premortem/db';
import { isProductionMode, normalizeEvidenceRefs } from '@premortem/domain';
import { captureServerException } from '@premortem/observability/server';
import { enrichEvidenceWithSourceSnippets } from '../evidence/resolve-evidence-snippets';
import { getAuditRunDetails } from '@premortem/db';
import {
  resolveGraphSnapshotPayload,
  resolveStrictGraphSnapshotPayload
} from '../graph/resolve-graph-payload';

type IssueCandidateCountSource = Record<string, unknown> & {
  _count?: {
    versions?: number;
    validationResults?: number;
  };
};

function countIssueCandidateRelation(
  issue: IssueCandidateCountSource,
  relation: 'versions' | 'validationResults'
) {
  const counted = issue._count?.[relation];
  if (typeof counted === 'number') return counted;

  const value = issue[relation];
  return Array.isArray(value) ? value.length : 0;
}

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export interface AuditRunSnapshot {
  auditRunId: string;
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string | null;
  runStatus: string;
  errorMessage?: string | null;
  summary: unknown;
  graphSnapshot?: {
    id: string;
    nodeCount: number;
    edgeCount: number;
    metadata: unknown;
    storageRef?: string | null;
    payload?: unknown;
  } | null;
  counts: {
    agentRuns: number;
    findings: number;
    clusters: number;
    issueCandidates: number;
    rejectedIssueCandidateArtifacts: number;
    riskIntents: number;
    policyDecisions: number;
    fixVerifications: number;
    evalRuns: number;
    issueCandidateVersions: number;
    validationResults: number;
    events: number;
  };
  events: Array<{
    eventType: string;
    actor: string;
    createdAt: string;
  }>;
  agentRuns: Array<{
    id: string;
    agentName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  findings: Array<{
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
    evidence?: Array<{ kind: string; ref: string; reason: string; codeSnippet?: string }>;
  }>;
  clusters: Array<{
    id: string;
    categoryOwner: string;
    titleHint?: string | null;
    severity: string;
    findingCount: number;
    memberFindingIds?: string[];
  }>;
  issueCandidates: Array<{
    id: string;
    title: string;
    createdAt: string;
    category: string;
    validationStatus: string;
    reviewerStatus: string;
    versionCount: number;
    validationResultCount: number;
    publishedUrl?: string | null;
    publishedIssueBodyMarkdown?: string | null;
    priority?: string;
    confidence?: number;
    predictedFailureSummary?: string;
    whyItMatters?: string;
    triggerConditions?: string[];
    recommendedActionSummary?: string;
    implementationSteps?: string[];
    doneCriteria?: string[];
    affectedAssets?: string[];
    sourceAgents?: string[];
    clusterId?: string;
    sourceFindings?: string[];
    evidence?: Array<{ kind: string; ref: string; reason: string; codeSnippet?: string }>; 
  }>;
  rejectedIssueCandidates: Array<{
    id: string;
    title: string;
    category: string;
    validatorName?: string | null;
    validationErrorCount: number;
  }>;
  riskIntents: Array<{
    id: string;
    type: string;
    source: string;
    status: string;
    summary: string;
    confidence: number;
    expiresAt?: string | null;
    createdAt: string;
  }>;
  policyDecisions: Array<{
    id: string;
    outcome: string;
    rationale: string;
    score?: number | null;
    policyPackId?: string | null;
    issueCandidateId?: string | null;
    riskIntentId?: string | null;
    createdAt: string;
    details?: unknown;
  }>;
  fixVerifications: Array<{
    id: string;
    status: string;
    summary: string;
    sourceAuditRunId?: string | null;
    closingAuditRunId?: string | null;
    sourceGraphSnapshotId?: string | null;
    closingGraphSnapshotId?: string | null;
    publishedIssueId: string;
    issueCandidateId: string;
    createdAt: string;
    verifiedAt?: string | null;
    observedChanges?: unknown;
  }>;
  evalRuns: Array<{
    id: string;
    provider: string;
    status: string;
    name: string;
    summary?: string | null;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    metrics?: unknown;
  }>;
  lineage: Array<{
    stage: string;
    id: string;
    label: string;
    parentId?: string;
  }>;
}

export async function getAuditRunSnapshot(
  auditRunId: string,
  options?: {
    includeEvidenceSnippets?: boolean;
    includeGraphPayload?: boolean;
  }
): Promise<AuditRunSnapshot | null> {
  const includeEvidenceSnippets = options?.includeEvidenceSnippets ?? true;
  const includeGraphPayload = options?.includeGraphPayload ?? true;
  const auditRun = await getAuditRunDetails(auditRunId);
  if (!auditRun) return null;
  const auditRunCounts = (auditRun as {
    _count?: {
      agentRuns?: number;
      findings?: number;
      dedupeClusters?: number;
      issueCandidates?: number;
      rejectedIssueCandidateArtifacts?: number;
      riskIntents?: number;
      policyDecisions?: number;
      fixVerifications?: number;
      evalRuns?: number;
      events?: number;
    };
  })._count;
  const issueCandidatesSource = toArray(auditRun.issueCandidates);

  const issueCandidateVersions = issueCandidatesSource.reduce(
    (total, issue) => total + countIssueCandidateRelation(issue as IssueCandidateCountSource, 'versions'),
    0
  );
  const validationResults = issueCandidatesSource.reduce(
    (total, issue) =>
      total + countIssueCandidateRelation(issue as IssueCandidateCountSource, 'validationResults'),
    0
  );

  let graphPayload: unknown = null;
  if (includeGraphPayload && auditRun.graphSnapshot) {
    graphPayload = isProductionMode()
      ? await resolveStrictGraphSnapshotPayload({
          auditRunId: auditRun.id,
          projectId: auditRun.projectId,
          metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
          storageRef: auditRun.graphSnapshot.storageRef
        })
      : await resolveGraphSnapshotPayload({
          auditRunId: auditRun.id,
          projectId: auditRun.projectId,
          metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
          storageRef: auditRun.graphSnapshot.storageRef
        });
  }

  const project = includeEvidenceSnippets
    ? await prisma.project.findUnique({
        where: { id: auditRun.projectId },
        select: { provider: true, externalProjectId: true }
      })
    : null;
  let gitlabCredentials = null;
  if (includeEvidenceSnippets && project) {
    try {
      gitlabCredentials = await resolveGitLabCredentialsForProject(auditRun.projectId);
    } catch (error) {
      captureServerException(error, {
        auditRunId: auditRun.id,
        stage: 'read-model-gitlab-credentials'
      });
    }
  }
  const canResolveSource =
    includeEvidenceSnippets &&
    project?.provider === 'gitlab' &&
    Boolean(project.externalProjectId) &&
    Boolean(gitlabCredentials?.token);

  const sourceContext = canResolveSource
    ? {
        baseUrl: gitlabCredentials!.baseUrl,
        token: gitlabCredentials!.token,
        externalProjectId: project!.externalProjectId!,
        branch: auditRun.branch
      }
    : null;

  const agentRunsSource = toArray(auditRun.agentRuns);
  const findingsSource = toArray(auditRun.findings);
  const clustersSource = toArray(auditRun.dedupeClusters);
  const rejectedArtifactsSource = toArray(auditRun.rejectedIssueCandidateArtifacts);
  const riskIntentsSource = toArray((auditRun as { riskIntents?: Array<Record<string, unknown>> }).riskIntents);
  const policyDecisionsSource = toArray((auditRun as { policyDecisions?: Array<Record<string, unknown>> }).policyDecisions);
  const fixVerificationsSource = toArray((auditRun as { fixVerifications?: Array<Record<string, unknown>> }).fixVerifications);
  const evalRunsSource = toArray((auditRun as { evalRuns?: Array<Record<string, unknown>> }).evalRuns);
  const eventsSource = toArray(auditRun.events).slice().sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime()
  );

  const findings = [] as AuditRunSnapshot['findings'];
  for (const finding of findingsSource) {
    const triggerConditions = Array.isArray(finding.triggerConditions)
      ? finding.triggerConditions.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const affectedAssets = Array.isArray(finding.affectedAssets)
      ? finding.affectedAssets.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const recommendedControls = Array.isArray(finding.recommendedControls)
      ? finding.recommendedControls.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const evidence = sourceContext
      ? await enrichEvidenceWithSourceSnippets({
          evidence: finding.evidence,
          ...sourceContext
        })
      : normalizeEvidenceRefs(finding.evidence);

    findings.push({
      id: finding.id,
      findingKey: finding.findingKey,
      title: finding.predictedFailureSummary.slice(0, 120),
      category: finding.category,
      severity: finding.severity,
      predictedFailureSummary: finding.predictedFailureSummary,
      agentRunId: finding.agentRunId,
      confidence: Number(finding.confidence ?? 0),
      whyItMatters: finding.whyItMatters,
      failureMode: finding.failureMode,
      triggerConditions,
      affectedAssets,
      recommendedControls,
      evidence
    });
  }

  const issueCandidates = [] as AuditRunSnapshot['issueCandidates'];
  for (const issue of issueCandidatesSource) {
    const implementationSteps = Array.isArray(issue.implementationSteps)
      ? issue.implementationSteps.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const doneCriteria = Array.isArray(issue.doneCriteria)
      ? issue.doneCriteria.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const triggerConditions = Array.isArray(issue.triggerConditions)
      ? issue.triggerConditions.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const affectedAssets = Array.isArray(issue.affectedAssets)
      ? issue.affectedAssets.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const sourceFindings = Array.isArray(issue.sourceFindings)
      ? issue.sourceFindings.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const sourceAgents = Array.isArray(issue.sourceAgents)
      ? issue.sourceAgents.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const evidence = sourceContext
      ? await enrichEvidenceWithSourceSnippets({
          evidence: issue.evidence,
          ...sourceContext
        })
      : normalizeEvidenceRefs(issue.evidence);

    issueCandidates.push({
      id: issue.id,
      title: issue.title,
      createdAt: issue.createdAt.toISOString(),
      category: issue.category,
      validationStatus: issue.validationStatus,
      reviewerStatus: issue.reviewerStatus,
      versionCount: countIssueCandidateRelation(issue as IssueCandidateCountSource, 'versions'),
      validationResultCount: countIssueCandidateRelation(
        issue as IssueCandidateCountSource,
        'validationResults'
      ),
      publishedUrl: issue.publishedIssue?.url ?? null,
      publishedIssueBodyMarkdown: issue.publishedIssue?.publishedBodyMd ?? null,
      priority: String(issue.priority ?? 'p3'),
      confidence: Number(issue.confidence ?? 0),
      predictedFailureSummary: issue.predictedFailureSummary,
      whyItMatters: issue.whyItMatters,
      triggerConditions,
      recommendedActionSummary: issue.recommendedActionSummary,
      implementationSteps,
      doneCriteria,
      affectedAssets,
      sourceAgents,
      sourceFindings,
      clusterId: issue.clusterId,
      evidence
    });
  }

  return {
    auditRunId: auditRun.id,
    organizationId: auditRun.organizationId,
    projectId: auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha,
    runStatus: auditRun.runStatus,
    errorMessage: auditRun.errorMessage,
    summary: auditRun.summary,
    graphSnapshot: auditRun.graphSnapshot
      ? {
          id: auditRun.graphSnapshot.id,
          nodeCount: auditRun.graphSnapshot.nodeCount,
          edgeCount: auditRun.graphSnapshot.edgeCount,
          metadata: auditRun.graphSnapshot.metadata,
          storageRef: auditRun.graphSnapshot.storageRef,
          payload: graphPayload
      }
      : null,
    counts: {
      agentRuns: auditRunCounts?.agentRuns ?? agentRunsSource.length,
      findings: auditRunCounts?.findings ?? findingsSource.length,
      clusters: auditRunCounts?.dedupeClusters ?? clustersSource.length,
      issueCandidates: auditRunCounts?.issueCandidates ?? issueCandidatesSource.length,
      rejectedIssueCandidateArtifacts:
        auditRunCounts?.rejectedIssueCandidateArtifacts ?? rejectedArtifactsSource.length,
      riskIntents: auditRunCounts?.riskIntents ?? riskIntentsSource.length,
      policyDecisions: auditRunCounts?.policyDecisions ?? policyDecisionsSource.length,
      fixVerifications: auditRunCounts?.fixVerifications ?? fixVerificationsSource.length,
      evalRuns: auditRunCounts?.evalRuns ?? evalRunsSource.length,
      issueCandidateVersions,
      validationResults,
      events: auditRunCounts?.events ?? eventsSource.length
    },
    events: eventsSource.map((event) => ({
      eventType: event.eventType,
      actor: event.actor,
      createdAt: event.createdAt.toISOString()
    })),
    agentRuns: agentRunsSource.map((run) => ({
      id: run.id,
      agentName: run.agentName,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null
    })),
    findings,
    clusters: clustersSource.map((cluster) => {
      const members = toArray(cluster.members);
      return {
        id: cluster.id,
        categoryOwner: cluster.categoryOwner,
        titleHint: cluster.titleHint,
        severity: cluster.severity,
        findingCount: members.length,
        memberFindingIds: members.map((member) => member.findingId)
      };
    }),
    issueCandidates,
    rejectedIssueCandidates: rejectedArtifactsSource.map((issue) => ({
      id: issue.id,
      title: issue.title,
      category: issue.category,
      validatorName: issue.validatorName,
      validationErrorCount: Array.isArray(issue.validationErrors) ? issue.validationErrors.length : 0
    })),
    riskIntents: riskIntentsSource.map((intent) => ({
      id: String(intent.id),
      type: String(intent.type),
      source: String(intent.source),
      status: String(intent.status ?? 'active'),
      summary: String(intent.summary ?? ''),
      confidence: Number(intent.confidence ?? 0),
      expiresAt: intent.expiresAt ? new Date(String(intent.expiresAt)).toISOString() : null,
      createdAt: new Date(String(intent.createdAt ?? Date.now())).toISOString()
    })),
    policyDecisions: policyDecisionsSource.map((decision) => ({
      id: String(decision.id),
      outcome: String(decision.outcome ?? 'show_now'),
      rationale: String(decision.rationale ?? ''),
      score:
        typeof decision.score === 'number'
          ? decision.score
          : typeof decision.score === 'string'
            ? Number(decision.score)
            : null,
      policyPackId: decision.policyPackId ? String(decision.policyPackId) : null,
      issueCandidateId: decision.issueCandidateId ? String(decision.issueCandidateId) : null,
      riskIntentId: decision.riskIntentId ? String(decision.riskIntentId) : null,
      createdAt: new Date(String(decision.createdAt ?? Date.now())).toISOString(),
      details: decision.details
    })),
    fixVerifications: fixVerificationsSource.map((verification) => ({
      id: String(verification.id),
      status: String(verification.status ?? 'stale'),
      summary: String(verification.summary ?? ''),
      sourceAuditRunId: verification.sourceAuditRunId ? String(verification.sourceAuditRunId) : null,
      closingAuditRunId: verification.closingAuditRunId ? String(verification.closingAuditRunId) : null,
      sourceGraphSnapshotId: verification.sourceGraphSnapshotId ? String(verification.sourceGraphSnapshotId) : null,
      closingGraphSnapshotId: verification.closingGraphSnapshotId ? String(verification.closingGraphSnapshotId) : null,
      publishedIssueId: String(verification.publishedIssueId),
      issueCandidateId: String(verification.issueCandidateId),
      createdAt: new Date(String(verification.createdAt ?? Date.now())).toISOString(),
      verifiedAt: verification.verifiedAt ? new Date(String(verification.verifiedAt)).toISOString() : null,
      observedChanges: verification.observedChanges
    })),
    evalRuns: evalRunsSource.map((run) => ({
      id: String(run.id),
      provider: String(run.provider ?? 'promptfoo'),
      status: String(run.status ?? 'completed'),
      name: String(run.name ?? ''),
      summary: run.summary ? String(run.summary) : null,
      createdAt: new Date(String(run.createdAt ?? Date.now())).toISOString(),
      startedAt: run.startedAt ? new Date(String(run.startedAt)).toISOString() : null,
      completedAt: run.completedAt ? new Date(String(run.completedAt)).toISOString() : null,
      metrics: run.metrics
    })),
    lineage: [
      ...agentRunsSource.map((run) => ({
        stage: 'agent_run',
        id: run.id,
        label: run.agentName,
        parentId: auditRun.id
      })),
      ...findingsSource.map((finding) => ({
        stage: 'finding',
        id: finding.id,
        label: finding.category,
        parentId: finding.agentRunId
      })),
      ...clustersSource.map((cluster) => ({
        stage: 'cluster',
        id: cluster.id,
        label: cluster.categoryOwner,
        parentId: auditRun.id
      })),
      ...issueCandidatesSource.map((issue) => ({
        stage: 'issue_candidate',
        id: issue.id,
        label: issue.title,
        parentId: issue.clusterId
      })),
      ...riskIntentsSource.map((intent) => ({
        stage: 'risk_intent',
        id: String(intent.id),
        label: `${String(intent.type)}:${String(intent.summary ?? '').slice(0, 60)}`,
        parentId: intent.auditRunId ? String(intent.auditRunId) : auditRun.id
      })),
      ...policyDecisionsSource.map((decision) => ({
        stage: 'policy_decision',
        id: String(decision.id),
        label: String(decision.outcome ?? 'show_now'),
        parentId: decision.issueCandidateId ? String(decision.issueCandidateId) : auditRun.id
      })),
      ...fixVerificationsSource.map((verification) => ({
        stage: 'fix_verification',
        id: String(verification.id),
        label: String(verification.status ?? 'stale'),
        parentId: String(verification.publishedIssueId)
      })),
      ...evalRunsSource.map((run) => ({
        stage: 'eval_run',
        id: String(run.id),
        label: String(run.name ?? run.provider ?? 'eval'),
        parentId: run.auditRunId ? String(run.auditRunId) : auditRun.id
      }))
    ]
  };
}

export { resolveGraphSnapshotPayload };

export interface AuditRunListItem {
  id: string;
  auditRunId: string;
  projectId: string;
  projectName: string;
  branch: string;
  commitSha?: string | null;
  runStatus: string;
  createdAt: string;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reviewableIssueCount: number;
  rejectedIssueCount: number;
  latestEventType?: string;
}

function countSeverityRows(findings: Array<{ severity?: string }>) {
  const counts = findings.reduce(
    (counts, finding) => {
      const severity = String(finding.severity ?? '').toLowerCase();
      if (severity === 'critical') counts.critical += 1;
      else if (severity === 'high') counts.high += 1;
      else if (severity === 'medium') counts.medium += 1;
      else if (severity === 'low') counts.low += 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
  return {
    criticalCount: counts.critical,
    highCount: counts.high,
    mediumCount: counts.medium,
    lowCount: counts.low
  };
}

export async function getRecentAuditRuns(
  organizationId: string,
  limit = 12
): Promise<AuditRunListItem[]> {
  const auditRuns = await listRecentAuditRunsForOrganization(organizationId, limit);
  return auditRuns.map((auditRun) => ({
    id: auditRun.id,
    auditRunId: auditRun.id,
    projectId: auditRun.projectId,
    projectName: auditRun.project?.name ?? auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha,
    runStatus: auditRun.runStatus,
    createdAt: auditRun.createdAt.toISOString(),
    findingCount: Array.isArray((auditRun as { findings?: Array<{ severity?: string }> }).findings)
      ? (auditRun as { findings: Array<{ severity?: string }> }).findings.length
      : 0,
    ...countSeverityRows(
      Array.isArray((auditRun as { findings?: Array<{ severity?: string }> }).findings)
        ? (auditRun as { findings: Array<{ severity?: string }> }).findings
        : []
    ),
    reviewableIssueCount: auditRun._count.issueCandidates,
    rejectedIssueCount: auditRun._count.rejectedIssueCandidateArtifacts,
    latestEventType: auditRun.events[0]?.eventType
  }));
}

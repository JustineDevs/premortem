import {
  completeAgentRun,
  createAgentRun,
  createAuditRun,
  createAuditRunEvent,
  createDedupeClusters,
  failAgentRun,
  getAuditRunDetails,
  listRecentAuditRuns,
  markAuditFailed,
  markAuditCompleted,
  markAuditRunning,
  persistFindings,
  persistIssueCandidates,
  persistRejectedIssueCandidateArtifacts
} from '@premortem/db';
import type { CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import type { RuntimeCluster } from '../merge/cluster-findings';

export async function createQueuedAudit(input: {
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
}) {
  return createAuditRun(input);
}

export async function beginAudit(auditRunId: string) {
  await markAuditRunning(auditRunId);
  await createAuditRunEvent({
    auditRunId,
    eventType: 'audit.started'
  });
}

export async function runAgentWithPersistence<T>(input: {
  auditRunId: string;
  agentName: string;
  runMode: 'always' | 'conditional';
  execute: () => Promise<T>;
  serialize?: (result: T) => Record<string, unknown>;
}) {
  const agentRun = await createAgentRun({ auditRunId: input.auditRunId, agentName: input.agentName, runMode: input.runMode });

  try {
    const result = await input.execute();
    await completeAgentRun(agentRun.id, input.serialize?.(result) as never);
    return { agentRun, result };
  } catch (error) {
    await failAgentRun(agentRun.id, error instanceof Error ? error.message : 'Unknown agent error');
    throw error;
  }
}

export async function saveFindings(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  agentRunId: string;
  findings: CanonicalFinding[];
}) {
  return persistFindings({
    organizationId: input.organizationId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
    agentRunId: input.agentRunId,
    findings: input.findings.map((finding) => ({
      findingKey: finding.finding_id,
      category: finding.category,
      findingType: finding.finding_type,
      severity: finding.severity,
      confidence: finding.confidence,
      predictedFailureSummary: finding.predicted_failure.summary,
      failureMode: finding.predicted_failure.failure_mode,
      whyItMatters: finding.why_it_matters,
      blastRadius: finding.predicted_failure.blast_radius,
      triggerConditions: finding.predicted_failure.trigger_conditions,
      affectedAssets: finding.affected_assets,
      evidence: finding.evidence,
      recommendedControls: finding.recommended_controls,
      dedupeKeys: finding.dedupe_keys,
      tags: finding.tags
    }))
  });
}

export async function saveClusters(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  clusters: RuntimeCluster[];
  findingIdMap: Map<string, string>;
}) {
  return createDedupeClusters({
    organizationId: input.organizationId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
    clusters: input.clusters.map((cluster) => ({
      clusterKey: cluster.clusterKey,
      categoryOwner: cluster.categoryOwner,
      titleHint: cluster.titleHint,
      severity: cluster.severity,
      confidence: cluster.confidence,
      blastRadius: cluster.blastRadius,
      assetScope: cluster.assetScope,
      triggerSignature: cluster.triggerSignature,
      findings: cluster.sourceFindingIds.map((findingId) => ({
        findingId: input.findingIdMap.get(findingId) ?? findingId,
        role: 'supporting',
        similarityScore: 0.8
      }))
    }))
  });
}

export async function saveIssueCandidates(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  clusterIdByCategory: Map<string, string>;
  issues: Array<{
    issue: IssueCandidate;
    validationErrors: string[];
    validationWarnings: string[];
    validatorName: string;
  }>;
}) {
  return persistIssueCandidates({
    organizationId: input.organizationId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
    issues: input.issues.map(({ issue, validationErrors, validationWarnings, validatorName }) => {
      const clusterId = input.clusterIdByCategory.get(issue.category);
      if (!clusterId) {
        throw new Error(`Missing cluster for issue candidate category: ${issue.category}`);
      }

      return {
        clusterId,
        title: issue.title,
        category: issue.category,
        severity: issue.severity,
        confidence: issue.confidence,
        predictedFailureSummary: issue.predicted_failure_summary,
        whyItMatters: issue.why_it_matters,
        triggerConditions: issue.trigger_conditions,
        evidence: issue.evidence,
        recommendedActionSummary: issue.recommended_action_summary,
        implementationSteps: issue.implementation_steps,
        doneCriteria: issue.done_criteria,
        affectedAssets: issue.affected_assets,
        sourceAgents: issue.source_agents,
        sourceFindings: issue.source_findings,
        validationStatus: validationErrors.length === 0 ? 'passed' : 'failed',
        validationErrors,
        validationWarnings,
        validatorName
      };
    })
  });
}

export async function saveRejectedIssueArtifacts(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  clusterIdByCategory: Map<string, string>;
  issues: Array<{
    issue: IssueCandidate;
    validationErrors: string[];
    validationWarnings: string[];
    validatorName: string;
  }>;
}) {
  return persistRejectedIssueCandidateArtifacts({
    organizationId: input.organizationId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
    issues: input.issues.map(({ issue, validationErrors, validationWarnings, validatorName }) => ({
      clusterId: input.clusterIdByCategory.get(issue.category),
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      confidence: issue.confidence,
      predictedFailureSummary: issue.predicted_failure_summary,
      whyItMatters: issue.why_it_matters,
      triggerConditions: issue.trigger_conditions,
      evidence: issue.evidence,
      recommendedActionSummary: issue.recommended_action_summary,
      implementationSteps: issue.implementation_steps,
      doneCriteria: issue.done_criteria,
      affectedAssets: issue.affected_assets,
      sourceAgents: issue.source_agents,
      sourceFindings: issue.source_findings,
      validationErrors,
      validationWarnings,
      validatorName
    }))
  });
}

export async function finishAudit(auditRunId: string, summary: Record<string, unknown>) {
  await markAuditCompleted(auditRunId, summary as never);
  await createAuditRunEvent({
    auditRunId,
    eventType: 'audit.completed',
    payload: summary
  });
}

export async function failAudit(auditRunId: string, errorMessage: string) {
  await markAuditFailed(auditRunId, errorMessage);
  await createAuditRunEvent({
    auditRunId,
    eventType: 'audit.failed',
    payload: { errorMessage }
  });
}

export async function recordAuditEvent(
  auditRunId: string,
  eventType: string,
  payload?: Record<string, unknown>
) {
  return createAuditRunEvent({
    auditRunId,
    eventType,
    payload
  });
}

export async function getPersistedAuditRun(auditRunId: string) {
  return getAuditRunDetails(auditRunId);
}

export async function listAuditRuns(limit = 12) {
  return listRecentAuditRuns(limit);
}

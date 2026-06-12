import { AuditEvent } from '@premortem/domain';
import {
  completeAgentRun,
  createAgentRun,
  createAuditRun,
  createAuditRunEvent,
  createDedupeClusters,
  failAgentRun,
  getAuditRunDetails,
  listRecentAuditRuns,
  listRecentAuditRunsForOrganization,
  markAuditFailed,
  markAuditCompleted,
  markAuditRunning,
  markAuditPaused,
  persistFindings,
  persistGraphSnapshot,
  persistIssueCandidates,
  persistRejectedIssueCandidateArtifacts
} from '@premortem/db';
import { createOrganizationNotifications } from '@premortem/db';
import type { CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import type { RuntimeCluster } from '../merge/cluster-findings';

export async function createQueuedAudit(input: {
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
  triggerSource?: 'manual' | 'webhook' | 'scheduled' | 'api';
}) {
  return createAuditRun(input);
}

export async function beginAudit(auditRunId: string) {
  await markAuditRunning(auditRunId);
  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.STARTED
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
        role: findingId === cluster.primaryFindingId ? 'primary' : 'supporting',
        similarityScore: findingId === cluster.primaryFindingId ? 1 : 0.8
      }))
    }))
  });
}

export async function saveIssueCandidates(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  clusterIdByCategory: Map<string, string>;
  clusterIdByFindingId?: Map<string, string>;
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
      const clusterId =
        input.clusterIdByCategory.get(issue.category) ??
        issue.source_findings
          .map((findingId) => input.clusterIdByFindingId?.get(findingId))
          .find((value): value is string => Boolean(value));
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
  clusterIdByFindingId?: Map<string, string>;
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
      clusterId:
        input.clusterIdByCategory.get(issue.category) ??
        issue.source_findings
          .map((findingId) => input.clusterIdByFindingId?.get(findingId))
          .find((value): value is string => Boolean(value)),
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

export async function saveGraphSnapshot(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  nodeCount: number;
  edgeCount: number;
  metadata?: Record<string, unknown>;
  storageRef?: string;
}) {
  return persistGraphSnapshot(input);
}

export async function finishAudit(auditRunId: string, summary: Record<string, unknown>) {
  await markAuditCompleted(auditRunId, summary as never);
  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.COMPLETED,
    payload: summary
  });
}

export async function finishAuditWithNotifications(input: {
  auditRunId: string;
  organizationId: string;
  projectId: string;
  projectName?: string | null;
  branch: string;
  summary: Record<string, unknown>;
}) {
  await finishAudit(input.auditRunId, input.summary);
  const findingCount = Number(input.summary.findingCount ?? 0);
  const issueCandidateCount = Number(input.summary.issueCandidateCount ?? 0);

  try {
    await createOrganizationNotifications({
      organizationId: input.organizationId,
      projectId: input.projectId,
      kind: 'audit_completed',
      title: `Audit completed for ${input.projectName ?? input.projectId}`,
      body: `Branch ${input.branch} finished scanning and produced ${findingCount} findings.`,
      metadata: {
        auditRunId: input.auditRunId,
        branch: input.branch,
        summary: input.summary
      }
    });

    if (issueCandidateCount > 0) {
      await createOrganizationNotifications({
        organizationId: input.organizationId,
        projectId: input.projectId,
        kind: 'issues_ready',
        title: `Review ${issueCandidateCount} issue candidates for ${input.projectName ?? input.projectId}`,
        body: `Audit results are ready for review on branch ${input.branch}.`,
        metadata: {
          auditRunId: input.auditRunId,
          branch: input.branch,
          issueCandidateCount,
          summary: input.summary
        }
      });
    }
  } catch (error) {
    console.warn(
      '[audit-persistence] notification fanout failed:',
      error instanceof Error ? error.message : error
    );
  }
}

export async function failAudit(auditRunId: string, errorMessage: string) {
  await markAuditFailed(auditRunId, errorMessage);
  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.FAILED,
    payload: { errorMessage }
  });
}

export async function failAuditWithNotifications(input: {
  auditRunId: string;
  organizationId: string;
  projectId: string;
  projectName?: string | null;
  branch: string;
  errorMessage: string;
}) {
  await failAudit(input.auditRunId, input.errorMessage);
  try {
    await createOrganizationNotifications({
      organizationId: input.organizationId,
      projectId: input.projectId,
      kind: 'audit_failed',
      title: `Audit failed for ${input.projectName ?? input.projectId}`,
      body: `Branch ${input.branch} stopped with error: ${input.errorMessage}`,
      metadata: {
        auditRunId: input.auditRunId,
        branch: input.branch,
        errorMessage: input.errorMessage
      }
    });
  } catch (error) {
    console.warn(
      '[audit-persistence] failure notification fanout failed:',
      error instanceof Error ? error.message : error
    );
  }
}

export async function pauseAudit(auditRunId: string, summary: Record<string, unknown>) {
  await markAuditPaused(auditRunId, summary as never);
  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.PAUSED,
    payload: summary
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

export async function listAuditRuns(organizationId: string, limit = 12) {
  return listRecentAuditRunsForOrganization(organizationId, limit);
}

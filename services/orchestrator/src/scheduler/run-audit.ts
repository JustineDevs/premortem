import {
  validateFinding,
  validateIssueCandidate,
  type RegisteredAgent
} from '@premortem/agent-kit';
import type { CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import { buildAuditJob, type AuditJob } from '@premortem/workflow';
import { clusterFindings } from '../merge/cluster-findings';
import {
  beginAudit,
  createQueuedAudit,
  failAudit,
  finishAudit,
  getPersistedAuditRun,
  listAuditRuns,
  recordAuditEvent,
  runAgentWithPersistence,
  saveClusters,
  saveFindings,
  saveIssueCandidates,
  saveRejectedIssueArtifacts
} from '../services/audit-persistence';

export interface SubmitAuditInput {
  rootDir?: string;
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
}

export interface ExecuteAuditJobInput {
  rootDir?: string;
  job: AuditJob;
  registryAgents?: RegisteredAgent[];
}

export interface SubmittedAuditResult {
  auditRunId: string;
  runStatus: 'queued';
  idempotencyKey: string;
  job: AuditJob;
}

export interface AuditExecutionResult {
  auditRunId: string;
  runStatus: 'completed' | 'failed';
  findingsCount: number;
  clusterCount: number;
  issueCandidateCount: number;
  rejectedIssueCount: number;
}

export interface AuditRunListItem {
  auditRunId: string;
  projectId: string;
  branch: string;
  commitSha?: string | null;
  runStatus: string;
  createdAt: string;
  reviewableIssueCount: number;
  rejectedIssueCount: number;
  latestEventType?: string;
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
  counts: {
    agentRuns: number;
    findings: number;
    clusters: number;
    issueCandidates: number;
    rejectedIssueCandidateArtifacts: number;
    issueCandidateVersions: number;
    validationResults: number;
    events: number;
  };
  events: Array<{
    eventType: string;
    actor: string;
    createdAt: string;
  }>;
  issueCandidates: Array<{
    id: string;
    title: string;
    validationStatus: string;
    reviewerStatus: string;
    versionCount: number;
    validationResultCount: number;
  }>;
  rejectedIssueCandidates: Array<{
    id: string;
    title: string;
    category: string;
    validatorName: string;
    validationErrorCount: number;
  }>;
}

interface IssueValidationDecision {
  issue: IssueCandidate;
  errors: string[];
  warnings: string[];
  validatorName: string;
}

async function loadRegistryAgents(rootDir: string): Promise<RegisteredAgent[]> {
  const { buildRegisteredAgents } = await import('../registry/build-registered-agents');
  return buildRegisteredAgents(rootDir);
}

export async function submitAudit(input: SubmitAuditInput): Promise<SubmittedAuditResult> {
  const auditRun = await createQueuedAudit({
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha,
    triggeredById: input.triggeredById
  });

  const job = buildAuditJob({
    auditRunId: auditRun.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha
  });

  await recordAuditEvent(auditRun.id, 'audit.enqueued', {
    idempotencyKey: job.idempotencyKey,
    attempt: job.attempt,
    branch: job.branch,
    commitSha: job.commitSha ?? null
  });

  return {
    auditRunId: auditRun.id,
    runStatus: 'queued',
    idempotencyKey: job.idempotencyKey,
    job
  };
}

export async function executeAuditJob(input: ExecuteAuditJobInput): Promise<AuditExecutionResult> {
  const rootDir = input.rootDir ?? process.env.PREMORTEM_ROOT_DIR ?? process.cwd();
  const agents = input.registryAgents ?? (await loadRegistryAgents(rootDir));

  const specialists = agents.filter((agent) => agent.executor.kind === 'specialist');
  const synthesizer = agents.find((agent) => agent.name === 'finding_synthesizer_agent');
  if (!synthesizer || synthesizer.executor.kind !== 'synthesizer') {
    throw new Error('Missing finding_synthesizer_agent executor');
  }

  const findings: CanonicalFinding[] = [];
  const findingIdMap = new Map<string, string>();

  try {
    await beginAudit(input.job.id);

    for (const specialist of specialists) {
      const { agentRun, result } = await runAgentWithPersistence({
        auditRunId: input.job.id,
        agentName: specialist.name,
        runMode: specialist.runMode,
        execute: () => specialist.executor.kind === 'specialist'
          ? specialist.executor.run({
              rootDir,
              projectId: input.job.projectId,
              auditRunId: input.job.id,
              payload: {
                projectId: input.job.projectId,
                branch: input.job.branch,
                commitSha: input.job.commitSha,
                attempt: input.job.attempt
              }
            })
          : Promise.resolve([]),
        serialize: (value) => ({
          findingCount: value.length,
          promptPath: specialist.promptPath
        })
      });

      const validFindings = result.filter((finding) => validateFinding(finding).length === 0);
      if (validFindings.length === 0) continue;

      const persisted = await saveFindings({
        organizationId: input.job.organizationId,
        projectId: input.job.projectId,
        auditRunId: input.job.id,
        agentRunId: agentRun.id,
        findings: validFindings
      });

      persisted.forEach((record, index) => findingIdMap.set(validFindings[index]!.finding_id, record.id));
      findings.push(...validFindings);
    }

    const runtimeClusters = clusterFindings(findings);
    const persistedClusters = await saveClusters({
      organizationId: input.job.organizationId,
      projectId: input.job.projectId,
      auditRunId: input.job.id,
      clusters: runtimeClusters,
      findingIdMap
    });
    const clusterIdByCategory = new Map(persistedClusters.map((cluster) => [cluster.categoryOwner, cluster.id]));

    const { result: rawIssues } = await runAgentWithPersistence({
      auditRunId: input.job.id,
      agentName: synthesizer.name,
      runMode: synthesizer.runMode,
      execute: () => synthesizer.executor.kind === 'synthesizer'
        ? synthesizer.executor.run(
            {
              rootDir,
              projectId: input.job.projectId,
              auditRunId: input.job.id,
              payload: {
                projectId: input.job.projectId,
                branch: input.job.branch,
                commitSha: input.job.commitSha,
                attempt: input.job.attempt
              }
            },
            findings
          )
        : Promise.resolve([]),
      serialize: (value) => ({
        issueCount: value.length,
        clusterCount: runtimeClusters.length
      })
    });

    const { result: validationDecisions } = await runAgentWithPersistence({
      auditRunId: input.job.id,
      agentName: 'issue_validator_agent',
      runMode: 'always',
      execute: async () =>
        rawIssues.map((issue) => ({
          issue,
          errors: validateIssueCandidate(issue),
          warnings: [] as string[],
          validatorName: 'issue_validator_agent'
        })),
      serialize: (value) => ({
        passedCount: value.filter((decision) => decision.errors.length === 0).length,
        failedCount: value.filter((decision) => decision.errors.length > 0).length
      })
    });

    const reviewableIssues = validationDecisions.filter((decision) => decision.errors.length === 0);
    const rejectedIssues = validationDecisions.filter((decision) => decision.errors.length > 0);

    if (rejectedIssues.length > 0) {
      await saveRejectedIssueArtifacts({
        organizationId: input.job.organizationId,
        projectId: input.job.projectId,
        auditRunId: input.job.id,
        clusterIdByCategory,
        issues: rejectedIssues.map((decision) => ({
          issue: decision.issue,
          validationErrors: decision.errors,
          validationWarnings: decision.warnings,
          validatorName: decision.validatorName
        }))
      });

      await recordAuditEvent(input.job.id, 'audit.issue_validation_rejected', {
        rejectedCount: rejectedIssues.length,
        titles: rejectedIssues.map((decision) => decision.issue.title)
      });
    }

    if (reviewableIssues.length > 0) {
      await saveIssueCandidates({
        organizationId: input.job.organizationId,
        projectId: input.job.projectId,
        auditRunId: input.job.id,
        clusterIdByCategory,
        issues: reviewableIssues.map((decision) => ({
          issue: decision.issue,
          validationErrors: decision.errors,
          validationWarnings: decision.warnings,
          validatorName: decision.validatorName
        }))
      });
    }

    await finishAudit(input.job.id, {
      findingCount: findings.length,
      clusterCount: persistedClusters.length,
      issueCandidateCount: reviewableIssues.length,
      rejectedIssueCount: rejectedIssues.length,
      registryAgentCount: agents.length
    });

    return {
      auditRunId: input.job.id,
      runStatus: 'completed',
      findingsCount: findings.length,
      clusterCount: persistedClusters.length,
      issueCandidateCount: reviewableIssues.length,
      rejectedIssueCount: rejectedIssues.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown audit execution error';
    await failAudit(input.job.id, message);
    return {
      auditRunId: input.job.id,
      runStatus: 'failed',
      findingsCount: findings.length,
      clusterCount: 0,
      issueCandidateCount: 0,
      rejectedIssueCount: 0
    };
  }
}

export async function getAuditRunSnapshot(auditRunId: string): Promise<AuditRunSnapshot | null> {
  const auditRun = await getPersistedAuditRun(auditRunId);
  if (!auditRun) return null;

  const issueCandidateVersions = auditRun.issueCandidates.reduce((total, issue) => total + issue.versions.length, 0);
  const validationResults = auditRun.issueCandidates.reduce((total, issue) => total + issue.validationResults.length, 0);

  return {
    auditRunId: auditRun.id,
    organizationId: auditRun.organizationId,
    projectId: auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha,
    runStatus: auditRun.runStatus,
    errorMessage: auditRun.errorMessage,
    summary: auditRun.summary,
      counts: {
        agentRuns: auditRun.agentRuns.length,
        findings: auditRun.findings.length,
        clusters: auditRun.dedupeClusters.length,
        issueCandidates: auditRun.issueCandidates.length,
        rejectedIssueCandidateArtifacts: auditRun.rejectedIssueCandidateArtifacts.length,
        issueCandidateVersions,
        validationResults,
        events: auditRun.events.length
      },
    events: auditRun.events.map((event) => ({
      eventType: event.eventType,
      actor: event.actor,
      createdAt: event.createdAt.toISOString()
    })),
      issueCandidates: auditRun.issueCandidates.map((issue) => ({
        id: issue.id,
        title: issue.title,
        validationStatus: issue.validationStatus,
        reviewerStatus: issue.reviewerStatus,
        versionCount: issue.versions.length,
        validationResultCount: issue.validationResults.length
      })),
      rejectedIssueCandidates: auditRun.rejectedIssueCandidateArtifacts.map((issue) => ({
        id: issue.id,
        title: issue.title,
        category: issue.category,
        validatorName: issue.validatorName,
        validationErrorCount: Array.isArray(issue.validationErrors) ? issue.validationErrors.length : 0
      }))
  };
}

export async function getRecentAuditRuns(limit = 12): Promise<AuditRunListItem[]> {
  const auditRuns = await listAuditRuns(limit);
  return auditRuns.map((auditRun) => ({
    auditRunId: auditRun.id,
    projectId: auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha,
    runStatus: auditRun.runStatus,
    createdAt: auditRun.createdAt.toISOString(),
    reviewableIssueCount: auditRun.issueCandidates.length,
    rejectedIssueCount: auditRun.rejectedIssueCandidateArtifacts.length,
    latestEventType: auditRun.events.at(-1)?.eventType
  }));
}

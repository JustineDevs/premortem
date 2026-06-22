/**
 * Orchestrates the end-to-end audit lifecycle: submit, execute, persist, and
 * snapshot the runtime state that powers the reviewer console.
 */
import { AuditEvent, AuditCheckpointPhase, DEFAULT_GEMINI_MODEL, RUNTIME_LANE_AGENTS, STRUCTURE_LANE_AGENTS } from '@premortem/domain';
import {
  assertCanRunAudit,
  assertAuditReadiness,
  extendAuditLease,
  findActiveAuditRun,
  prisma,
  recordAuditSubmitted,
  resolveGitLabCredentialsForProject,
  resumeAuditRun
} from '@premortem/db';
import {
  validateFinding,
  validateIssueCandidate,
  loadDedupePolicy,
  loadSeverityPolicy,
  downgradeSeverityForConfidence,
  type RegisteredAgent
} from '@premortem/agent-kit';
import type { CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import type { GraphSnapshotPayload } from '@premortem/graph-model';
import { buildAuditJob, type AuditJob } from '@premortem/workflow';
import {
  captureServerException,
  createLangfuseScore,
  isLangfuseConfigured,
  trackServerEvent,
} from '@premortem/observability';
import {
  ensurePremortemAuditJudgePrompt,
  isPhoenixPromptSyncEnabled
} from '@premortem/observability/phoenix-prompts';
import {
  appendAuditMissionToPhoenixDataset,
  ensurePremortemAuditDataset,
  isPhoenixDatasetSyncEnabled
} from '@premortem/observability/phoenix-datasets';
import {
  evaluateAuditMissionQuality,
  evaluateAuditMissionWithLlmJudge,
  isPhoenixLlmEvalEnabled,
  trace,
  tracePremortemAuditJob
} from '../telemetry/phoenix-lite';
import { isNeo4jGraphEnabled, writeGraphSnapshotToNeo4j } from '@premortem/integrations';
import { isProductionMode } from '@premortem/domain';
import { clusterFindings } from '../merge/cluster-findings';
import {
  beginAudit,
  createQueuedAudit,
  failAuditWithNotifications,
  finishAuditWithNotifications,
  getPersistedAuditRun,
  listAuditRuns,
  recordAuditEvent,
  runAgentWithPersistence,
  saveClusters,
  saveFindings,
  saveGraphSnapshot,
  saveIssueCandidates,
  saveRejectedIssueArtifacts
} from '../services/audit-persistence';
import { normalizePersistedEvidenceRefs } from '../evidence/persisted-evidence';
import { buildGraphFromIngestion } from '../graph/build-graph-snapshot';
import {
  buildGraphGroundingContext,
  summarizeGraphGrounding
} from '../graph/graph-grounding';
import {
  AUDIT_WORKFLOW_CONTRACT,
  DEFAULT_SPECIALIST_CONCURRENCY
} from './audit-workflow-contract';
import {
  resolveGraphSnapshotPayload,
  resolveStrictGraphSnapshotPayload
} from '../graph/resolve-graph-payload';
import { enrichEvidenceWithSourceSnippets } from '../evidence/resolve-evidence-snippets';
import { prepareAuditExecution } from './prepare-audit-context';
import {
  assertAuditContinuing,
  AuditExecutionHalted,
  isResumeExecution,
  parseAuditCheckpoint,
  persistPhaseCheckpoint,
  shouldSkipPhase
} from './audit-execution-control';

const SEVERITY_RANK: Record<CanonicalFinding['severity'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

interface AgentBuilderMissionTrace {
  engine: 'orchestrator-inline-trace';
  model: string;
  gitlabMcpEnabled: boolean;
  workflow: {
    goal: string;
    loopPolicy: typeof AUDIT_WORKFLOW_CONTRACT.loopPolicy;
    triage: typeof AUDIT_WORKFLOW_CONTRACT.triage;
    circuitBreakers: readonly string[];
  };
  analysisRoles: {
    auditor: string[];
    critic: string[];
    synthesizer: string[];
  };
  steps: Array<{ step: string; at: string; detail?: Record<string, unknown> }>;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function uniqueEvidence(values: CanonicalFinding['evidence']) {
  const merged: CanonicalFinding['evidence'] = [];
  for (const item of values) {
    const duplicate = merged.some(
      (existing) => existing.kind === item.kind && existing.ref === item.ref && existing.reason === item.reason
    );
    if (!duplicate) merged.push(item);
  }
  return merged;
}

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

function readEvidenceRefs(value: unknown): CanonicalFinding['evidence'] {
  return normalizePersistedEvidenceRefs(value);
}

function mergeFindingRecords(existing: CanonicalFinding, incoming: CanonicalFinding): CanonicalFinding {
  return {
    ...existing,
    severity:
      SEVERITY_RANK[incoming.severity] > SEVERITY_RANK[existing.severity]
        ? incoming.severity
        : existing.severity,
    confidence: Math.max(existing.confidence, incoming.confidence),
    predicted_failure: {
      summary:
        incoming.predicted_failure.summary.length > existing.predicted_failure.summary.length
          ? incoming.predicted_failure.summary
          : existing.predicted_failure.summary,
      failure_mode: existing.predicted_failure.failure_mode ?? incoming.predicted_failure.failure_mode,
      trigger_conditions: uniqueStrings([
        ...existing.predicted_failure.trigger_conditions,
        ...incoming.predicted_failure.trigger_conditions
      ]),
      blast_radius: existing.predicted_failure.blast_radius ?? incoming.predicted_failure.blast_radius
    },
    why_it_matters: existing.why_it_matters ?? incoming.why_it_matters,
    affected_assets: uniqueStrings([...existing.affected_assets, ...incoming.affected_assets]),
    evidence: uniqueEvidence([...existing.evidence, ...incoming.evidence]),
    recommended_controls: uniqueStrings([
      ...existing.recommended_controls,
      ...incoming.recommended_controls
    ]),
    dedupe_keys: uniqueStrings([...existing.dedupe_keys, ...incoming.dedupe_keys]),
    tags: uniqueStrings([...existing.tags, ...incoming.tags])
  };
}

function dedupeFindings(findings: CanonicalFinding[]) {
  const unique = new Map<string, CanonicalFinding>();

  for (const finding of findings) {
    const existing = unique.get(finding.finding_id);
    if (!existing) {
      unique.set(finding.finding_id, finding);
      continue;
    }

    unique.set(finding.finding_id, mergeFindingRecords(existing, finding));
  }

  return [...unique.values()];
}

async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Filter the active swarm to the subset enabled for the current project settings.
 *
 * @param agents - Registered agents in registry order.
 * @param enabledAgents - Project-level allowlist of specialist agent names.
 * @returns The filtered agent list, keeping always-on synthesis and validation agents.
 */
export function filterAgentsForProjectSettings(
  agents: RegisteredAgent[],
  enabledAgents: string[]
): RegisteredAgent[] {
  if (enabledAgents.length === 0) {
    return agents;
  }

  const allowlist = new Set(enabledAgents);
  return agents.filter((agent) => {
    if (agent.name === 'finding_synthesizer_agent' || agent.name === 'issue_validator_agent') {
      return true;
    }

    if (agent.executor.kind !== 'specialist') {
      return true;
    }

    return allowlist.has(agent.name);
  });
}

export interface SubmitAuditInput {
  /** Optional root directory used when the orchestrator is run from a local checkout. */
  rootDir?: string;
  /** Organization that owns the audit run. */
  organizationId: string;
  /** Project being scanned. */
  projectId: string;
  /** Branch to analyze. */
  branch: string;
  /** Optional commit SHA for traceability. */
  commitSha?: string;
  /** Actor that triggered the run, if known. */
  triggeredById?: string;
  /** Source of the trigger for telemetry and policy decisions. */
  triggerSource?: 'manual' | 'webhook' | 'scheduled' | 'api';
}

export interface ExecuteAuditJobInput {
  /** Optional root directory used when loading prompts and repo fixtures. */
  rootDir?: string;
  /** The persisted job payload to execute. */
  job: AuditJob;
  /** Optional prebuilt registry agents for test and worker injection. */
  registryAgents?: RegisteredAgent[];
}

export interface SubmittedAuditResult {
  /** Newly created or reused audit run identifier. */
  auditRunId: string;
  /** Queue state after submission. */
  runStatus: 'queued';
  /** Deterministic idempotency key used to deduplicate submissions. */
  idempotencyKey: string;
  /** Normalized audit job payload that was queued. */
  job: AuditJob;
  /** Present when the submission reused an already running audit. */
  reusedActiveRun?: boolean;
}

export interface AuditExecutionResult {
  /** Audit run identifier that completed or failed. */
  auditRunId: string;
  /** Terminal state after orchestration finishes. */
  runStatus: 'completed' | 'failed' | 'paused';
  /** Number of canonical findings persisted for the run. */
  findingsCount: number;
  /** Number of clusters produced from those findings. */
  clusterCount: number;
  /** Number of review-ready issue candidates created. */
  issueCandidateCount: number;
  /** Number of rejected or invalid issue candidates. */
  rejectedIssueCount: number;
}

export interface AuditRunListItem {
  /** Audit run identifier shown in list views. */
  auditRunId: string;
  /** Project associated with the audit run. */
  projectId: string;
  /** Display name of the project for UI rendering without a second lookup. */
  projectName: string;
  /** Branch analyzed by the audit run. */
  branch: string;
  /** Optional commit SHA for the audit run. */
  commitSha?: string | null;
  /** Current run state used by the console. */
  runStatus: string;
  /** Creation timestamp used for ordering. */
  createdAt: string;
  /** Number of issues ready for review. */
  reviewableIssueCount: number;
  /** Number of issue candidates rejected by validation. */
  rejectedIssueCount: number;
  /** Most recent event type attached to the run. */
  latestEventType?: string;
}

export interface AuditRunSnapshot {
  /** Audit run identifier for this snapshot. */
  auditRunId: string;
  /** Organization that owns the run. */
  organizationId: string;
  /** Project that was scanned. */
  projectId: string;
  /** Branch analyzed during the run. */
  branch: string;
  /** Optional commit SHA for the run. */
  commitSha?: string | null;
  /** Terminal or in-flight state of the run. */
  runStatus: string;
  /** Error message surfaced from a failed run, if any. */
  errorMessage?: string | null;
  /** Free-form summary emitted by the orchestrator for console rendering. */
  summary: unknown;
  /** Persisted graph snapshot metadata and payload for traceability views. */
  graphSnapshot?: {
    id: string;
    nodeCount: number;
    edgeCount: number;
    metadata: unknown;
    storageRef?: string | null;
    payload?: unknown;
  } | null;
  /** Aggregate counts used by dashboard badges and progress indicators. */
  counts: {
    /** Total agent run records for the audit. */
    agentRuns: number;
    /** Total canonical findings for the audit. */
    findings: number;
    /** Total clusters merged from the findings. */
    clusters: number;
    /** Total review-ready issue candidates. */
    issueCandidates: number;
    /** Total rejected issue candidate artifacts. */
    rejectedIssueCandidateArtifacts: number;
    /** Total saved issue candidate versions. */
    issueCandidateVersions: number;
    /** Total validation results recorded for the run. */
    validationResults: number;
    /** Total event records emitted during orchestration. */
    events: number;
  };
  /** Ordered event stream used for timeline rendering. */
  events: Array<{
    eventType: string;
    actor: string;
    createdAt: string;
  }>;
  /** Per-agent runtime records in execution order. */
  agentRuns: Array<{
    id: string;
    agentName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  /** Canonical findings stored for the run. */
  findings: Array<{
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
    evidence?: Array<{ kind: string; ref: string; reason: string; codeSnippet?: string }>;
  }>;
  /** Clustered groups of related findings. */
  clusters: Array<{
    id: string;
    categoryOwner: string;
    titleHint?: string | null;
    severity: string;
    findingCount: number;
    memberFindingIds?: string[];
  }>;
  /** Reviewable issue candidates and their synthesis metadata. */
  issueCandidates: Array<{
    id: string;
    title: string;
    category: string;
    validationStatus: string;
    reviewerStatus: string;
    versionCount: number;
    validationResultCount: number;
    publishedUrl?: string | null;
    predictedFailureSummary?: string;
    whyItMatters?: string;
    recommendedActionSummary?: string;
    implementationSteps?: string[];
    doneCriteria?: string[];
    affectedAssets?: string[];
    clusterId?: string;
    sourceFindings?: string[];
    evidence?: Array<{ kind: string; ref: string; reason: string; codeSnippet?: string }>;
  }>;
  /** Issue candidates that validation rejected. */
  rejectedIssueCandidates: Array<{
    id: string;
    title: string;
    category: string;
    validatorName: string;
    validationErrorCount: number;
  }>;
  /** Lineage map from raw findings through clustering and issue synthesis. */
  lineage: Array<{
    stage: string;
    id: string;
    label: string;
    parentId?: string;
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

async function loadGraphPayloadForResume(auditRunId: string) {
  const auditRun = await getPersistedAuditRun(auditRunId);
  if (!auditRun?.graphSnapshot) {
    throw new Error('Missing graph snapshot for resumed audit run');
  }

  const payload = isProductionMode()
    ? await resolveStrictGraphSnapshotPayload({
        auditRunId,
        projectId: auditRun.projectId,
        metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
        storageRef: auditRun.graphSnapshot.storageRef
      })
    : await resolveGraphSnapshotPayload({
        auditRunId,
        projectId: auditRun.projectId,
        metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
        storageRef: auditRun.graphSnapshot.storageRef
      });

  if (!payload) {
    throw new Error('Unable to load graph payload for resumed audit run');
  }

  return {
    graphPayload: payload,
    graphSnapshotId: auditRun.graphSnapshot.id,
    metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>
  };
}

async function loadPersistedFindingIdMap(auditRunId: string) {
  const rows = await prisma.finding.findMany({
    where: { auditRunId },
    select: { id: true, findingKey: true }
  });
  return new Map(rows.map((row) => [row.findingKey, row.id]));
}

async function loadFindingsForClustering(auditRunId: string): Promise<CanonicalFinding[]> {
  const rows = await prisma.finding.findMany({
    where: { auditRunId },
    orderBy: { createdAt: 'asc' },
    include: {
      agentRun: { select: { agentName: true } }
    }
  });

  return rows.map((row) => ({
    agent: row.agentRun.agentName,
    finding_id: row.findingKey,
    category: row.category,
    finding_type: row.findingType,
    severity: row.severity as CanonicalFinding['severity'],
    confidence: Number(row.confidence),
    predicted_failure: {
      summary: row.predictedFailureSummary,
      failure_mode: row.failureMode ?? row.predictedFailureSummary,
      blast_radius: row.blastRadius ?? undefined,
      trigger_conditions: Array.isArray(row.triggerConditions)
        ? (row.triggerConditions as string[])
        : []
    },
    why_it_matters: row.whyItMatters ?? row.predictedFailureSummary,
    affected_assets: Array.isArray(row.affectedAssets) ? (row.affectedAssets as string[]) : [],
    evidence: readEvidenceRefs(row.evidence),
    recommended_controls: Array.isArray(row.recommendedControls)
      ? (row.recommendedControls as string[])
      : [],
    dedupe_keys: Array.isArray(row.dedupeKeys) ? (row.dedupeKeys as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : []
  }));
}

export async function resumeAudit(auditRunId: string) {
  const auditRun = await resumeAuditRun(auditRunId);
  const job = buildAuditJob({
    auditRunId: auditRun.id,
    organizationId: auditRun.organizationId,
    projectId: auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha ?? undefined
  });

  return { auditRun, job };
}

export async function submitAudit(input: SubmitAuditInput): Promise<SubmittedAuditResult> {
  await assertCanRunAudit(input.organizationId);

  if (input.projectId) {
    await assertAuditReadiness({
      organizationId: input.organizationId,
      projectId: input.projectId
    });
  }

  const active = await findActiveAuditRun({
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch
  });

  if (active) {
    const job = buildAuditJob({
      auditRunId: active.id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      branch: input.branch,
      commitSha: input.commitSha
    });

    return {
      auditRunId: active.id,
      runStatus: 'queued',
      idempotencyKey: job.idempotencyKey,
      job,
      reusedActiveRun: true
    };
  }

  const auditRun = await createQueuedAudit({
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha,
    triggeredById: input.triggeredById,
    triggerSource: input.triggerSource
  });

  const job = buildAuditJob({
    auditRunId: auditRun.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha
  });

  await recordAuditEvent(auditRun.id, AuditEvent.ENQUEUED, {
    idempotencyKey: job.idempotencyKey,
    attempt: job.attempt,
    branch: job.branch,
    commitSha: job.commitSha ?? null
  });

  await recordAuditSubmitted(input.organizationId);

  return {
    auditRunId: auditRun.id,
    runStatus: 'queued',
    idempotencyKey: job.idempotencyKey,
    job
  };
}

const runExecuteAuditJob = tracePremortemAuditJob(
  async (jobInput: ExecuteAuditJobInput) => executeAuditJobCore(jobInput),
  { name: 'premortem.execute_audit_job' }
);

export async function executeAuditJob(input: ExecuteAuditJobInput): Promise<AuditExecutionResult> {
  return runExecuteAuditJob(input);
}

function tagActiveSpanWithAuditRun(auditRunId: string) {
  trace.getActiveSpan()?.setAttribute('premortem.audit_run_id', auditRunId);
}

function createAgentBuilderMissionTrace(input: {
  auditRunId: string;
  projectId: string;
  branch: string;
  ingestionSource: 'local' | 'gitlab';
  model: string;
  analysisRoles: AgentBuilderMissionTrace['analysisRoles'];
}): AgentBuilderMissionTrace {
  const traceSteps: AgentBuilderMissionTrace['steps'] = [
    {
      step: 'mission.start',
      at: new Date().toISOString(),
      detail: {
        auditRunId: input.auditRunId,
        projectId: input.projectId,
        branch: input.branch,
        ingestionSource: input.ingestionSource
      }
    }
  ];

  if (input.ingestionSource === 'gitlab') {
    traceSteps.push({
      step: 'agent_builder.root_agent.ready',
      at: new Date().toISOString(),
      detail: {
        gitlabMcpUrl: `${process.env.GITLAB_BASE_URL?.trim().replace(/\/$/, '') || 'https://gitlab.com'}/api/v4/mcp`,
        toolPrefix: 'premortem'
      }
    });
  } else {
    traceSteps.push({
      step: 'agent_builder.root_agent.local_mode',
      at: new Date().toISOString(),
      detail: {
        reason: 'gitlab credentials unavailable or local ingest forced'
      }
    });
  }

  traceSteps.push(
    {
      step: 'mission.ingest.delegated',
      at: new Date().toISOString(),
      detail: {
        orchestrator: '@premortem/orchestrator'
      }
    },
    {
      step: 'observability.phoenix',
      at: new Date().toISOString(),
      detail: {
        enabled: false,
        projectName: 'premortem',
        mcpBaseUrl: 'http://127.0.0.1:3210',
        mcpConfigured: false
      }
    }
  );

  return {
    engine: 'orchestrator-inline-trace',
    model: input.model,
    gitlabMcpEnabled: input.ingestionSource === 'gitlab',
    workflow: {
      goal: AUDIT_WORKFLOW_CONTRACT.goal,
      loopPolicy: AUDIT_WORKFLOW_CONTRACT.loopPolicy,
      triage: AUDIT_WORKFLOW_CONTRACT.triage,
      circuitBreakers: AUDIT_WORKFLOW_CONTRACT.circuitBreakers
    },
    analysisRoles: input.analysisRoles,
    steps: traceSteps
  };
}

async function executeAuditJobCore(input: ExecuteAuditJobInput): Promise<AuditExecutionResult> {
  tagActiveSpanWithAuditRun(input.job.id);
  const prepared = await prepareAuditExecution(input.job, { rootDir: input.rootDir });
  const { ingestion, rootDir } = prepared;
  const dedupePolicy = loadDedupePolicy(rootDir);
  const severityPolicy = loadSeverityPolicy(rootDir);
  const agents = filterAgentsForProjectSettings(
    input.registryAgents ?? prepared.agents,
    prepared.projectSettings.enabledAgents
  );
  const analysisRoles = agents.reduce<AgentBuilderMissionTrace['analysisRoles']>(
    (acc, agent) => {
      acc[agent.analysisRole].push(agent.name);
      return acc;
    },
    { auditor: [], critic: [], synthesizer: [] }
  );
  const agentBuilderMission = createAgentBuilderMissionTrace({
    auditRunId: input.job.id,
    projectId: input.job.projectId,
    branch: input.job.branch,
    ingestionSource: prepared.ingestionSource,
    model: prepared.llmConfig.model ?? DEFAULT_GEMINI_MODEL,
    analysisRoles
  });
  ingestion.metadata = {
    ...ingestion.metadata,
    agentBuilder: agentBuilderMission
  };

  const specialists = agents.filter((agent) => agent.executor.kind === 'specialist');
  const synthesizer = agents.find((agent) => agent.name === 'finding_synthesizer_agent');
  const validator = agents.find((agent) => agent.name === 'issue_validator_agent');
  if (!synthesizer || synthesizer.executor.kind !== 'synthesizer') {
    throw new Error('Missing finding_synthesizer_agent executor');
  }
  if (!validator) {
    throw new Error('Missing issue_validator_agent executor');
  }

  const findings: CanonicalFinding[] = [];
  let findingIdMap = new Map<string, string>();
  let graphPayload: GraphSnapshotPayload = { auditRunId: input.job.id, projectId: input.job.projectId, nodes: [], edges: [] };
  let graphSnapshotId: string | null = null;
  let clusterIdByFindingId = new Map<string, string>();

  try {
    const control = await assertAuditContinuing(input.job.id);
    const checkpoint = control.checkpoint ?? parseAuditCheckpoint(control.summary);
    const resume = isResumeExecution(checkpoint);

    if (resume) {
      await extendAuditLease(input.job.id);
      await prisma.auditRun.update({
        where: { id: input.job.id },
        data: { runStatus: 'running' }
      });
    } else {
      await beginAudit(input.job.id);
    }

    let skipGraph = shouldSkipPhase(checkpoint, AuditCheckpointPhase.GRAPH);

    if (skipGraph) {
      try {
        const loaded = await loadGraphPayloadForResume(input.job.id);
        graphPayload = loaded.graphPayload;
        graphSnapshotId = loaded.graphSnapshotId;
      } catch (graphLoadError) {
        captureServerException(graphLoadError, {
          auditRunId: input.job.id,
          stage: 'loadGraphPayloadForResume'
        });
        skipGraph = false;
      }
    }

    if (!skipGraph) {
      await assertAuditContinuing(input.job.id);

      await recordAuditEvent(input.job.id, AuditEvent.INGESTION_COMPLETED, {
        hasCi: ingestion.has_ci,
        appCount: ingestion.apps.length,
        serviceCount: ingestion.services.length,
        treeEntryCount: ingestion.repo_tree.length,
        source: prepared.ingestionSource
      });
      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.INGESTION, {
        findingCount: 0,
        clusterCount: 0
      });

      graphPayload = buildGraphFromIngestion({
        auditRunId: input.job.id,
        projectId: input.job.projectId,
        bundle: ingestion
      });

      let graphPersistedToNeo4j = false;

      if (isNeo4jGraphEnabled()) {
        try {
          await writeGraphSnapshotToNeo4j(graphPayload);
          graphPersistedToNeo4j = true;
        } catch (neo4jError) {
          captureServerException(neo4jError, { auditRunId: input.job.id, kind: 'graph-neo4j' });
          if (isProductionMode()) {
            throw new Error(
              `Neo4j graph persistence failed: ${neo4jError instanceof Error ? neo4jError.message : String(neo4jError)}. Start Docker Neo4j (pnpm run docker:up) and verify NEO4J_URI.`
            );
          }
        }
      } else if (isProductionMode()) {
        throw new Error(
          'Neo4j is required in production mode. Set NEO4J_URI and start docker compose neo4j, or unset PREMORTEM_PRODUCTION_MODE for local fallback.'
        );
      }

      const savedGraph = await saveGraphSnapshot({
        organizationId: input.job.organizationId,
        projectId: input.job.projectId,
        auditRunId: input.job.id,
        nodeCount: graphPayload.nodes.length,
        edgeCount: graphPayload.edges.length,
        metadata: {
          branch: ingestion.branch,
          commitSha: ingestion.commitSha ?? null,
          repoRoot: ingestion.repoRoot,
          hasCi: ingestion.has_ci,
          apps: ingestion.apps,
          services: ingestion.services,
          ingestionSource: prepared.ingestionSource,
          graphStore: graphPersistedToNeo4j ? 'neo4j' : 'inline',
          ...(graphPersistedToNeo4j ? {} : { inlinePayload: graphPayload })
        },
        storageRef: graphPersistedToNeo4j ? `neo4j://${input.job.id}` : `graph://${input.job.id}`
      });
      graphSnapshotId = savedGraph.id;

      await extendAuditLease(input.job.id);

      await recordAuditEvent(input.job.id, AuditEvent.GRAPH_BUILT, {
        nodeCount: graphPayload.nodes.length,
        edgeCount: graphPayload.edges.length
      });

      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.GRAPH, {
        graphSnapshotId,
        findingCount: 0,
        clusterCount: 0
      });

      trackServerEvent(input.job.organizationId, 'audit_graph_built', {
        auditRunId: input.job.id,
        ingestionSource: prepared.ingestionSource
      });
    }

    await assertAuditContinuing(input.job.id);

    const graphGrounding = buildGraphGroundingContext({
      graph: graphPayload,
      sourcePaths: ingestion.source_files.map((source) => source.path)
    });
    const graphGroundingSummary = summarizeGraphGrounding(graphGrounding);

    const sharedPayload = {
      projectId: input.job.projectId,
      branch: input.job.branch,
      commitSha: input.job.commitSha,
      attempt: input.job.attempt,
      analysis_roles: analysisRoles,
      orbit_context: prepared.orbitContext,
      repo_tree: ingestion.repo_tree,
      ci_config: ingestion.ci_config,
      has_ci: ingestion.has_ci,
      source_files: ingestion.source_files,
      ownership_hints: ingestion.ownership_hints,
      ci_history: ingestion.ci_history,
      existing_issues: ingestion.existing_issues,
      graph_nodes: graphPayload.nodes,
      graph_edges: graphPayload.edges,
      graph_grounding: graphGroundingSummary,
      ingestion_metadata: ingestion.metadata,
      ingestion_source: prepared.ingestionSource,
      workflow_contract: AUDIT_WORKFLOW_CONTRACT,
      validation_policy: {
        dedupe: dedupePolicy,
        severity: severityPolicy
      }
    };

    const synthesisPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      analysis_roles: sharedPayload.analysis_roles,
      ingestion_source: sharedPayload.ingestion_source,
      validation_policy: sharedPayload.validation_policy,
      graph_grounding: sharedPayload.graph_grounding,
      workflow_contract: sharedPayload.workflow_contract,
      orbit_context: prepared.orbitContext
        ? {
            status: prepared.orbitContext.status,
            reason: prepared.orbitContext.reason,
            definitionMapCount: prepared.orbitContext.definitionMaps.length,
            recentMergeRequestCount: prepared.orbitContext.recentMergeRequests.length,
            recentPipelineCount: prepared.orbitContext.recentPipelines.length
          }
        : null
    };

    const releaseSafetyPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      ci_config: sharedPayload.ci_config,
      deploy_jobs: ingestion.ci_history.pipelines.slice(0, 10).map((pipeline) => ({
        id: pipeline.id,
        status: pipeline.status,
        ref: pipeline.ref,
        sha: pipeline.sha,
        webUrl: pipeline.webUrl,
        createdAt: pipeline.createdAt,
        durationSeconds: pipeline.durationSeconds,
        failedJobs: pipeline.failedJobs.slice(0, 5).map((job) => ({
          id: job.id,
          name: job.name,
          stage: job.stage,
          status: job.status,
          webUrl: job.webUrl,
          durationSeconds: job.durationSeconds,
          failureReason: job.failureReason
        }))
      })),
      migrations: ingestion.repo_tree
        .filter((filePath) => filePath.includes('migrations/') || filePath.endsWith('.sql'))
        .slice(0, 50),
      release_docs: ingestion.repo_tree
        .filter((filePath) => /(^|\/)(README|readme|docs)\b/.test(filePath))
        .slice(0, 30),
      validation_policy: sharedPayload.validation_policy
    };

    const analysisPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      repo_tree: ingestion.repo_tree,
      ci_config: ingestion.ci_config,
      package_manifests: ingestion.package_manifests,
      pipeline_files: ingestion.pipeline_files,
      services: ingestion.services,
      apps: ingestion.apps,
      ownership_hints: ingestion.ownership_hints.slice(0, 80),
      ci_history: {
        pipelines: ingestion.ci_history.pipelines.slice(0, 10),
        totals: ingestion.ci_history.totals,
        recentFailedStages: ingestion.ci_history.recentFailedStages.slice(0, 20)
      },
      existing_issues: ingestion.existing_issues.slice(0, 20),
      graph_nodes: graphPayload.nodes.slice(0, 120),
      graph_edges: graphPayload.edges.slice(0, 160),
      graph_grounding: sharedPayload.graph_grounding,
      orbit_context: prepared.orbitContext
        ? {
            status: prepared.orbitContext.status,
            reason: prepared.orbitContext.reason,
            definitionMapCount: prepared.orbitContext.definitionMaps.length,
            recentMergeRequestCount: prepared.orbitContext.recentMergeRequests.length,
            recentPipelineCount: prepared.orbitContext.recentPipelines.length
          }
        : null,
      validation_policy: sharedPayload.validation_policy
    };

    const topologyPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      repo_tree: ingestion.repo_tree.slice(0, 400),
      module_graph: {
        nodes: graphPayload.nodes.slice(0, 160),
        edges: graphPayload.edges.slice(0, 220)
      },
      graph_grounding: sharedPayload.graph_grounding,
      ownership_hints: ingestion.ownership_hints.slice(0, 120),
      git_history: {
        pipelines: ingestion.ci_history.pipelines.slice(0, 8),
        totals: ingestion.ci_history.totals,
        recentFailedStages: ingestion.ci_history.recentFailedStages.slice(0, 20)
      },
      orbit_context: prepared.orbitContext
        ? {
            status: prepared.orbitContext.status,
            reason: prepared.orbitContext.reason,
            definitionMapCount: prepared.orbitContext.definitionMaps.length,
            recentMergeRequestCount: prepared.orbitContext.recentMergeRequests.length,
            recentPipelineCount: prepared.orbitContext.recentPipelines.length
          }
        : null
    };

    const crossRepoPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      repo_tree: ingestion.repo_tree,
      package_manifests: ingestion.package_manifests,
      apps: ingestion.apps,
      services: ingestion.services,
      release_docs: ingestion.repo_tree
        .filter((filePath) => /(^|\/)(README|readme|docs)\b/.test(filePath))
        .slice(0, 30),
      graph_grounding: sharedPayload.graph_grounding,
      orbit_context: prepared.orbitContext
        ? {
            status: prepared.orbitContext.status,
            reason: prepared.orbitContext.reason,
            definitionMapCount: prepared.orbitContext.definitionMaps.length,
            recentMergeRequestCount: prepared.orbitContext.recentMergeRequests.length,
            recentPipelineCount: prepared.orbitContext.recentPipelines.length
          }
        : null,
      validation_policy: sharedPayload.validation_policy
    };

    const generatedFiles = ingestion.repo_tree
      .filter((filePath) =>
        /(^|\/)(vendor|dist)\//.test(filePath) ||
        /\.generated\.(ts|tsx|js|mjs|json)$/.test(filePath) ||
        /\.(min|bundle)\.(js|mjs|css)$/.test(filePath) ||
        /\/src\/.*\.(js|mjs)$/.test(filePath) ||
        filePath.endsWith('client.js') ||
        filePath.endsWith('index.js') ||
        filePath.endsWith('repositories.js') ||
        filePath.endsWith('audit-events.js') ||
        filePath.endsWith('console-projection.js') ||
        filePath.endsWith('review.js') ||
        filePath.endsWith('severity.js') ||
        filePath.endsWith('status.js')
      )
      .slice(0, 120);

    const sourceOfTruthRefs = uniqueStrings([
      ...ingestion.repo_tree.filter((filePath) =>
        /(\.agents\/schemas\/|supabase\/migrations\/|prisma\/schema\.prisma$|package\.json$|wrangler(\.production)?\.toml$|next\.config\.(mjs|ts)$|\.env\.example$|SECURITY\.md$|README\.md$|docs\/.*\.md$)/.test(
          filePath
        )
      ),
      ...ingestion.package_manifests,
      ...ingestion.pipeline_files,
      ...Object.keys(ingestion.ci_config ?? {})
    ]).slice(0, 120);

    const artifactIntegrityPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      generated_files: generatedFiles,
      source_of_truth_refs: sourceOfTruthRefs,
      codegen_scripts: {
        package_manifests: ingestion.package_manifests.slice(0, 20),
        pipeline_files: ingestion.pipeline_files.slice(0, 20)
      },
      ci_checks: {
        workflow_files: ingestion.pipeline_files.slice(0, 20),
        failed_stages: ingestion.ci_history.recentFailedStages.slice(0, 20),
        totals: ingestion.ci_history.totals
      },
      validation_policy: sharedPayload.validation_policy
    };

    const configDriftPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      env_example_refs: ingestion.repo_tree.filter((filePath) => /\.env\.example$|\.env\.template$|\.env\.sample$/.test(filePath)).slice(0, 20),
      runtime_config_refs: ingestion.repo_tree.filter((filePath) =>
        /(production-mode\.ts|feature-flags\.ts|use-canonical-feature-flag\.ts|next\.config\.(mjs|ts)|wrangler(\.production)?\.toml|docker-compose\.yml|workspace\.ts|production-boundaries\.md)/.test(
          filePath
        )
      ).slice(0, 40),
      deployment_config_refs: ingestion.repo_tree.filter((filePath) =>
        /(wrangler(\.production)?\.toml|docker-compose\.yml|kustomization\.ya?ml|helm\/|\.github\/workflows\/|\.gitlab-ci\.yml|package\.json|next\.config\.(mjs|ts))/.test(
          filePath
        )
      ).slice(0, 40),
      fallback_mismatch_refs: ingestion.repo_tree.filter((filePath) =>
        /(fallback|mock|fixture|local-dev|production|config|env|flags?|defaults?)/i.test(filePath)
      ).slice(0, 40),
      validation_policy: sharedPayload.validation_policy
    };

    const supplyChainPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      manifests: ingestion.package_manifests.slice(0, 30),
      lockfiles: ingestion.repo_tree.filter((filePath) =>
        /(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo.lock|go\.sum|poetry.lock|Pipfile.lock|requirements(\.lock)?\.txt)/.test(
          filePath
        )
      ).slice(0, 20),
      dependency_graph: {
        node_count: graphPayload.nodes.length,
        edge_count: graphPayload.edges.length
      },
      ci_security_reports: ingestion.ci_history.recentFailedStages.slice(0, 12),
      validation_policy: sharedPayload.validation_policy
    };

    const secretRotationPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      high_risk_secrets: ingestion.repo_tree.filter((filePath) =>
        /(auth|oauth|secret|token|password|key|stripe|supabase|gitlab|phoenix|posthog|sentry|cloudflare|nango|slack)/i.test(
          filePath
        )
      ).slice(0, 60),
      rotation_docs: ingestion.repo_tree.filter((filePath) =>
        /(rotation|revocation|security\.md|secrets?\.md|trust-boundary|production-boundaries|data-retention)/i.test(
          filePath
        )
      ).slice(0, 40),
      revocation_paths: [
        'apps/web/app/api/auth/[provider]/route.ts',
        'apps/web/app/api/billing/portal/route.ts',
        'apps/web/app/api/workspace/integrations/[id]/disconnect/route.ts',
        'packages/db/src/workspace.ts',
        'packages/db/src/organization-connections.ts'
      ].filter((path) => ingestion.repo_tree.includes(path)),
      scope_reduction_opportunities: [
        'Narrow provider token scopes to read-only where publish is not required.',
        'Prefer short-lived connect/session tokens over long-lived API keys.',
        'Rotate workspace secrets and revoke stale OAuth refresh tokens on disconnect.'
      ],
      validation_policy: sharedPayload.validation_policy
    };

    const agentsThatNeedTheFullPayload = new Set([
      'repo_topology_agent',
      'integration_boundary_agent',
      'trust_boundary_agent',
      'onboarding_operability_agent',
      'test_adequacy_agent',
      'observability_recovery_agent',
      'issue_memory_agent'
    ]);

    if (prepared.orbitContext?.status === 'enabled') {
      trackServerEvent(input.job.organizationId, 'orbit_context_loaded', {
        auditRunId: input.job.id,
        projectId: input.job.projectId,
        branch: input.job.branch,
        definitionPrefixCount: prepared.orbitContext.definitionMaps.length,
        mergeRequestCount: prepared.orbitContext.recentMergeRequests.length,
        pipelineCount: prepared.orbitContext.recentPipelines.length
      });
    } else {
      trackServerEvent(input.job.organizationId, 'orbit_context_unavailable', {
        auditRunId: input.job.id,
        projectId: input.job.projectId,
        reason: prepared.orbitContext?.reason ?? 'Orbit disabled or unavailable'
      });
    }

    const completedSpecialists = new Set(checkpoint?.completedSpecialists ?? []);
    const seenFindingIds = new Set<string>();
    const pendingSpecialists = shouldSkipPhase(checkpoint, AuditCheckpointPhase.CLUSTERING)
      ? []
      : specialists.filter((specialist) => !completedSpecialists.has(specialist.name));

    const structureLane = pendingSpecialists.filter((specialist) =>
      (STRUCTURE_LANE_AGENTS as readonly string[]).includes(specialist.name)
    );
    const runtimeLane = pendingSpecialists.filter((specialist) =>
      (RUNTIME_LANE_AGENTS as readonly string[]).includes(specialist.name)
    );
    const unassignedLane = pendingSpecialists.filter(
      (specialist) =>
        !(STRUCTURE_LANE_AGENTS as readonly string[]).includes(specialist.name) &&
        !(RUNTIME_LANE_AGENTS as readonly string[]).includes(specialist.name)
    );

    const orchestratorAnalysisPayload = {
      projectId: sharedPayload.projectId,
      branch: sharedPayload.branch,
      commitSha: sharedPayload.commitSha,
      attempt: sharedPayload.attempt,
      auditRunId: input.job.id,
      analysis_roles: analysisRoles,
      scheduler_state: {
        checkpointPhase: checkpoint?.phase ?? null,
        resume,
        skipGraph,
        laneSizes: {
          structure: structureLane.length,
          runtime: runtimeLane.length,
          unassigned: unassignedLane.length
        },
        completedSpecialists: [...completedSpecialists].slice(0, 40),
        pendingSpecialists: pendingSpecialists.map((specialist) => specialist.name).slice(0, 40)
      },
      queue_contract: {
        maxBatchSize: 1,
        maxRetries: 3,
        deadLetterQueue: 'premortem-audit-jobs-dlq-dev'
      },
      workflow_contract: AUDIT_WORKFLOW_CONTRACT,
      scheduler_refs: [
        'services/orchestrator/src/scheduler/run-audit.ts',
        'services/orchestrator/src/services/audit-persistence.ts',
        'apps/api/src/index.ts',
        'apps/api/wrangler.toml',
        'apps/api/wrangler.production.toml'
      ],
      graph_grounding: sharedPayload.graph_grounding,
      validation_policy: sharedPayload.validation_policy
    };

    async function runSpecialistBatch(batch: RegisteredAgent[]): Promise<{
      findings: CanonicalFinding[];
      mapEntries: Array<[string, string]>;
    }> {
      const specialistResults = await runWithConcurrencyLimit(
        batch,
        DEFAULT_SPECIALIST_CONCURRENCY,
        async (specialist) => {
          await assertAuditContinuing(input.job.id);

          const { agentRun, result } = await runAgentWithPersistence({
            auditRunId: input.job.id,
            agentName: specialist.name,
            runMode: specialist.runMode,
            execute: () =>
              specialist.executor.kind === 'specialist'
                ? specialist.executor.run({
                    rootDir,
                    projectId: input.job.projectId,
                    auditRunId: input.job.id,
                    payload:
                      specialist.name === 'repo_topology_agent'
                        ? topologyPayload
                        : specialist.name === 'release_safety_agent'
                          ? releaseSafetyPayload
                          : specialist.name === 'cross_repo_boundary_agent'
                            ? crossRepoPayload
                            : specialist.name === 'artifact_integrity_agent'
                              ? artifactIntegrityPayload
                              : specialist.name === 'dependency_supply_chain_agent'
                                ? supplyChainPayload
                                : specialist.name === 'supply_chain_vulnerability_agent'
                                  ? supplyChainPayload
                                  : specialist.name === 'config_drift_agent'
                                    ? configDriftPayload
                                    : specialist.name === 'secret_rotation_risk_agent'
                                      ? secretRotationPayload
                                      : specialist.name === 'orchestrator_analysis_agent'
                                        ? orchestratorAnalysisPayload
                                        : agentsThatNeedTheFullPayload.has(specialist.name)
                                          ? sharedPayload
                                          : analysisPayload
                  })
                : Promise.resolve([]),
            serialize: (value) => ({
              findingCount: value.length,
              promptPath: specialist.promptPath
            })
          });

          const validFindings = result.filter((finding) => validateFinding(finding).length === 0);
          const uniqueFindings = dedupeFindings(validFindings).filter((finding) => {
            if (seenFindingIds.has(finding.finding_id)) {
              return false;
            }
            seenFindingIds.add(finding.finding_id);
            return true;
          });

          if (uniqueFindings.length > 0) {
            const persisted = await saveFindings({
              organizationId: input.job.organizationId,
              projectId: input.job.projectId,
              auditRunId: input.job.id,
              agentRunId: agentRun.id,
              findings: uniqueFindings
            });

            return {
              findings: uniqueFindings,
              mapEntries: uniqueFindings.map(
                (finding, index) => [finding.finding_id, persisted[index]!.id] as [string, string]
              )
            };
          }

          return { findings: [], mapEntries: [] as Array<[string, string]> };
        }
      );

      const laneFindings: CanonicalFinding[] = [];
      const mapEntries: Array<[string, string]> = [];

      for (const [index, specialist] of batch.entries()) {
        const result = specialistResults[index];
        if (!result) continue;

        laneFindings.push(...result.findings);
        mapEntries.push(...result.mapEntries);
        completedSpecialists.add(specialist.name);
      }

      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.SPECIALISTS, {
        completedSpecialists: [...completedSpecialists],
        graphSnapshotId,
        findingCount: findingIdMap.size + mapEntries.length,
        clusterCount: checkpoint?.clusterCount ?? 0
      });

      return { findings: laneFindings, mapEntries };
    }

    const laneResults = await Promise.all([
      runSpecialistBatch(structureLane),
      runSpecialistBatch(runtimeLane),
      unassignedLane.length > 0 ? runSpecialistBatch(unassignedLane) : Promise.resolve({ findings: [], mapEntries: [] })
    ]);

    for (const lane of laneResults) {
      findings.push(...lane.findings);
      for (const [findingKey, persistedId] of lane.mapEntries) {
        findingIdMap.set(findingKey, persistedId);
      }
    }

    findings.splice(0, findings.length, ...dedupeFindings(findings));
    findingIdMap = await loadPersistedFindingIdMap(input.job.id);
    const findingsForClustering =
      findings.length > 0 ? findings : await loadFindingsForClustering(input.job.id);

    let persistedClusters: Array<{ id: string; categoryOwner: string }> = [];
    let clusterIdByCategory = new Map<string, string>();

    if (shouldSkipPhase(checkpoint, AuditCheckpointPhase.SYNTHESIS)) {
      const auditRun = await getPersistedAuditRun(input.job.id);
      persistedClusters =
        auditRun?.dedupeClusters.map((cluster) => ({
          id: cluster.id,
          categoryOwner: cluster.categoryOwner
        })) ?? [];
      clusterIdByCategory = new Map(
        persistedClusters.map((cluster) => [cluster.categoryOwner, cluster.id])
      );
      clusterIdByFindingId = new Map(
        auditRun?.dedupeClusters.flatMap((cluster) =>
          cluster.members.map((member) => [member.findingId, cluster.id] as const)
        ) ?? []
      );
    } else {
      await assertAuditContinuing(input.job.id);

      const runtimeClusters = clusterFindings(findingsForClustering, dedupePolicy);
      persistedClusters = await saveClusters({
        organizationId: input.job.organizationId,
        projectId: input.job.projectId,
        auditRunId: input.job.id,
        clusters: runtimeClusters,
        findingIdMap
      });
      clusterIdByCategory = new Map(
        persistedClusters.map((cluster) => [cluster.categoryOwner, cluster.id])
      );
      clusterIdByFindingId = new Map(
        runtimeClusters.flatMap((cluster, index) =>
          cluster.sourceFindingIds.map((findingId) => [findingId, persistedClusters[index]!.id] as const)
        )
      );

      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.CLUSTERING, {
        completedSpecialists: [...completedSpecialists],
        graphSnapshotId,
        findingCount: findingIdMap.size,
        clusterCount: persistedClusters.length
      });
    }

    let rawIssues: IssueCandidate[] = [];

    if (shouldSkipPhase(checkpoint, AuditCheckpointPhase.VALIDATION)) {
      rawIssues = [];
    } else if (completedSpecialists.has(synthesizer.name)) {
      rawIssues = [];
    } else {
      await assertAuditContinuing(input.job.id);

      const synthesizerResult = await runAgentWithPersistence({
        auditRunId: input.job.id,
        agentName: synthesizer.name,
        runMode: synthesizer.runMode,
        execute: () =>
          synthesizer.executor.kind === 'synthesizer'
            ? synthesizer.executor.run(
                {
                  rootDir,
                  projectId: input.job.projectId,
                  auditRunId: input.job.id,
                  payload: sharedPayload
                },
                findingsForClustering
              )
            : Promise.resolve([]),
        serialize: (value) => ({
          issueCount: value.length,
          clusterCount: persistedClusters.length
        })
      });
      rawIssues = synthesizerResult.result;
      completedSpecialists.add(synthesizer.name);

      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.SYNTHESIS, {
        completedSpecialists: [...completedSpecialists],
        graphSnapshotId,
        findingCount: findingIdMap.size,
        clusterCount: persistedClusters.length
      });
    }

    let reviewableIssues: IssueValidationDecision[] = [];
    let rejectedIssues: IssueValidationDecision[] = [];

    const persistedRun = await getPersistedAuditRun(input.job.id);
    const hasPersistedIssues =
      (persistedRun?.issueCandidates.length ?? 0) > 0 ||
      (persistedRun?.rejectedIssueCandidateArtifacts.length ?? 0) > 0;

    if (shouldSkipPhase(checkpoint, AuditCheckpointPhase.FINISHED) || hasPersistedIssues) {
      reviewableIssues = [];
      rejectedIssues = [];
    } else {
      await assertAuditContinuing(input.job.id);

      const { result: validatedIssues } = await runAgentWithPersistence({
        auditRunId: input.job.id,
        agentName: 'issue_validator_agent',
        runMode: 'always',
        execute: async () => {
          if (!validator || validator.executor.kind !== 'synthesizer') {
            return rawIssues;
          }

          try {
            return await validator.executor.run(
              {
                rootDir,
                projectId: input.job.projectId,
                auditRunId: input.job.id,
                payload: synthesisPayload
              },
              rawIssues
            );
          } catch (error: unknown) {
            captureServerException(error, {
              auditRunId: input.job.id,
              phase: 'issue_validation_fallback'
            });
            return rawIssues;
          }
        },
        serialize: (value) => ({
          inputCount: rawIssues.length,
          outputCount: value.length
        })
      });

      const validationDecisions = validatedIssues.map((issue) => ({
        issue,
        errors: validateIssueCandidate(issue),
        warnings: [] as string[],
        validatorName: 'issue_validator_agent'
      }));

      reviewableIssues = validationDecisions
        .filter((decision) => decision.errors.length === 0)
        .map((decision) => ({
          ...decision,
          issue: downgradeSeverityForConfidence(decision.issue, severityPolicy)
        }));
      rejectedIssues = validationDecisions
        .filter((decision) => decision.errors.length > 0)
        .map((decision) => ({
          ...decision,
          issue: downgradeSeverityForConfidence(decision.issue, severityPolicy)
        }));

      if (rejectedIssues.length > 0) {
        await saveRejectedIssueArtifacts({
          organizationId: input.job.organizationId,
          projectId: input.job.projectId,
          auditRunId: input.job.id,
          clusterIdByCategory,
          clusterIdByFindingId,
          issues: rejectedIssues.map((decision) => ({
            issue: decision.issue,
            validationErrors: decision.errors,
            validationWarnings: decision.warnings,
            validatorName: decision.validatorName
          }))
        });

        await recordAuditEvent(input.job.id, AuditEvent.ISSUE_VALIDATION_REJECTED, {
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
          clusterIdByFindingId,
          issues: reviewableIssues.map((decision) => ({
            issue: decision.issue,
            validationErrors: decision.errors,
            validationWarnings: decision.warnings,
            validatorName: decision.validatorName
          }))
        });
      }

      await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.VALIDATION, {
        completedSpecialists: [...completedSpecialists, 'issue_validator_agent'],
        graphSnapshotId,
        findingCount: findingIdMap.size,
        clusterCount: persistedClusters.length
      });
    }

    const finalRun = await getPersistedAuditRun(input.job.id);
    const issueCandidateCount = finalRun?.issueCandidates.length ?? reviewableIssues.length;
    const rejectedIssueCount =
      finalRun?.rejectedIssueCandidateArtifacts.length ?? rejectedIssues.length;

    const auditSummary = {
      findingCount: findingIdMap.size,
      criticalCount: findings.filter((finding) => finding.severity === 'critical').length,
      clusterCount: persistedClusters.length,
      issueCandidateCount,
      rejectedIssueCount,
      registryAgentCount: agents.length,
      graphNodeCount: graphPayload.nodes.length,
      graphEdgeCount: graphPayload.edges.length,
      ingestion: ingestion.metadata,
      checkpoint: {
        phase: AuditCheckpointPhase.FINISHED,
        completedSpecialists: [...completedSpecialists],
        findingCount: findingIdMap.size,
        clusterCount: persistedClusters.length,
        graphSnapshotId,
        savedAt: new Date().toISOString()
      }
    };
    await finishAuditWithNotifications({
      auditRunId: input.job.id,
      organizationId: input.job.organizationId,
      projectId: input.job.projectId,
      branch: input.job.branch,
      summary: auditSummary
    });

    const findingConfidenceAvg =
      findings.length > 0
        ? findings.reduce((total, finding) => total + finding.confidence, 0) / findings.length
        : undefined;
    const evidenceCountMin =
      findings.length > 0
        ? Math.min(...findings.map((finding) => finding.evidence.length))
        : undefined;
    const refusalRate =
      issueCandidateCount > 0 ? rejectedIssueCount / Math.max(issueCandidateCount, 1) : undefined;

    const phoenixEval = evaluateAuditMissionQuality({
      auditRunId: input.job.id,
      findingCount: findingIdMap.size,
      issueCandidateCount,
      hasHumanReviewGate: true,
      findingConfidenceAvg,
      evidenceCountMin,
      refusalRate
    });

    let phoenixLlmEval: Awaited<ReturnType<typeof evaluateAuditMissionWithLlmJudge>> | null =
      null;
    const geminiApiKey =
      process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENAI_API_KEY?.trim() || '';
    if (isPhoenixLlmEvalEnabled() && geminiApiKey) {
      try {
        if (isPhoenixPromptSyncEnabled()) {
          await ensurePremortemAuditJudgePrompt(
            process.env.LLM_MODEL?.trim() || DEFAULT_GEMINI_MODEL
          ).catch((error: unknown) => {
            captureServerException(error, {
              auditRunId: input.job.id,
              phase: 'phoenix_prompt_sync'
            });
          });
        }
        phoenixLlmEval = await evaluateAuditMissionWithLlmJudge({
          auditRunId: input.job.id,
          findingCount: findingIdMap.size,
          issueCandidateCount,
          sampleFindingTitles: reviewableIssues
            .slice(0, 8)
            .map((decision) => decision.issue.title),
          apiKey: geminiApiKey,
          model: process.env.LLM_MODEL?.trim() || DEFAULT_GEMINI_MODEL
        });
      } catch (error: unknown) {
        captureServerException(error, { auditRunId: input.job.id, phase: 'phoenix_llm_eval' });
      }
    }

    trackServerEvent(input.job.organizationId, 'audit_completed', {
      auditRunId: input.job.id,
      findingsCount: findingIdMap.size,
      phoenixEval,
      phoenixLlmEval
    });

    if (isLangfuseConfigured()) {
      void createLangfuseScore({
        traceId: input.job.id,
        name: 'audit_mission_quality',
        value: phoenixEval.score,
        comment: phoenixEval.passed ? 'passed' : 'needs_review'
      }).catch(() => undefined);
    }

    if (isPhoenixDatasetSyncEnabled()) {
      await ensurePremortemAuditDataset().catch((error: unknown) => {
        captureServerException(error, {
          auditRunId: input.job.id,
          phase: 'phoenix_dataset_bootstrap'
        });
      });
      void appendAuditMissionToPhoenixDataset({
        input: {
          auditRunId: input.job.id,
          organizationId: input.job.organizationId,
          projectId: input.job.projectId,
          repositoryId: null
        },
        output: {
          findingCount: findingIdMap.size,
          issueCandidateCount,
          rejectedIssueCount,
          hasHumanReviewGate: true,
          passed: phoenixEval.passed,
          score: phoenixEval.score
        },
        metadata: {
          evaluator: phoenixEval.evaluator,
          label: phoenixEval.label
        }
      }).catch((error: unknown) => {
        captureServerException(error, {
          auditRunId: input.job.id,
          phase: 'phoenix_dataset_sync'
        });
      });
    }

    return {
      auditRunId: input.job.id,
      runStatus: 'completed',
      findingsCount: findingIdMap.size,
      clusterCount: persistedClusters.length,
      issueCandidateCount,
      rejectedIssueCount
    };
  } catch (error: unknown) {
    if (error instanceof AuditExecutionHalted) {
      if (error.kind === 'cancelled') {
        return {
          auditRunId: input.job.id,
          runStatus: 'failed',
          findingsCount: findingIdMap.size,
          clusterCount: 0,
          issueCandidateCount: 0,
          rejectedIssueCount: 0
        };
      }

      return {
        auditRunId: input.job.id,
        runStatus: 'paused',
        findingsCount: findingIdMap.size,
        clusterCount: 0,
        issueCandidateCount: 0,
        rejectedIssueCount: 0
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown audit execution error';
    captureServerException(error, { auditRunId: input.job.id, stage: 'executeAuditJob' });
    await failAuditWithNotifications({
      auditRunId: input.job.id,
      organizationId: input.job.organizationId,
      projectId: input.job.projectId,
      branch: input.job.branch,
      errorMessage: message
    });
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

  const issueCandidateVersions = auditRun.issueCandidates.reduce(
    (total, issue) => total + countIssueCandidateRelation(issue as IssueCandidateCountSource, 'versions'),
    0
  );
  const validationResults = auditRun.issueCandidates.reduce(
    (total, issue) => total + countIssueCandidateRelation(issue as IssueCandidateCountSource, 'validationResults'),
    0
  );

  let graphPayload: unknown = null;
  if (auditRun.graphSnapshot) {
    graphPayload = await resolveGraphSnapshotPayload({
      auditRunId: auditRun.id,
      projectId: auditRun.projectId,
      metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
      storageRef: auditRun.graphSnapshot.storageRef
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: auditRun.projectId },
    select: { provider: true, externalProjectId: true }
  });
  const gitlabCredentials = project
    ? await resolveGitLabCredentialsForProject(auditRun.projectId)
    : null;
  const canResolveSource =
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

  const findings = await Promise.all(
    auditRun.findings.map(async (finding) => {
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
        : undefined;

      return {
        id: finding.id,
        findingKey: finding.findingKey,
        title: finding.predictedFailureSummary.slice(0, 120),
        category: finding.category,
        severity: finding.severity,
        predictedFailureSummary: finding.predictedFailureSummary,
        agentRunId: finding.agentRunId,
        whyItMatters: finding.whyItMatters,
        failureMode: finding.failureMode,
        triggerConditions,
        affectedAssets,
        recommendedControls,
        evidence
      };
    })
  );

  const issueCandidates = await Promise.all(
    auditRun.issueCandidates.map(async (issue) => {
      const implementationSteps = Array.isArray(issue.implementationSteps)
        ? issue.implementationSteps.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const doneCriteria = Array.isArray(issue.doneCriteria)
        ? issue.doneCriteria.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const affectedAssets = Array.isArray(issue.affectedAssets)
        ? issue.affectedAssets.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const sourceFindings = Array.isArray(issue.sourceFindings)
        ? issue.sourceFindings.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const evidence = sourceContext
        ? await enrichEvidenceWithSourceSnippets({
            evidence: issue.evidence,
            ...sourceContext
          })
        : undefined;

      return {
        id: issue.id,
        title: issue.title,
        category: issue.category,
        validationStatus: issue.validationStatus,
        reviewerStatus: issue.reviewerStatus,
        versionCount: countIssueCandidateRelation(issue as IssueCandidateCountSource, 'versions'),
        validationResultCount: countIssueCandidateRelation(issue as IssueCandidateCountSource, 'validationResults'),
        publishedUrl: issue.publishedIssue?.url ?? null,
        predictedFailureSummary: issue.predictedFailureSummary,
        whyItMatters: issue.whyItMatters,
        recommendedActionSummary: issue.recommendedActionSummary,
        implementationSteps,
        doneCriteria,
        affectedAssets,
        sourceFindings,
        clusterId: issue.clusterId,
        evidence
      };
    })
  );

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
    agentRuns: auditRun.agentRuns.map((run) => ({
      id: run.id,
      agentName: run.agentName,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null
    })),
    findings,
    clusters: auditRun.dedupeClusters.map((cluster) => ({
      id: cluster.id,
      categoryOwner: cluster.categoryOwner,
      titleHint: cluster.titleHint,
      severity: cluster.severity,
      findingCount: cluster.members.length,
      memberFindingIds: cluster.members.map((member) => member.findingId)
    })),
    issueCandidates,
    rejectedIssueCandidates: auditRun.rejectedIssueCandidateArtifacts.map((issue) => ({
      id: issue.id,
      title: issue.title,
      category: issue.category,
      validatorName: issue.validatorName,
      validationErrorCount: Array.isArray(issue.validationErrors) ? issue.validationErrors.length : 0
    })),
    lineage: [
      ...auditRun.agentRuns.map((run) => ({
        stage: 'agent_run',
        id: run.id,
        label: run.agentName,
        parentId: auditRun.id
      })),
      ...auditRun.findings.map((finding) => ({
        stage: 'finding',
        id: finding.id,
        label: finding.category,
        parentId: finding.agentRunId
      })),
      ...auditRun.dedupeClusters.map((cluster) => ({
        stage: 'cluster',
        id: cluster.id,
        label: cluster.categoryOwner,
        parentId: auditRun.id
      })),
      ...auditRun.issueCandidates.map((issue) => ({
        stage: 'issue_candidate',
        id: issue.id,
        label: issue.title,
        parentId: issue.clusterId
      }))
    ]
  };
}

export async function getRecentAuditRuns(
  organizationId: string,
  limit = 12
): Promise<AuditRunListItem[]> {
  const auditRuns = await listAuditRuns(organizationId, limit);
  return auditRuns.map((auditRun) => ({
    auditRunId: auditRun.id,
    projectId: auditRun.projectId,
    projectName: auditRun.project?.name ?? auditRun.projectId,
    branch: auditRun.branch,
    commitSha: auditRun.commitSha,
    runStatus: auditRun.runStatus,
    createdAt: auditRun.createdAt.toISOString(),
    reviewableIssueCount: auditRun._count.issueCandidates,
    rejectedIssueCount: auditRun._count.rejectedIssueCandidateArtifacts,
    latestEventType: auditRun.events[0]?.eventType
  }));
}

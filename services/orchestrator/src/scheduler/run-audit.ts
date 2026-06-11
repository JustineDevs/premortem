import { AuditEvent, AuditCheckpointPhase, DEFAULT_GEMINI_MODEL, RUNTIME_LANE_AGENTS, STRUCTURE_LANE_AGENTS } from '@premortem/domain';
import { bootstrapPremortemAgentMission } from '@premortem/agent-builder';
import {
  assertCanRunAudit,
  assertAuditReadiness,
  extendAuditLease,
  findActiveAuditRun,
  prisma,
  recordAuditSubmitted,
  resumeAuditRun
} from '@premortem/db';
import {
  validateFinding,
  validateIssueCandidate,
  type RegisteredAgent
} from '@premortem/agent-kit';
import type { CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import type { GraphSnapshotPayload } from '@premortem/graph-model';
import { buildAuditJob, type AuditJob } from '@premortem/workflow';
import { uploadArtifact, downloadArtifact } from '@premortem/storage';
import {
  captureServerException,
  createLangfuseScore,
  evaluateAuditMissionQuality,
  isLangfuseConfigured,
  trackServerEvent,
  tracePremortemAuditJob
} from '@premortem/observability';
import { isNeo4jGraphEnabled, writeGraphSnapshotToNeo4j } from '@premortem/integrations';
import { isProductionMode } from '@premortem/domain';
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
  saveGraphSnapshot,
  saveIssueCandidates,
  saveRejectedIssueArtifacts
} from '../services/audit-persistence';
import { buildGraphFromIngestion } from '../graph/build-graph-snapshot';
import { resolveGraphSnapshotPayload } from '../graph/resolve-graph-payload';
import { prepareAuditExecution } from './prepare-audit-context';
import {
  assertAuditContinuing,
  AuditExecutionHalted,
  isResumeExecution,
  parseAuditCheckpoint,
  persistPhaseCheckpoint,
  shouldSkipPhase
} from './audit-execution-control';

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
  reusedActiveRun?: boolean;
}

export interface AuditExecutionResult {
  auditRunId: string;
  runStatus: 'completed' | 'failed' | 'paused';
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
    title: string;
    category: string;
    severity: string;
    predictedFailureSummary: string;
    agentRunId: string;
  }>;
  clusters: Array<{
    id: string;
    categoryOwner: string;
    titleHint?: string | null;
    severity: string;
    findingCount: number;
  }>;
  issueCandidates: Array<{
    id: string;
    title: string;
    validationStatus: string;
    reviewerStatus: string;
    versionCount: number;
    validationResultCount: number;
    publishedUrl?: string | null;
  }>;
  rejectedIssueCandidates: Array<{
    id: string;
    title: string;
    category: string;
    validatorName: string;
    validationErrorCount: number;
  }>;
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

  const payload = await resolveGraphSnapshotPayload({
    auditRunId,
    projectId: auditRun.projectId,
    storageRef: auditRun.graphSnapshot.storageRef,
    metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
    download: downloadArtifact
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
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as unknown as CanonicalFinding['evidence'])
      : [],
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
    triggeredById: input.triggeredById
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

async function executeAuditJobCore(input: ExecuteAuditJobInput): Promise<AuditExecutionResult> {
  const prepared = await prepareAuditExecution(input.job, { rootDir: input.rootDir });
  const { ingestion, rootDir } = prepared;
  const agents = input.registryAgents ?? prepared.agents;
  const agentBuilderMission = await bootstrapPremortemAgentMission({
    auditRunId: input.job.id,
    projectId: input.job.projectId,
    branch: input.job.branch,
    ingestionSource: prepared.ingestionSource
  });
  ingestion.metadata = {
    ...ingestion.metadata,
    agentBuilder: agentBuilderMission
  };

  const specialists = agents.filter((agent) => agent.executor.kind === 'specialist');
  const synthesizer = agents.find((agent) => agent.name === 'finding_synthesizer_agent');
  if (!synthesizer || synthesizer.executor.kind !== 'synthesizer') {
    throw new Error('Missing finding_synthesizer_agent executor');
  }

  const findings: CanonicalFinding[] = [];
  let findingIdMap = new Map<string, string>();
  let graphPayload: GraphSnapshotPayload = { auditRunId: input.job.id, projectId: input.job.projectId, nodes: [], edges: [] };
  let graphSnapshotId: string | null = null;

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

      let storageRef: string | null = null;
      let graphPersistedToNeo4j = false;

      if (isNeo4jGraphEnabled()) {
        try {
          await writeGraphSnapshotToNeo4j(graphPayload);
          storageRef = `neo4j://${input.job.id}`;
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

      if (!graphPersistedToNeo4j) {
        try {
          storageRef = await uploadArtifact({
            organizationId: input.job.organizationId,
            projectId: input.job.projectId,
            auditRunId: input.job.id,
            kind: 'graph',
            payload: graphPayload
          });
        } catch (storageError) {
          captureServerException(storageError, { auditRunId: input.job.id, kind: 'graph' });
        }
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
          graphStore: graphPersistedToNeo4j ? 'neo4j' : storageRef ? 'supabase' : 'inline',
          ...(graphPersistedToNeo4j || storageRef ? {} : { inlinePayload: graphPayload })
        },
        storageRef: storageRef ?? `graph://${input.job.id}`
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

    const sharedPayload = {
      projectId: input.job.projectId,
      branch: input.job.branch,
      commitSha: input.job.commitSha,
      attempt: input.job.attempt,
      repo_tree: ingestion.repo_tree,
      ci_config: ingestion.ci_config,
      has_ci: ingestion.has_ci,
      ci_history: ingestion.ci_history,
      existing_issues: ingestion.existing_issues,
      graph_nodes: graphPayload.nodes,
      graph_edges: graphPayload.edges,
      ingestion_metadata: ingestion.metadata,
      ingestion_source: prepared.ingestionSource
    };

    const completedSpecialists = new Set(checkpoint?.completedSpecialists ?? []);
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

    async function runSpecialistBatch(batch: RegisteredAgent[]): Promise<{
      findings: CanonicalFinding[];
      mapEntries: Array<[string, string]>;
    }> {
      const laneFindings: CanonicalFinding[] = [];
      const mapEntries: Array<[string, string]> = [];

      for (const specialist of batch) {
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
                  payload: sharedPayload
                })
              : Promise.resolve([]),
          serialize: (value) => ({
            findingCount: value.length,
            promptPath: specialist.promptPath
          })
        });

        const validFindings = result.filter((finding) => validateFinding(finding).length === 0);
        if (validFindings.length > 0) {
          const persisted = await saveFindings({
            organizationId: input.job.organizationId,
            projectId: input.job.projectId,
            auditRunId: input.job.id,
            agentRunId: agentRun.id,
            findings: validFindings
          });

          validFindings.forEach((finding, index) => {
            mapEntries.push([finding.finding_id, persisted[index]!.id]);
          });
          laneFindings.push(...validFindings);
        }

        completedSpecialists.add(specialist.name);
        await persistPhaseCheckpoint(input.job.id, AuditCheckpointPhase.SPECIALISTS, {
          completedSpecialists: [...completedSpecialists],
          graphSnapshotId,
          findingCount: findingIdMap.size + mapEntries.length,
          clusterCount: checkpoint?.clusterCount ?? 0
        });
      }

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
    } else {
      await assertAuditContinuing(input.job.id);

      const runtimeClusters = clusterFindings(findingsForClustering);
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

      reviewableIssues = validationDecisions.filter((decision) => decision.errors.length === 0);
      rejectedIssues = validationDecisions.filter((decision) => decision.errors.length > 0);

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

    await finishAudit(input.job.id, {
      findingCount: findingIdMap.size,
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
    });

    const phoenixEval = evaluateAuditMissionQuality({
      auditRunId: input.job.id,
      findingCount: findingIdMap.size,
      issueCandidateCount,
      hasHumanReviewGate: true
    });

    trackServerEvent(input.job.organizationId, 'audit_completed', {
      auditRunId: input.job.id,
      findingsCount: findingIdMap.size,
      phoenixEval
    });

    if (isLangfuseConfigured()) {
      void createLangfuseScore({
        traceId: input.job.id,
        name: 'audit_mission_quality',
        value: phoenixEval.score,
        comment: phoenixEval.passed ? 'passed' : 'needs_review'
      }).catch(() => undefined);
    }

    return {
      auditRunId: input.job.id,
      runStatus: 'completed',
      findingsCount: findingIdMap.size,
      clusterCount: persistedClusters.length,
      issueCandidateCount,
      rejectedIssueCount
    };
  } catch (error) {
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

  let graphPayload: unknown = null;
  if (auditRun.graphSnapshot) {
    graphPayload = await resolveGraphSnapshotPayload({
      auditRunId: auditRun.id,
      projectId: auditRun.projectId,
      storageRef: auditRun.graphSnapshot.storageRef,
      metadata: auditRun.graphSnapshot.metadata as Record<string, unknown>,
      download: downloadArtifact
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
    findings: auditRun.findings.map((finding) => ({
      id: finding.id,
      title: finding.predictedFailureSummary.slice(0, 120),
      category: finding.category,
      severity: finding.severity,
      predictedFailureSummary: finding.predictedFailureSummary,
      agentRunId: finding.agentRunId
    })),
    clusters: auditRun.dedupeClusters.map((cluster) => ({
      id: cluster.id,
      categoryOwner: cluster.categoryOwner,
      titleHint: cluster.titleHint,
      severity: cluster.severity,
      findingCount: cluster.members.length
    })),
    issueCandidates: auditRun.issueCandidates.map((issue) => ({
      id: issue.id,
      title: issue.title,
      validationStatus: issue.validationStatus,
      reviewerStatus: issue.reviewerStatus,
      versionCount: issue.versions.length,
      validationResultCount: issue.validationResults.length,
      publishedUrl: issue.publishedIssue?.url ?? null
    })),
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

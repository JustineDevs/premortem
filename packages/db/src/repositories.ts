import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ReviewStatus, ReviewAction, type ReviewActionValue } from '@premortem/domain';
import { prisma } from './client';
import { invalidateWorkspaceBundleCache } from './workspace';

function asJsonObject(value: Record<string, unknown> | undefined = {}) {
  return value as Prisma.JsonObject;
}

function asJsonArray(value: unknown[]) {
  return value as Prisma.JsonArray;
}

function buildProjectListCacheKey(organizationId: string, take: number, cursor?: string) {
  return `${organizationId}:${take}:${cursor ?? ''}`;
}

function buildIssueCandidateBatchKey(input: {
  clusterId: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  predictedFailureSummary: string;
  whyItMatters: string;
  triggerConditions: string[];
  evidence: unknown[];
  recommendedActionSummary: string;
  implementationSteps: string[];
  doneCriteria: string[];
  affectedAssets: string[];
  sourceAgents: string[];
  sourceFindings: string[];
}) {
  return [
    input.clusterId,
    input.title,
    input.category,
    input.severity,
    input.confidence.toFixed(3),
    input.predictedFailureSummary,
    input.whyItMatters,
    JSON.stringify(input.triggerConditions),
    JSON.stringify(input.evidence),
    input.recommendedActionSummary,
    JSON.stringify(input.implementationSteps),
    JSON.stringify(input.doneCriteria),
    JSON.stringify(input.affectedAssets),
    JSON.stringify(input.sourceAgents),
    JSON.stringify(input.sourceFindings)
  ].join('\u0001');
}

const PROJECT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  metadata: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
  status: true,
  provider: true,
  connectionId: true,
  repoUrl: true,
  defaultBranch: true,
  externalProjectId: true,
  projectSettings: true,
  connectedAt: true
} as const;

const LOCAL_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000
} as const;

export async function createAuditRun(input: {
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
  triggerSource?: Prisma.AuditRunCreateInput['triggerSource'];
}) {
  const auditRun = await prisma.auditRun.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      branch: input.branch,
      commitSha: input.commitSha,
      triggeredById: input.triggeredById,
      triggerSource: input.triggerSource ?? 'manual',
      runStatus: 'queued'
    }
  });

  invalidateRecentAuditRunsCache(input.organizationId);
  return auditRun;
}

export async function markAuditRunning(auditRunId: string) {
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const auditRun = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'running', startedAt: new Date(), leaseExpiresAt },
    select: { organizationId: true }
  });

  invalidateRecentAuditRunsCache(auditRun.organizationId);
  return auditRun;
}

export async function markAuditCompleted(auditRunId: string, summary: Prisma.JsonObject) {
  const auditRun = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'completed', completedAt: new Date(), summary },
    select: { organizationId: true }
  });

  invalidateRecentAuditRunsCache(auditRun.organizationId);
  return auditRun;
}

export async function markAuditPaused(auditRunId: string, summary: Prisma.JsonObject) {
  const auditRun = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'paused', summary },
    select: { organizationId: true }
  });

  invalidateRecentAuditRunsCache(auditRun.organizationId);
  return auditRun;
}

export async function markAuditFailed(auditRunId: string, errorMessage: string) {
  const auditRun = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'failed', completedAt: new Date(), errorMessage },
    select: { organizationId: true }
  });

  invalidateRecentAuditRunsCache(auditRun.organizationId);
  return auditRun;
}

export async function createAuditRunEvent(input: {
  auditRunId: string;
  eventType: string;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.auditRunEvent.create({
    data: {
      auditRunId: input.auditRunId,
      eventType: input.eventType,
      actor: input.actor ?? 'system',
      payload: asJsonObject(input.payload)
    }
  });
}

export async function createAgentRun(input: {
  auditRunId: string;
  agentName: string;
  runMode: 'always' | 'conditional';
}) {
  return prisma.agentRun.create({
    data: {
      auditRunId: input.auditRunId,
      agentName: input.agentName,
      runMode: input.runMode,
      status: 'running',
      startedAt: new Date()
    }
  });
}

export async function completeAgentRun(agentRunId: string, payload?: Prisma.JsonObject) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: { status: 'completed', completedAt: new Date(), rawOutput: payload }
  });
}

export async function failAgentRun(agentRunId: string, errorMessage: string) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: { status: 'failed', completedAt: new Date(), errorMessage }
  });
}

export async function persistFindings(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  agentRunId: string;
  findings: Array<{
    findingKey: string;
    category: string;
    findingType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    predictedFailureSummary: string;
    failureMode?: string;
    whyItMatters?: string;
    blastRadius?: string;
    triggerConditions: string[];
    affectedAssets: string[];
    evidence: unknown[];
    recommendedControls: string[];
    dedupeKeys: string[];
    tags: string[];
  }>;
}): Promise<Array<{ id: string }>> {
  if (input.findings.length === 0) {
    return [];
  }

  const uniqueFindings = Array.from(
    new Map(input.findings.map((finding) => [finding.findingKey, finding])).values()
  );

  return prisma.finding.createManyAndReturn({
    data: uniqueFindings.map((finding) => ({
      organizationId: input.organizationId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      agentRunId: input.agentRunId,
      findingKey: finding.findingKey,
      category: finding.category,
      findingType: finding.findingType,
      severity: finding.severity,
      confidence: finding.confidence,
      predictedFailureSummary: finding.predictedFailureSummary,
      failureMode: finding.failureMode,
      whyItMatters: finding.whyItMatters,
      blastRadius: finding.blastRadius,
      triggerConditions: asJsonArray(finding.triggerConditions),
      affectedAssets: asJsonArray(finding.affectedAssets),
      evidence: asJsonArray(finding.evidence),
      recommendedControls: asJsonArray(finding.recommendedControls),
      dedupeKeys: asJsonArray(finding.dedupeKeys),
      tags: asJsonArray(finding.tags)
    }))
  });
}

export async function createDedupeClusters(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  clusters: Array<{
    clusterKey: string;
    categoryOwner: string;
    titleHint?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    blastRadius?: string;
    assetScope: string[];
    triggerSignature: string[];
    findings: Array<{ findingId: string; role?: string; similarityScore?: number }>;
  }>;
}) {
  if (input.clusters.length === 0) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const createdClusters = await tx.dedupeCluster.createManyAndReturn({
      data: input.clusters.map((cluster) => ({
        organizationId: input.organizationId,
        projectId: input.projectId,
        auditRunId: input.auditRunId,
        clusterKey: cluster.clusterKey,
        categoryOwner: cluster.categoryOwner,
        titleHint: cluster.titleHint,
        severity: cluster.severity,
        confidence: cluster.confidence,
        blastRadius: cluster.blastRadius,
        assetScope: asJsonArray(cluster.assetScope),
        triggerSignature: asJsonArray(cluster.triggerSignature)
      }))
    });

    const clusterIdByKey = new Map(createdClusters.map((cluster) => [cluster.clusterKey, cluster.id]));
    await tx.dedupeClusterMember.createMany({
      data: input.clusters.flatMap((cluster) => {
        const clusterId = clusterIdByKey.get(cluster.clusterKey);
        if (!clusterId) {
          throw new Error(`Missing persisted cluster for clusterKey: ${cluster.clusterKey}`);
        }
        return cluster.findings.map((member) => ({
          clusterId,
          findingId: member.findingId,
          role: member.role ?? 'supporting',
          similarityScore: member.similarityScore ?? 0.8
        }));
      })
    });

    const persistedClusters = await tx.dedupeCluster.findMany({
      where: {
        id: {
          in: createdClusters.map((cluster) => cluster.id)
        }
      },
      include: {
        members: {
          select: {
            findingId: true
          }
        }
      }
    });

    const clusterByKey = new Map(persistedClusters.map((cluster) => [cluster.clusterKey, cluster]));
    return input.clusters.map((cluster) => {
      const persisted = clusterByKey.get(cluster.clusterKey);
      if (!persisted) {
        throw new Error(`Missing persisted cluster for clusterKey: ${cluster.clusterKey}`);
      }
      return persisted;
    });
  });
}

export async function persistIssueCandidates(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  issues: Array<{
    clusterId: string;
    title: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    predictedFailureSummary: string;
    whyItMatters: string;
    triggerConditions: string[];
    evidence: unknown[];
    recommendedActionSummary: string;
    implementationSteps: string[];
    doneCriteria: string[];
    affectedAssets: string[];
    sourceAgents: string[];
    sourceFindings: string[];
    validationStatus: 'passed' | 'failed';
    validationErrors: string[];
    validationWarnings: string[];
    validatorName: string;
  }>;
}) {
  if (input.issues.length === 0) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const createdIssues = await tx.issueCandidate.createManyAndReturn({
      data: input.issues.map((issue) => ({
        organizationId: input.organizationId,
        projectId: input.projectId,
        auditRunId: input.auditRunId,
        clusterId: issue.clusterId,
        title: issue.title,
        category: issue.category,
        severity: issue.severity,
        confidence: issue.confidence,
        predictedFailureSummary: issue.predictedFailureSummary,
        whyItMatters: issue.whyItMatters,
        triggerConditions: asJsonArray(issue.triggerConditions),
        evidence: asJsonArray(issue.evidence),
        recommendedActionSummary: issue.recommendedActionSummary,
        implementationSteps: asJsonArray(issue.implementationSteps),
        doneCriteria: asJsonArray(issue.doneCriteria),
        affectedAssets: asJsonArray(issue.affectedAssets),
        sourceAgents: asJsonArray(issue.sourceAgents),
        sourceFindings: asJsonArray(issue.sourceFindings),
        validationStatus: issue.validationStatus,
        validationErrors: asJsonArray(issue.validationErrors)
      }))
    });

    const versionRows: Array<{
      issueCandidateId: string;
      versionNo: number;
      bodySnapshot: Prisma.JsonObject;
      editedById?: string;
      editReason?: string;
    }> = [];
    const validationRows: Array<{
      issueCandidateId: string;
      status: 'passed' | 'failed';
      validatorName: string;
      errors: Prisma.JsonArray;
      warnings: Prisma.JsonArray;
    }> = [];

    const createdIssuesByKey = new Map<string, Array<(typeof createdIssues)[number]>>();
    createdIssues.forEach((issue, index) => {
      const key = buildIssueCandidateBatchKey({
        clusterId: issue.clusterId,
        title: issue.title,
        category: issue.category,
        severity: issue.severity,
        confidence: Number(issue.confidence),
        predictedFailureSummary: issue.predictedFailureSummary,
        whyItMatters: issue.whyItMatters,
        triggerConditions: Array.isArray(issue.triggerConditions)
          ? issue.triggerConditions.filter((entry): entry is string => typeof entry === 'string')
          : [],
        evidence: Array.isArray(issue.evidence) ? issue.evidence : [],
        recommendedActionSummary: issue.recommendedActionSummary,
        implementationSteps: Array.isArray(issue.implementationSteps)
          ? issue.implementationSteps.filter((entry): entry is string => typeof entry === 'string')
          : [],
        doneCriteria: Array.isArray(issue.doneCriteria)
          ? issue.doneCriteria.filter((entry): entry is string => typeof entry === 'string')
          : [],
        affectedAssets: Array.isArray(issue.affectedAssets)
          ? issue.affectedAssets.filter((entry): entry is string => typeof entry === 'string')
          : [],
        sourceAgents: Array.isArray(issue.sourceAgents)
          ? issue.sourceAgents.filter((entry): entry is string => typeof entry === 'string')
          : [],
        sourceFindings: Array.isArray(issue.sourceFindings)
          ? issue.sourceFindings.filter((entry): entry is string => typeof entry === 'string')
          : []
      });
      const bucket = createdIssuesByKey.get(key);
      const mappedIssue = createdIssues[index] ?? issue;
      if (bucket) {
        bucket.push(mappedIssue);
      } else {
        createdIssuesByKey.set(key, [mappedIssue]);
      }
    });

    input.issues.forEach((issue, index) => {
      const key = buildIssueCandidateBatchKey(issue);
      const bucket = createdIssuesByKey.get(key);
      const issueCandidateId = bucket?.shift()?.id ?? createdIssues[index]?.id;
      if (!issueCandidateId) {
        throw new Error(`Missing persisted issue candidate for title: ${issue.title}`);
      }

      versionRows.push({
        issueCandidateId,
        versionNo: 1,
        bodySnapshot: asJsonObject({
          title: issue.title,
          category: issue.category,
          severity: issue.severity,
          confidence: issue.confidence,
          predictedFailureSummary: issue.predictedFailureSummary,
          whyItMatters: issue.whyItMatters,
          triggerConditions: issue.triggerConditions,
          evidence: issue.evidence,
          recommendedActionSummary: issue.recommendedActionSummary,
          implementationSteps: issue.implementationSteps,
          doneCriteria: issue.doneCriteria,
          affectedAssets: issue.affectedAssets,
          sourceAgents: issue.sourceAgents,
          sourceFindings: issue.sourceFindings
        })
      });

      validationRows.push({
        issueCandidateId,
        status: issue.validationStatus,
        validatorName: issue.validatorName,
        errors: asJsonArray(issue.validationErrors),
        warnings: asJsonArray(issue.validationWarnings)
      });
    });

    if (versionRows.length > 0) {
      await tx.issueCandidateVersion.createMany({ data: versionRows });
    }

    if (validationRows.length > 0) {
      await tx.issueValidationResult.createMany({ data: validationRows });
    }

    return tx.issueCandidate.findMany({
      where: {
        id: {
          in: createdIssues.map((issue) => issue.id)
        }
      },
      include: {
        versions: {
          orderBy: { versionNo: 'asc' }
        },
        validationResults: {
          orderBy: { createdAt: 'asc' }
        },
        publishedIssue: true
      }
    });
  });
}

export async function persistRejectedIssueCandidateArtifacts(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  issues: Array<{
    clusterId?: string;
    title: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    predictedFailureSummary: string;
    whyItMatters: string;
    triggerConditions: string[];
    evidence: unknown[];
    recommendedActionSummary: string;
    implementationSteps: string[];
    doneCriteria: string[];
    affectedAssets: string[];
    sourceAgents: string[];
    sourceFindings: string[];
    validationErrors: string[];
    validationWarnings: string[];
    validatorName: string;
  }>;
}) {
  if (input.issues.length === 0) {
    return { count: 0 };
  }

  return prisma.rejectedIssueCandidateArtifact.createMany({
    data: input.issues.map((issue) => ({
      organizationId: input.organizationId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      clusterId: issue.clusterId,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      confidence: issue.confidence,
      predictedFailureSummary: issue.predictedFailureSummary,
      whyItMatters: issue.whyItMatters,
      triggerConditions: asJsonArray(issue.triggerConditions),
      evidence: asJsonArray(issue.evidence),
      recommendedActionSummary: issue.recommendedActionSummary,
      implementationSteps: asJsonArray(issue.implementationSteps),
      doneCriteria: asJsonArray(issue.doneCriteria),
      affectedAssets: asJsonArray(issue.affectedAssets),
      sourceAgents: asJsonArray(issue.sourceAgents),
      sourceFindings: asJsonArray(issue.sourceFindings),
      validationErrors: asJsonArray(issue.validationErrors),
      validationWarnings: asJsonArray(issue.validationWarnings),
      validatorName: issue.validatorName
    }))
  });
}

export async function getAuditRunDetails(auditRunId: string) {
  return prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      branch: true,
      commitSha: true,
      runStatus: true,
      errorMessage: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      graphSnapshot: true,
      _count: {
        select: {
          agentRuns: true,
          findings: true,
          dedupeClusters: true,
          issueCandidates: true,
          rejectedIssueCandidateArtifacts: true,
          events: true
        }
      },
      agentRuns: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          agentName: true,
          status: true,
          startedAt: true,
          completedAt: true
        }
      },
      findings: {
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: {
          id: true,
          findingKey: true,
          category: true,
          severity: true,
          predictedFailureSummary: true,
          agentRunId: true,
          confidence: true,
          whyItMatters: true,
          failureMode: true,
          triggerConditions: true,
          affectedAssets: true,
          recommendedControls: true,
          evidence: true
        }
      },
      dedupeClusters: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: {
          members: {
            select: { findingId: true },
            take: 200
          }
        }
      },
      issueCandidates: {
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          title: true,
          createdAt: true,
          category: true,
          validationStatus: true,
          reviewerStatus: true,
          priority: true,
          confidence: true,
          predictedFailureSummary: true,
          whyItMatters: true,
          triggerConditions: true,
          recommendedActionSummary: true,
          implementationSteps: true,
          doneCriteria: true,
          affectedAssets: true,
          sourceAgents: true,
          sourceFindings: true,
          clusterId: true,
          evidence: true,
          _count: {
            select: {
              versions: true,
              validationResults: true
            }
          },
          publishedIssue: true,
          versions: {
            orderBy: { versionNo: 'asc' },
            take: 10
          },
          validationResults: {
            orderBy: { createdAt: 'asc' },
            take: 10
          }
        }
      },
      rejectedIssueCandidateArtifacts: {
        orderBy: { createdAt: 'asc' },
        take: 100
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 500
      }
    }
  });
}

export async function persistGraphSnapshot(input: {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  nodeCount: number;
  edgeCount: number;
  metadata?: Record<string, unknown>;
  storageRef?: string;
}) {
  return prisma.graphSnapshot.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      graphVersion: 'v1',
      nodeCount: input.nodeCount,
      edgeCount: input.edgeCount,
      storageRef: input.storageRef,
      metadata: asJsonObject(input.metadata)
    }
  });
}

const PROJECT_LIST_CACHE_TTL_MS = 120_000;
type ProjectListItem = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_LIST_SELECT;
}>;
type ProjectListPage = {
  projects: ProjectListItem[];
  nextCursor: string | null;
};
const projectListCache = new Map<
  string,
  { expiresAt: number; promise?: Promise<ProjectListPage>; value?: ProjectListPage }
>();
const projectListCacheGeneration = new Map<string, number>();

function getProjectListCacheGeneration(organizationId: string) {
  return projectListCacheGeneration.get(organizationId) ?? 0;
}

export function invalidateProjectListCache(organizationId?: string) {
  if (!organizationId) {
    projectListCache.clear();
    projectListCacheGeneration.clear();
    return;
  }

  projectListCacheGeneration.set(organizationId, getProjectListCacheGeneration(organizationId) + 1);
  for (const key of projectListCache.keys()) {
    if (key.startsWith(`${organizationId}:`)) {
      projectListCache.delete(key);
    }
  }
}

async function loadOrganizationProjects(
  organizationId: string,
  options?: { take?: number; cursor?: string }
): Promise<ProjectListPage> {
  const take = Math.min(Math.max(options?.take ?? 100, 1), 100);
  const projects = await prisma.project.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(options?.cursor
      ? {
          cursor: {
            id: options.cursor
          },
          skip: 1
        }
      : {}),
    select: PROJECT_LIST_SELECT
  });

  const hasMore = projects.length > take;
  const page = hasMore ? projects.slice(0, take) : projects;
  return {
    projects: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null
  };
}

export async function listOrganizationProjects(
  organizationId: string,
  options?: { take?: number; cursor?: string }
) {
  const take = Math.min(Math.max(options?.take ?? 100, 1), 100);
  const cacheKey = buildProjectListCacheKey(organizationId, take, options?.cursor);
  const cacheGeneration = getProjectListCacheGeneration(organizationId);
  const now = Date.now();
  const cached = projectListCache.get(cacheKey);
  if (cached?.value && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loadOrganizationProjects(organizationId, options)
    .then((result) => {
      if (getProjectListCacheGeneration(organizationId) === cacheGeneration) {
        projectListCache.set(cacheKey, {
          expiresAt: Date.now() + PROJECT_LIST_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    })
    .finally(() => {
      const current = projectListCache.get(cacheKey);
      if (current?.promise === promise) {
        delete current.promise;
      }
    });

  projectListCache.set(cacheKey, { expiresAt: 0, promise });
  return promise;
}

function slugifyProjectName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || 'project';
}

export function slugifyProjectNameForRepo(name: string): string {
  return slugifyProjectName(name);
}

function externalProjectIdFromRepoUrl(repoUrl: string, fallback: string): string {
  try {
    const pathname = new URL(repoUrl).pathname.replace(/^\//, '').replace(/\.git$/, '');
    return pathname || fallback;
  } catch {
    return fallback;
  }
}

export async function createOrganizationProject(input: {
  organizationId: string;
  name: string;
  provider: 'gitlab' | 'github';
  repoUrl?: string;
  defaultBranch?: string;
  createdById?: string;
  scanCodeSnippet?: string;
}) {
  const slugBase = slugifyProjectName(input.name);
  const slug = `${slugBase}-${Date.now().toString(36).slice(-6)}`;
  const externalProjectId = input.repoUrl
    ? externalProjectIdFromRepoUrl(input.repoUrl, slug)
    : slug;

  const metadata: Record<string, unknown> = {};
  if (input.scanCodeSnippet) {
    metadata.scanCodeSnippet = input.scanCodeSnippet;
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug,
        provider: input.provider,
        repoUrl: input.repoUrl,
        defaultBranch: input.defaultBranch ?? 'main',
        externalProjectId,
        createdById: input.createdById,
        metadata: asJsonObject(metadata)
      },
      include: { projectSettings: true }
    });

    await tx.projectSetting.create({
      data: { projectId: project.id }
    });

    return {
      ...project,
      projectSettings: await tx.projectSetting.findUnique({
        where: { projectId: project.id }
      })
    };
  }).finally(() => {
    invalidateProjectListCache(input.organizationId);
    invalidateWorkspaceBundleCache(input.organizationId);
  });
}

export async function updateProjectSettings(input: {
  organizationId: string;
  projectId: string;
  autoRunOnPush?: boolean;
  autoPublishApprovedIssues?: boolean;
  auditDefaultBranchOnly?: boolean;
  enabledAgents?: string[];
  severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
  labelsTemplate?: string[];
  ignorePaths?: string[];
  notificationSettings?: Record<string, unknown>;
}) {
  const project = await prisma.project.findFirstOrThrow({
    where: {
      id: input.projectId,
      organizationId: input.organizationId
    }
  });

  const current = await prisma.projectSetting.findUnique({
    where: { projectId: project.id }
  });

  return prisma.projectSetting.upsert({
    where: { projectId: project.id },
    update: {
      autoRunOnPush: input.autoRunOnPush ?? current?.autoRunOnPush,
      autoPublishApprovedIssues:
        input.autoPublishApprovedIssues ?? current?.autoPublishApprovedIssues,
      auditDefaultBranchOnly: input.auditDefaultBranchOnly ?? current?.auditDefaultBranchOnly,
      enabledAgents: input.enabledAgents ?? (current?.enabledAgents as Prisma.JsonArray | undefined),
      severityThreshold: input.severityThreshold ?? current?.severityThreshold,
      labelsTemplate: input.labelsTemplate ?? (current?.labelsTemplate as Prisma.JsonArray | undefined),
      ignorePaths: input.ignorePaths ?? (current?.ignorePaths as Prisma.JsonArray | undefined),
      notificationSettings: (input.notificationSettings ?? current?.notificationSettings ?? {}) as Prisma.InputJsonValue
    },
    create: {
      projectId: project.id,
      autoRunOnPush: input.autoRunOnPush ?? false,
      autoPublishApprovedIssues: input.autoPublishApprovedIssues ?? false,
      auditDefaultBranchOnly: input.auditDefaultBranchOnly ?? true,
      enabledAgents: (input.enabledAgents ?? []) as Prisma.InputJsonValue,
      severityThreshold: input.severityThreshold ?? 'medium',
      labelsTemplate: (input.labelsTemplate ?? []) as Prisma.InputJsonValue,
      ignorePaths: (input.ignorePaths ?? []) as Prisma.InputJsonValue,
      notificationSettings: (input.notificationSettings ?? {}) as Prisma.InputJsonValue
    }
  }).finally(() => {
    invalidateProjectListCache(input.organizationId);
  });
}

export async function getIssueCandidateDetails(issueCandidateId: string) {
  return prisma.issueCandidate.findUnique({
    where: { id: issueCandidateId },
    include: {
      project: true,
      cluster: true,
      versions: { orderBy: { versionNo: 'asc' } },
      reviewActions: { orderBy: { createdAt: 'asc' } },
      publishedIssue: true
    }
  });
}

export class PublishNotApprovedError extends Error {
  readonly code = 'publish_not_approved';
  readonly field = 'reviewerStatus';
  readonly status = 422;

  constructor() {
    super(
      'Issue must be explicitly approved or edited before publish. Confirm the finding in review, then publish.'
    );
    this.name = 'PublishNotApprovedError';
  }
}

export async function assertIssueCandidateApprovedForPublish(issueCandidateId: string) {
  const issue = await prisma.issueCandidate.findUniqueOrThrow({
    where: { id: issueCandidateId },
    select: { reviewerStatus: true, publishedIssue: { select: { id: true } } }
  });

  if (issue.publishedIssue) {
    return;
  }

  if (
    issue.reviewerStatus !== ReviewStatus.APPROVED &&
    issue.reviewerStatus !== ReviewStatus.EDITED
  ) {
    throw new PublishNotApprovedError();
  }
}

export async function splitIssueCandidate(input: {
  issueCandidateId: string;
  actorId: string;
  title: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.issueCandidate.findUniqueOrThrow({
      where: { id: input.issueCandidateId },
      include: {
        cluster: { include: { members: true } }
      }
    });

    const clusterKey = `${parent.cluster.clusterKey}:split:${randomUUID()}`;
    const splitCluster = await tx.dedupeCluster.create({
      data: {
        organizationId: parent.organizationId,
        projectId: parent.projectId,
        auditRunId: parent.auditRunId,
        clusterKey,
        categoryOwner: parent.category,
        titleHint: input.title,
        severity: parent.severity,
        confidence: parent.confidence,
        blastRadius: parent.blastRadius,
        assetScope: asJsonArray(Array.isArray(parent.cluster.assetScope) ? parent.cluster.assetScope : []),
        triggerSignature: asJsonArray(
          Array.isArray(parent.cluster.triggerSignature) ? parent.cluster.triggerSignature : []
        )
      }
    });

    if (parent.cluster.members.length > 0) {
      await tx.dedupeClusterMember.createMany({
        data: parent.cluster.members.map((member) => ({
          clusterId: splitCluster.id,
          findingId: member.findingId,
          role: member.role,
          similarityScore: member.similarityScore
        }))
      });
    }

    const child = await tx.issueCandidate.create({
      data: {
        organizationId: parent.organizationId,
        projectId: parent.projectId,
        auditRunId: parent.auditRunId,
        clusterId: splitCluster.id,
        title: input.title,
        category: parent.category,
        severity: parent.severity,
        priority: parent.priority,
        confidence: parent.confidence,
        predictedFailureSummary: parent.predictedFailureSummary,
        failureMode: parent.failureMode,
        blastRadius: parent.blastRadius,
        whyItMatters: parent.whyItMatters,
        triggerConditions: asJsonArray(Array.isArray(parent.triggerConditions) ? parent.triggerConditions : []),
        evidence: asJsonArray(Array.isArray(parent.evidence) ? parent.evidence : []),
        recommendedActionSummary: parent.recommendedActionSummary,
        implementationSteps: asJsonArray(
          Array.isArray(parent.implementationSteps) ? parent.implementationSteps : []
        ),
        doneCriteria: asJsonArray(Array.isArray(parent.doneCriteria) ? parent.doneCriteria : []),
        affectedAssets: asJsonArray(Array.isArray(parent.affectedAssets) ? parent.affectedAssets : []),
        sourceAgents: asJsonArray(Array.isArray(parent.sourceAgents) ? parent.sourceAgents : []),
        sourceFindings: asJsonArray(Array.isArray(parent.sourceFindings) ? parent.sourceFindings : []),
        validationStatus: parent.validationStatus,
        validationErrors: asJsonArray(Array.isArray(parent.validationErrors) ? parent.validationErrors : []),
        reviewerStatus: 'pending',
        reviewerNotes: input.notes ?? null,
        versions: {
          create: {
            versionNo: 1,
            editedById: input.actorId,
            editReason: input.notes ?? 'Split from parent issue candidate',
            bodySnapshot: asJsonObject({
              title: input.title,
              splitFromIssueCandidateId: parent.id
            })
          }
        }
      }
    });

    await tx.issueCandidate.update({
      where: { id: parent.id },
      data: {
        reviewerNotes: input.notes ?? `Split child created: ${child.id}`
      }
    });

    const action = await tx.reviewAction.create({
      data: {
        issueCandidateId: parent.id,
        actorId: input.actorId,
        actionType: ReviewAction.SPLIT,
        notes: input.notes,
        payload: asJsonObject({
          title: input.title,
          childIssueCandidateId: child.id,
          splitClusterId: splitCluster.id
        })
      }
    });

    return { parent, child, action };
  });
}

export async function recordReviewAction(input: {
  issueCandidateId: string;
  actorId: string;
  actionType: ReviewActionValue;
  notes?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const action = await tx.reviewAction.create({
      data: {
        issueCandidateId: input.issueCandidateId,
        actorId: input.actorId,
        actionType: input.actionType,
        notes: input.notes,
        payload: asJsonObject(input.payload)
      }
    });

    if (input.actionType === ReviewAction.APPROVE) {
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: {
          reviewerStatus: 'approved',
          approvedById: input.actorId,
          approvedAt: new Date()
        }
      });
      return action;
    }

    if (input.actionType === ReviewAction.REJECT) {
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: { reviewerStatus: 'rejected', reviewerNotes: input.notes }
      });
      return action;
    }

    const issue = await tx.issueCandidate.findUniqueOrThrow({
      where: { id: input.issueCandidateId }
    });

    if (input.actionType === ReviewAction.EDIT) {
      const isDeferred = input.payload?.deferred === true;
      if (isDeferred) {
        await tx.issueCandidate.update({
          where: { id: input.issueCandidateId },
          data: { reviewerNotes: input.notes ?? issue.reviewerNotes }
        });
        return action;
      }

      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.issueCandidateId}))
      `;

      const latestVersion = await tx.issueCandidateVersion.findFirst({
        where: { issueCandidateId: input.issueCandidateId },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true }
      });
      const nextVersionNo = (latestVersion?.versionNo ?? 0) + 1;

      await tx.issueCandidateVersion.create({
        data: {
          issueCandidateId: input.issueCandidateId,
          versionNo: nextVersionNo,
          editedById: input.actorId,
          editReason: input.notes,
          bodySnapshot: asJsonObject(input.payload ?? {})
        }
      });
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: {
          reviewerStatus: 'edited',
          title: typeof input.payload?.title === 'string' ? input.payload.title : issue.title,
          whyItMatters:
            typeof input.payload?.whyItMatters === 'string' ? input.payload.whyItMatters : issue.whyItMatters,
          recommendedActionSummary:
            typeof input.payload?.recommendedActionSummary === 'string'
              ? input.payload.recommendedActionSummary
              : issue.recommendedActionSummary
        }
      });
      return action;
    }

    if (input.actionType === ReviewAction.MERGE) {
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: {
          reviewerStatus: 'rejected',
          reviewerNotes:
            input.notes ??
            (typeof input.payload?.mergedIntoIssueCandidateId === 'string'
              ? `Merged into ${input.payload.mergedIntoIssueCandidateId}`
              : 'Merged duplicate finding')
        }
      });
      return action;
    }

    if (input.actionType === ReviewAction.SPLIT) {
      // Real split creates a child issue via splitIssueCandidate().
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: {
          title: typeof input.payload?.title === 'string' ? input.payload.title : issue.title,
          reviewerNotes: input.notes ?? issue.reviewerNotes
        }
      });
      return action;
    }

    return action;
  }, LOCAL_TRANSACTION_OPTIONS);
}

export async function listRecentAuditRuns(limit = 12) {
  return prisma.auditRun.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: listRecentAuditRunsInclude
  });
}

const listRecentAuditRunsInclude = {
  project: {
    select: {
      name: true
    }
  },
  _count: {
    select: {
      issueCandidates: true,
      rejectedIssueCandidateArtifacts: true,
      events: true
    }
  },
  findings: {
    take: 200,
    select: {
      severity: true
    }
  },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      eventType: true,
      createdAt: true
    }
  }
} as const;

const RECENT_AUDIT_RUNS_CACHE_TTL_MS = 120_000;
const recentAuditRunsCache = new Map<
  string,
  {
    expiresAt: number;
    promise?: Promise<Awaited<ReturnType<typeof loadRecentAuditRuns>>>;
    value?: Awaited<ReturnType<typeof loadRecentAuditRuns>>;
  }
>();

async function loadRecentAuditRuns(organizationId: string, limit: number) {
  return prisma.auditRun.findMany({
    where: { organizationId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: listRecentAuditRunsInclude
  });
}

export async function listRecentAuditRunsForOrganization(organizationId: string, limit = 12) {
  const cacheKey = `${organizationId}:${limit}`;
  const now = Date.now();
  const cached = recentAuditRunsCache.get(cacheKey);
  if (cached?.value && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loadRecentAuditRuns(organizationId, limit)
    .then((auditRuns) => {
      recentAuditRunsCache.set(cacheKey, {
        expiresAt: Date.now() + RECENT_AUDIT_RUNS_CACHE_TTL_MS,
        value: auditRuns
      });
      return auditRuns;
    })
    .finally(() => {
      const current = recentAuditRunsCache.get(cacheKey);
      if (current?.promise === promise) {
        delete current.promise;
      }
    });

  recentAuditRunsCache.set(cacheKey, { expiresAt: 0, promise });
  return promise;
}

export function invalidateRecentAuditRunsCache(organizationId?: string) {
  if (!organizationId) {
    recentAuditRunsCache.clear();
    return;
  }

  for (const key of recentAuditRunsCache.keys()) {
    if (key.startsWith(`${organizationId}:`)) {
      recentAuditRunsCache.delete(key);
    }
  }
}

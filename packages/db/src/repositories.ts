import type { Prisma } from '@prisma/client';
import { ReviewStatus, ReviewAction, type ReviewActionValue } from '@premortem/domain';
import { prisma } from './client';

function asJsonObject(value: Record<string, unknown> | undefined = {}) {
  return value as Prisma.JsonObject;
}

function asJsonArray(value: unknown[]) {
  return value as Prisma.JsonArray;
}

export async function createAuditRun(input: {
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
  triggerSource?: Prisma.AuditRunCreateInput['triggerSource'];
}) {
  return prisma.auditRun.create({
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
}

export async function markAuditRunning(auditRunId: string) {
  const leaseExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'running', startedAt: new Date(), leaseExpiresAt }
  });
}

export async function markAuditCompleted(auditRunId: string, summary: Prisma.JsonObject) {
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'completed', completedAt: new Date(), summary }
  });
}

export async function markAuditPaused(auditRunId: string, summary: Prisma.JsonObject) {
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'paused', summary }
  });
}

export async function markAuditFailed(auditRunId: string, errorMessage: string) {
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'failed', completedAt: new Date(), errorMessage }
  });
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
}) {
  return prisma.$transaction(
    input.findings.map((finding) =>
      prisma.finding.create({
        data: {
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
        }
      })
    )
  );
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
  return prisma.$transaction(
    input.clusters.map((cluster) =>
      prisma.dedupeCluster.create({
        data: {
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
          triggerSignature: asJsonArray(cluster.triggerSignature),
          members: {
            create: cluster.findings.map((member) => ({
              findingId: member.findingId,
              role: member.role ?? 'supporting',
              similarityScore: member.similarityScore ?? 0.8
            }))
          }
        },
        include: {
          members: true
        }
      })
    )
  );
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
  return prisma.$transaction(
    input.issues.map((issue) =>
      prisma.issueCandidate.create({
        data: {
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
          validationErrors: asJsonArray(issue.validationErrors),
          versions: {
            create: {
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
            }
          },
          validationResults: {
            create: {
              status: issue.validationStatus,
              validatorName: issue.validatorName,
              errors: asJsonArray(issue.validationErrors),
              warnings: asJsonArray(issue.validationWarnings)
            }
          }
        },
        include: {
          versions: true,
          validationResults: true
        }
      })
    )
  );
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
  return prisma.$transaction(
    input.issues.map((issue) =>
      prisma.rejectedIssueCandidateArtifact.create({
        data: {
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
        }
      })
    )
  );
}

export async function getAuditRunDetails(auditRunId: string) {
  return prisma.auditRun.findUnique({
    where: { id: auditRunId },
    include: {
      agentRuns: {
        orderBy: { createdAt: 'asc' }
      },
      findings: {
        orderBy: { createdAt: 'asc' }
      },
      dedupeClusters: {
        orderBy: { createdAt: 'asc' },
        include: {
          members: true
        }
      },
      issueCandidates: {
        orderBy: { createdAt: 'asc' },
        include: {
          versions: {
            orderBy: { versionNo: 'asc' }
          },
          validationResults: {
            orderBy: { createdAt: 'asc' }
          },
          publishedIssue: true
        }
      },
      rejectedIssueCandidateArtifacts: {
        orderBy: { createdAt: 'asc' }
      },
      events: {
        orderBy: { createdAt: 'asc' }
      },
      graphSnapshot: true
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

export async function listOrganizationProjects(organizationId: string) {
  return prisma.project.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
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
      }
    });

    await tx.projectSetting.create({
      data: { projectId: project.id }
    });

    return project;
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

    const clusterKey = `${parent.cluster.clusterKey}:split:${Date.now()}`;
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
    const issue = await tx.issueCandidate.findUniqueOrThrow({
      where: { id: input.issueCandidateId }
    });

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
    }

    if (input.actionType === ReviewAction.REJECT) {
      await tx.issueCandidate.update({
        where: { id: input.issueCandidateId },
        data: { reviewerStatus: 'rejected', reviewerNotes: input.notes }
      });
    }

    if (input.actionType === ReviewAction.EDIT) {
      const isDeferred = input.payload?.deferred === true;
      if (isDeferred) {
        await tx.issueCandidate.update({
          where: { id: input.issueCandidateId },
          data: { reviewerNotes: input.notes ?? issue.reviewerNotes }
        });
        return action;
      }

      const versionCount = await tx.issueCandidateVersion.count({
        where: { issueCandidateId: input.issueCandidateId }
      });
      await tx.issueCandidateVersion.create({
        data: {
          issueCandidateId: input.issueCandidateId,
          versionNo: versionCount + 1,
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
    }

    return action;
  });
}

export async function listRecentAuditRuns(limit = 12) {
  return prisma.auditRun.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      issueCandidates: {
        select: {
          id: true,
          reviewerStatus: true,
          validationStatus: true
        }
      },
      rejectedIssueCandidateArtifacts: {
        select: {
          id: true
        }
      },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          eventType: true,
          createdAt: true
        }
      }
    }
  });
}

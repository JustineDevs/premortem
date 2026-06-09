import type { Prisma } from '@prisma/client';
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
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'running', startedAt: new Date() }
  });
}

export async function markAuditCompleted(auditRunId: string, summary: Prisma.JsonObject) {
  return prisma.auditRun.update({
    where: { id: auditRunId },
    data: { runStatus: 'completed', completedAt: new Date(), summary }
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
          }
        }
      },
      rejectedIssueCandidateArtifacts: {
        orderBy: { createdAt: 'asc' }
      },
      events: {
        orderBy: { createdAt: 'asc' }
      }
    }
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

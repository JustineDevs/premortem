import { prisma } from './client';
function asJsonObject(value = {}) {
    return value;
}
function asJsonArray(value) {
    return value;
}
export async function createAuditRun(input) {
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
export async function markAuditRunning(auditRunId) {
    return prisma.auditRun.update({
        where: { id: auditRunId },
        data: { runStatus: 'running', startedAt: new Date() }
    });
}
export async function markAuditCompleted(auditRunId, summary) {
    return prisma.auditRun.update({
        where: { id: auditRunId },
        data: { runStatus: 'completed', completedAt: new Date(), summary }
    });
}
export async function markAuditFailed(auditRunId, errorMessage) {
    return prisma.auditRun.update({
        where: { id: auditRunId },
        data: { runStatus: 'failed', completedAt: new Date(), errorMessage }
    });
}
export async function createAuditRunEvent(input) {
    return prisma.auditRunEvent.create({
        data: {
            auditRunId: input.auditRunId,
            eventType: input.eventType,
            actor: input.actor ?? 'system',
            payload: asJsonObject(input.payload)
        }
    });
}
export async function createAgentRun(input) {
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
export async function completeAgentRun(agentRunId, payload) {
    return prisma.agentRun.update({
        where: { id: agentRunId },
        data: { status: 'completed', completedAt: new Date(), rawOutput: payload }
    });
}
export async function failAgentRun(agentRunId, errorMessage) {
    return prisma.agentRun.update({
        where: { id: agentRunId },
        data: { status: 'failed', completedAt: new Date(), errorMessage }
    });
}
export async function persistFindings(input) {
    return prisma.$transaction(input.findings.map((finding) => prisma.finding.create({
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
    })));
}
export async function createDedupeClusters(input) {
    return prisma.$transaction(input.clusters.map((cluster) => prisma.dedupeCluster.create({
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
    })));
}
export async function persistIssueCandidates(input) {
    return prisma.$transaction(input.issues.map((issue) => prisma.issueCandidate.create({
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
    })));
}
export async function persistRejectedIssueCandidateArtifacts(input) {
    return prisma.$transaction(input.issues.map((issue) => prisma.rejectedIssueCandidateArtifact.create({
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
    })));
}
export async function getAuditRunDetails(auditRunId) {
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
export async function persistGraphSnapshot(input) {
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
export async function listOrganizationProjects(organizationId) {
    return prisma.project.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
    });
}
export async function getIssueCandidateDetails(issueCandidateId) {
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
export async function recordReviewAction(input) {
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
        if (input.actionType === 'approve') {
            await tx.issueCandidate.update({
                where: { id: input.issueCandidateId },
                data: {
                    reviewerStatus: 'approved',
                    approvedById: input.actorId,
                    approvedAt: new Date()
                }
            });
        }
        if (input.actionType === 'reject') {
            await tx.issueCandidate.update({
                where: { id: input.issueCandidateId },
                data: { reviewerStatus: 'rejected', reviewerNotes: input.notes }
            });
        }
        if (input.actionType === 'edit') {
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
                    whyItMatters: typeof input.payload?.whyItMatters === 'string' ? input.payload.whyItMatters : issue.whyItMatters,
                    recommendedActionSummary: typeof input.payload?.recommendedActionSummary === 'string'
                        ? input.payload.recommendedActionSummary
                        : issue.recommendedActionSummary
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

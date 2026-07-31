import {
  createReconciliationEvent,
  prisma,
  recordFixVerification,
  resolveGitLabCredentialsForProject
} from '@premortem/db';
import { fetchGitLabIssue } from '@premortem/integrations';

function detectDrift(
  local: {
    publishedTitle: string;
    publishedBodyMd: string;
    labels: unknown;
  },
  remote: { title?: string; description?: string; labels?: string[]; state?: string }
) {
  const driftFields: string[] = [];

  if (remote.title && remote.title !== local.publishedTitle) driftFields.push('title');
  if (remote.description && remote.description !== local.publishedBodyMd) driftFields.push('body');
  if (remote.labels && JSON.stringify(remote.labels) !== JSON.stringify(local.labels)) driftFields.push('labels');
  if (remote.state === 'closed') driftFields.push('state');

  return driftFields;
}

type PublishedIssueWithProject = {
  id: string;
  organizationId: string;
  projectId: string;
  externalIssueIid: string | null;
  publishedTitle: string;
  publishedBodyMd: string;
  labels: unknown;
  syncStatus: string;
  url: string | null;
  issueCandidate?: {
    id: string;
    clusterId: string;
    auditRunId: string;
    title: string;
    auditRun?: {
      id: string;
      completedAt: Date | null;
      graphSnapshotId: string | null;
    } | null;
  } | null;
  project: { externalProjectId: string };
};

const RECONCILIATION_BATCH_SIZE = 5;

async function reconcilePublishedIssueRecord(item: PublishedIssueWithProject) {
  if (!item.externalIssueIid) {
    return { skipped: true as const, reason: 'missing_external_iid' as const };
  }

  const credentials = await resolveGitLabCredentialsForProject(item.projectId);
  if (!credentials) {
    await createReconciliationEvent({
      organizationId: item.organizationId,
      publishedIssueId: item.id,
      status: 'failed',
      errorMessage: 'No GitLab credentials available for project'
    });
    return { failed: true as const };
  }

  try {
    const remote = await fetchGitLabIssue(
      credentials.baseUrl,
      credentials.token,
      item.project.externalProjectId,
      item.externalIssueIid
    );
    const state = String(remote.state ?? 'opened');
    const driftFields = detectDrift(
      {
        publishedTitle: item.publishedTitle,
        publishedBodyMd: item.publishedBodyMd,
        labels: item.labels
      },
      remote
    );
    const drifted = driftFields.length > 0;
    const syncStatus = state === 'closed' ? 'closed' : drifted ? 'drifted' : 'reconciled';

    await prisma.publishedIssue.update({
      where: { id: item.id },
      data: {
        syncStatus,
        publishedTitle: remote.title ?? item.publishedTitle,
        publishedBodyMd: remote.description ?? item.publishedBodyMd,
        labels: (remote.labels ?? item.labels) as string[],
        url: remote.web_url ?? item.url,
        lastSyncedAt: new Date(),
        closedAt: state === 'closed' ? new Date() : null
      }
    });

    if (state === 'closed' && item.issueCandidate) {
      const sourceAuditRun = item.issueCandidate.auditRun;
      const closingAuditRun = await prisma.auditRun.findFirst({
        where: {
          projectId: item.projectId,
          runStatus: 'completed',
          ...(sourceAuditRun?.completedAt
            ? { completedAt: { gt: sourceAuditRun.completedAt } }
            : {})
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          completedAt: true,
          graphSnapshotId: true,
          issueCandidates: {
            select: {
              clusterId: true,
              title: true
            }
          }
        }
      });

      const sameClusterStillPresent =
        closingAuditRun?.issueCandidates.some((candidate) => candidate.clusterId === item.issueCandidate?.clusterId) ??
        false;
      const sourceCompletedAt = sourceAuditRun?.completedAt ?? null;
      const closingCompletedAt = closingAuditRun?.completedAt ?? null;
      const verifiedStatus =
        !closingAuditRun
          ? 'partial'
          : sameClusterStillPresent
            ? 'regressed'
            : 'resolved';
      const summary =
        verifiedStatus === 'resolved'
          ? 'Closed GitLab issue no longer appears in the next completed audit for the same cluster.'
          : verifiedStatus === 'regressed'
            ? 'Closed GitLab issue still appears in a later completed audit for the same cluster.'
            : 'GitLab issue closed, but no later completed audit confirmed the fix yet.';

      const existingVerification = await prisma.fixVerification.findFirst({
        where: {
          publishedIssueId: item.id,
          closingAuditRunId: closingAuditRun?.id ?? null
        },
        select: { id: true }
      });

      if (!existingVerification) {
        await recordFixVerification({
          organizationId: item.organizationId,
          projectId: item.projectId,
          issueCandidateId: item.issueCandidate.id,
          publishedIssueId: item.id,
          sourceAuditRunId: item.issueCandidate.auditRunId,
          closingAuditRunId: closingAuditRun?.id ?? null,
          sourceGraphSnapshotId: sourceAuditRun?.graphSnapshotId ?? null,
          closingGraphSnapshotId: closingAuditRun?.graphSnapshotId ?? null,
          status: verifiedStatus,
          summary,
          evidence: [
            {
              kind: 'issue',
              ref: item.url ?? item.externalIssueIid,
              reason: 'Published GitLab issue reached a closed state and was rechecked during reconciliation.'
            },
            {
              kind: 'audit',
              ref: closingAuditRun?.id ?? item.issueCandidate.auditRunId,
              reason: 'Later completed audit used to verify whether the failure mode remained present.'
            }
          ],
          observedChanges: {
            sourceAuditRunId: sourceAuditRun?.id ?? item.issueCandidate.auditRunId,
            sourceCompletedAt: sourceCompletedAt ? sourceCompletedAt.toISOString() : null,
            closingAuditRunId: closingAuditRun?.id ?? null,
            closingCompletedAt: closingCompletedAt ? closingCompletedAt.toISOString() : null,
            sameClusterStillPresent,
            remoteState: state,
            remoteTitle: remote.title ?? null,
            remoteLabels: remote.labels ?? [],
            verifiedStatus
          }
        });
      }
    }

    await createReconciliationEvent({
      organizationId: item.organizationId,
      publishedIssueId: item.id,
      status: drifted ? 'drifted' : 'matched',
      driftFields,
      localSnapshot: {
        title: item.publishedTitle,
        publishedBodyMd: item.publishedBodyMd,
        labels: item.labels as unknown,
        syncStatus: item.syncStatus
      },
      remoteSnapshot: {
        title: remote.title,
        description: remote.description,
        labels: remote.labels,
        state: remote.state
      }
    });

    return { reconciled: true as const, drifted };
  } catch (error) {
    await createReconciliationEvent({
      organizationId: item.organizationId,
      publishedIssueId: item.id,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Reconciliation failed'
    });
    return { failed: true as const };
  }
}

export async function reconcilePublishedIssues(input?: { organizationId?: string }) {
  let reconciledCount = 0;
  let driftedCount = 0;
  let failedCount = 0;

  let cursor: { id: string } | undefined;
  while (true) {
    const publishedIssues = await prisma.publishedIssue.findMany({
      where: input?.organizationId ? { organizationId: input.organizationId } : undefined,
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        externalIssueIid: true,
        publishedTitle: true,
        publishedBodyMd: true,
        labels: true,
        syncStatus: true,
        url: true,
        issueCandidate: {
          select: {
            id: true,
            clusterId: true,
            auditRunId: true,
            title: true,
            auditRun: {
              select: {
                id: true,
                completedAt: true,
                graphSnapshotId: true
              }
            }
          }
        },
        project: {
          select: {
            externalProjectId: true
          }
        }
      },
      take: 50,
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });

    if (publishedIssues.length === 0) {
      break;
    }

    for (let index = 0; index < publishedIssues.length; index += RECONCILIATION_BATCH_SIZE) {
      const batch = publishedIssues.slice(index, index + RECONCILIATION_BATCH_SIZE);
      const results = await Promise.all(batch.map((item) => reconcilePublishedIssueRecord(item)));

      for (const result of results) {
        if ('failed' in result && result.failed) {
          failedCount += 1;
          continue;
        }
        if ('skipped' in result && result.skipped) continue;
        if ('reconciled' in result && result.reconciled) {
          reconciledCount += 1;
          if (result.drifted) driftedCount += 1;
        }
      }
    }

    if (publishedIssues.length < 50) {
      break;
    }

    cursor = { id: publishedIssues.at(-1)!.id };
  }

  return { reconciledCount, driftedCount, failedCount };
}

export async function reconcilePublishedIssuesByGitLabRef(input: {
  externalProjectId: string;
  externalIssueIid: string;
}) {
  const publishedIssues = await prisma.publishedIssue.findMany({
    where: {
      externalIssueIid: input.externalIssueIid,
      project: { externalProjectId: input.externalProjectId }
    },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      externalIssueIid: true,
      publishedTitle: true,
      publishedBodyMd: true,
      labels: true,
      syncStatus: true,
      url: true,
      issueCandidate: {
        select: {
          id: true,
          clusterId: true,
          auditRunId: true,
          title: true,
          auditRun: {
            select: {
              id: true,
              completedAt: true,
              graphSnapshotId: true
            }
          }
        }
      },
      project: {
        select: {
          externalProjectId: true
        }
      }
    },
    take: 10
  });

  if (publishedIssues.length === 0) {
    return { reconciledCount: 0, driftedCount: 0, failedCount: 0, matched: false };
  }

  let reconciledCount = 0;
  let driftedCount = 0;
  let failedCount = 0;

  for (const item of publishedIssues) {
    const result = await reconcilePublishedIssueRecord(item);
    if ('failed' in result && result.failed) failedCount += 1;
    else if ('reconciled' in result && result.reconciled) {
      reconciledCount += 1;
      if (result.drifted) driftedCount += 1;
    }
  }

  return { reconciledCount, driftedCount, failedCount, matched: true };
}

export interface GitLabIssueWebhookPayload {
  object_kind?: string;
  project?: { path_with_namespace?: string; id?: number };
  object_attributes?: { iid?: number; state?: string };
}

export async function handleGitLabIssueWebhook(payload: GitLabIssueWebhookPayload) {
  if (payload.object_kind !== 'issue') {
    return { ok: true, skipped: true, reason: 'unsupported_object_kind' as const };
  }

  const externalIssueIid = payload.object_attributes?.iid;
  const externalProjectId = payload.project?.path_with_namespace;
  if (!externalIssueIid || !externalProjectId) {
    return { ok: false, error: 'Missing GitLab project or issue reference' };
  }

  const result = await reconcilePublishedIssuesByGitLabRef({
    externalProjectId,
    externalIssueIid: String(externalIssueIid)
  });

  return { ok: true, ...result };
}

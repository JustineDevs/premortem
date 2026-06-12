import { createReconciliationEvent, prisma, resolveGitLabCredentialsForProject } from '@premortem/db';
import { gitLabAuthHeaders } from '@premortem/integrations';

async function fetchGitLabIssue(baseUrl: string, token: string, projectId: string, issueIid: string) {
  const response = await fetch(`${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
    headers: gitLabAuthHeaders(token)
  });

  if (!response.ok) throw new Error(`GitLab issue fetch failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<{
    state?: string;
    title?: string;
    description?: string;
    labels?: string[];
    web_url?: string;
  }>;
}

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
  project: { externalProjectId: string };
};

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

    await createReconciliationEvent({
      organizationId: item.organizationId,
      publishedIssueId: item.id,
      status: drifted ? 'drifted' : 'matched',
      driftFields,
      localSnapshot: {
        title: item.publishedTitle,
        labels: item.labels as unknown,
        syncStatus: item.syncStatus
      },
      remoteSnapshot: {
        title: remote.title,
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
  const publishedIssues = await prisma.publishedIssue.findMany({
    where: input?.organizationId ? { organizationId: input.organizationId } : undefined,
    include: { project: true },
    take: 50,
    orderBy: { updatedAt: 'desc' }
  });

  let reconciledCount = 0;
  let driftedCount = 0;
  let failedCount = 0;

  for (const item of publishedIssues) {
    const result = await reconcilePublishedIssueRecord(item);
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
    include: { project: true },
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

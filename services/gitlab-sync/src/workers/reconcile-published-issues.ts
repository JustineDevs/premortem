import { createReconciliationEvent, prisma, resolveGitLabCredentialsForProject } from '@premortem/db';

async function fetchGitLabIssue(baseUrl: string, token: string, projectId: string, issueIid: string) {
  const response = await fetch(`${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
    headers: { 'private-token': token }
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

function detectDrift(local: {
  publishedTitle: string;
  publishedBodyMd: string;
  labels: unknown;
}, remote: { title?: string; description?: string; labels?: string[]; state?: string }) {
  const driftFields: string[] = [];

  if (remote.title && remote.title !== local.publishedTitle) driftFields.push('title');
  if (remote.description && remote.description !== local.publishedBodyMd) driftFields.push('body');
  if (remote.labels && JSON.stringify(remote.labels) !== JSON.stringify(local.labels)) driftFields.push('labels');
  if (remote.state === 'closed') driftFields.push('state');

  return driftFields;
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
    if (!item.externalIssueIid) continue;

    const credentials = await resolveGitLabCredentialsForProject(item.projectId);
    if (!credentials) {
      failedCount += 1;
      await createReconciliationEvent({
        organizationId: item.organizationId,
        publishedIssueId: item.id,
        status: 'failed',
        errorMessage: 'No GitLab credentials available for project'
      });
      continue;
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

      reconciledCount += 1;
      if (drifted) driftedCount += 1;
    } catch (error) {
      failedCount += 1;
      await createReconciliationEvent({
        organizationId: item.organizationId,
        publishedIssueId: item.id,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Reconciliation failed'
      });
    }
  }

  return { reconciledCount, driftedCount, failedCount };
}

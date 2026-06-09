import { prisma } from '@premortem/db';

async function fetchGitLabIssue(baseUrl: string, token: string, projectId: string, issueIid: string) {
  const response = await fetch(`${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
    headers: { 'private-token': token }
  });

  if (!response.ok) throw new Error(`GitLab issue fetch failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function reconcilePublishedIssues() {
  const token = process.env.GITLAB_TOKEN;
  const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
  if (!token) throw new Error('GITLAB_TOKEN is required');

  const publishedIssues = await prisma.publishedIssue.findMany({
    include: { project: true },
    take: 50
  });

  for (const item of publishedIssues) {
    if (!item.externalIssueIid) continue;

    const remote = await fetchGitLabIssue(baseUrl, token, item.project.externalProjectId, item.externalIssueIid);
    const state = String(remote.state ?? 'opened');

    await prisma.publishedIssue.update({
      where: { id: item.id },
      data: {
        syncStatus: state === 'closed' ? 'closed' : 'updated',
        publishedTitle: remote.title,
        publishedBodyMd: remote.description ?? item.publishedBodyMd,
        labels: remote.labels ?? item.labels,
        url: remote.web_url ?? item.url,
        lastSyncedAt: new Date(),
        closedAt: state === 'closed' ? new Date() : null
      }
    });
  }

  return { reconciledCount: publishedIssues.length };
}

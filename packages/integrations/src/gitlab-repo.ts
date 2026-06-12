import { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabTreeEntry {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

export interface GitLabCommitSummary {
  id: string;
  shortId: string;
  title: string;
  authorName: string;
  authoredAt: string;
  committedAt: string;
  webUrl: string;
}

async function gitlabRequest(baseUrl: string, token: string, apiPath: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4${apiPath}`, {
    headers: gitLabAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`GitLab API ${apiPath} failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

export async function fetchGitLabUser(baseUrl: string, token: string) {
  const response = await gitlabRequest(baseUrl, token, '/user');
  return response.json() as Promise<{ id: number; username: string; name?: string }>;
}

export async function fetchRepositoryTree(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ref: string;
  maxEntries?: number;
}) {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const maxEntries = input.maxEntries ?? 120;
  const entries: GitLabTreeEntry[] = [];
  let page = 1;

  while (entries.length < maxEntries && page <= 5) {
    const response = await gitlabRequest(
      input.baseUrl,
      input.token,
      `/projects/${encodedProject}/repository/tree?ref=${encodeURIComponent(input.ref)}&recursive=true&per_page=100&page=${page}`
    );
    const batch = (await response.json()) as GitLabTreeEntry[];
    entries.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return entries.slice(0, maxEntries);
}

export async function fetchRepositoryFileRaw(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ref: string;
  filePath: string;
}) {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const encodedPath = encodeURIComponent(input.filePath);
  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(input.ref)}`
  );
  return response.text();
}

export async function fetchRepositoryCommitsByPath(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  filePath: string;
  ref?: string;
  maxCommits?: number;
}) {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const params = new URLSearchParams({
    per_page: String(input.maxCommits ?? 5),
    path: input.filePath
  });
  if (input.ref?.trim()) {
    params.set('ref_name', input.ref.trim());
  }

  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/repository/commits?${params.toString()}`
  );

  const rows = (await response.json()) as Array<{
    id: string;
    short_id?: string;
    title: string;
    author_name?: string;
    authored_date: string;
    committed_date: string;
    web_url: string;
  }>;

  return rows.map(
    (row): GitLabCommitSummary => ({
      id: row.id,
      shortId: row.short_id ?? row.id.slice(0, 8),
      title: row.title,
      authorName: row.author_name ?? 'unknown',
      authoredAt: row.authored_date,
      committedAt: row.committed_date,
      webUrl: row.web_url
    })
  );
}

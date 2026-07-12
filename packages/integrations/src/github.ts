import { fetchWithTimeout } from './fetch-with-timeout';

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface GitHubDiscoveredProject {
  externalProjectId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  visibility: 'private' | 'internal' | 'public' | 'unknown';
  accessLevel: number;
  canRead: boolean;
  canWriteIssues: boolean;
}

export interface GitHubLabelDefinition {
  name: string;
  color?: string;
  description?: string;
}

export interface GitHubIssuePayload {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
}

export function parseGitHubRepoFromUrl(repoUrl: string | null | undefined): GitHubRepoRef | null {
  if (!repoUrl) return null;
  try {
    const url = new URL(repoUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com' && !hostname.endsWith('.github.com')) {
      return null;
    }
    const parts = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

export function parseGitHubRepoFromReference(reference: string | null | undefined): GitHubRepoRef | null {
  if (!reference) return null;
  const trimmed = reference.trim();
  if (!trimmed) return null;
  if (trimmed.includes('://') || trimmed.startsWith('git@')) {
    return parseGitHubRepoFromUrl(trimmed);
  }

  const parts = trimmed.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return {
    owner: parts[0]!,
    repo: parts[1]!.replace(/\.git$/, '')
  };
}

export async function resolveGitHubProjectByReference(reference: string): Promise<GitHubDiscoveredProject> {
  const repo = parseGitHubRepoFromReference(reference);
  if (!repo) {
    throw new Error('Enter a valid GitHub URL or owner/repo path.');
  }

  const response = await fetchWithTimeout(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
  }

  const row = await response.json();
  const visibility =
    row?.visibility === 'private' || row?.visibility === 'internal' || row?.visibility === 'public'
      ? row.visibility
      : 'unknown';
  const accessLevel = visibility === 'public' ? 10 : 0;

  return {
    externalProjectId: `${repo.owner}/${repo.repo}`,
    name: String(row?.name ?? repo.repo),
    repoUrl: String(row?.html_url ?? `https://github.com/${repo.owner}/${repo.repo}`),
    defaultBranch: String(row?.default_branch ?? 'main'),
    visibility,
    accessLevel,
    canRead: visibility === 'public',
    canWriteIssues: false
  };
}

async function githubRequest<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetchWithTimeout(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function ensureGitHubLabels(
  token: string,
  repo: GitHubRepoRef,
  labels: GitHubLabelDefinition[]
) {
  const existing = await githubRequest<Array<{ name: string }>>(
    token,
    `/repos/${repo.owner}/${repo.repo}/labels?per_page=100`
  );
  const existingNames = new Set(existing.map((label) => label.name.toLowerCase()));

  for (const label of labels) {
    if (existingNames.has(label.name.toLowerCase())) continue;
    await githubRequest(token, `/repos/${repo.owner}/${repo.repo}/labels`, {
      method: 'POST',
      body: JSON.stringify({
        name: label.name,
        color: label.color?.replace('#', '').slice(0, 6),
        description: label.description?.slice(0, 100)
      })
    });
    existingNames.add(label.name.toLowerCase());
  }
}

export async function createGitHubIssue(token: string, payload: GitHubIssuePayload) {
  return githubRequest<{ id: number; number: number; html_url: string }>(
    token,
    `/repos/${payload.owner}/${payload.repo}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        labels: payload.labels
      })
    }
  );
}

export async function fetchGitHubIssue(
  token: string,
  repo: GitHubRepoRef,
  issueNumber: string
) {
  return githubRequest<{
    title: string;
    body: string | null;
    state: string;
    labels: Array<{ name: string }>;
    html_url: string;
  }>(token, `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`);
}

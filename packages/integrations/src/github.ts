export interface GitHubRepoRef {
  owner: string;
  repo: string;
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
    if (!url.hostname.includes('github.com')) return null;
    const parts = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

async function githubRequest<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
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
  return response.json() as Promise<T>;
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

import { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabDiscoveredProject {
  externalProjectId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  visibility: 'private' | 'internal' | 'public' | 'unknown';
  accessLevel: number;
  canRead: boolean;
  canWriteIssues: boolean;
}

interface GitLabProjectApiRow {
  id: number;
  path_with_namespace: string;
  name: string;
  web_url: string;
  default_branch?: string | null;
  visibility?: string;
  permissions?: {
    project_access?: { access_level?: number };
    group_access?: { access_level?: number };
  };
}

async function gitlabApiGet(baseUrl: string, token: string | undefined, apiPath: string) {
  const headers: Record<string, string> = token ? gitLabAuthHeaders(token) : {};

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4${apiPath}`, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitLab API ${apiPath} failed: ${response.status} ${body.slice(0, 200)}`);
  }
  return response;
}

function mapGitLabProject(row: GitLabProjectApiRow): GitLabDiscoveredProject {
  const projectAccess = row.permissions?.project_access?.access_level ?? 0;
  const groupAccess = row.permissions?.group_access?.access_level ?? 0;
  const accessLevel = Math.max(projectAccess, groupAccess);
  const visibility =
    row.visibility === 'private' || row.visibility === 'internal' || row.visibility === 'public'
      ? row.visibility
      : 'unknown';

  return {
    externalProjectId: row.path_with_namespace,
    name: row.name,
    repoUrl: row.web_url,
    defaultBranch: row.default_branch?.trim() || 'main',
    visibility,
    accessLevel,
    canRead: accessLevel >= 10 || visibility === 'public',
    canWriteIssues: accessLevel >= 30
  };
}

export async function listAccessibleGitLabProjects(input: {
  baseUrl: string;
  token: string;
  minAccessLevel?: number;
  maxPages?: number;
}): Promise<GitLabDiscoveredProject[]> {
  const minAccessLevel = input.minAccessLevel ?? 10;
  const maxPages = input.maxPages ?? 5;
  const discovered: GitLabDiscoveredProject[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      membership: 'true',
      min_access_level: String(minAccessLevel),
      order_by: 'last_activity_at',
      sort: 'desc',
      per_page: '100',
      page: String(page)
    });

    const response = await gitlabApiGet(
      input.baseUrl,
      input.token,
      `/projects?${params.toString()}`
    );
    const batch = (await response.json()) as GitLabProjectApiRow[];
    if (batch.length === 0) break;

    for (const row of batch) {
      if (!row.path_with_namespace || seen.has(row.path_with_namespace)) continue;
      seen.add(row.path_with_namespace);
      discovered.push(mapGitLabProject(row));
    }

    if (batch.length < 100) break;
  }

  return discovered;
}

export function parseGitLabExternalProjectId(repoUrlOrPath: string, baseUrl?: string): string {
  const trimmed = repoUrlOrPath.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const baseHost = baseUrl ? new URL(baseUrl).host : 'gitlab.com';
      if (url.host !== baseHost && !url.host.endsWith('.gitlab.com') && baseHost !== 'gitlab.com') {
        throw new Error('Repository host does not match configured GitLab base URL.');
      }
      return url.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\/-$/, '');
    } catch (error) {
      if (error instanceof Error && error.message.includes('GitLab base URL')) {
        throw error;
      }
      return '';
    }
  }

  return trimmed.replace(/\.git$/, '').replace(/^\//, '');
}

export async function resolveGitLabProjectByReference(input: {
  baseUrl: string;
  token?: string;
  repoUrlOrPath: string;
}): Promise<GitLabDiscoveredProject> {
  const externalProjectId = parseGitLabExternalProjectId(input.repoUrlOrPath, input.baseUrl);
  if (!externalProjectId) {
    throw new Error('Enter a valid GitLab URL or namespace/project path.');
  }

  const encoded = encodeURIComponent(externalProjectId);
  const response = await gitlabApiGet(input.baseUrl, input.token, `/projects/${encoded}`);
  const row = (await response.json()) as GitLabProjectApiRow;
  return mapGitLabProject(row);
}

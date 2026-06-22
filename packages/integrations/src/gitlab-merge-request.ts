import { gitLabAuthHeaders } from './gitlab-auth';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface GitLabMergeRequestSummary {
  iid: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  sha: string;
  webUrl: string;
  updatedAt: string;
}

async function gitlabRequest(baseUrl: string, token: string, apiPath: string) {
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/v4${apiPath}`, {
    headers: gitLabAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`GitLab API ${apiPath} failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

export async function fetchGitLabMergeRequest(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  iid: number;
}): Promise<GitLabMergeRequestSummary> {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/merge_requests/${input.iid}`
  );
  const row = (await response.json()) as {
    iid: number;
    title: string;
    state: string;
    source_branch?: string;
    target_branch?: string;
    sha?: string;
    web_url: string;
    updated_at: string;
  };

  return {
    iid: row.iid,
    title: row.title,
    state: row.state,
    sourceBranch: row.source_branch?.trim() || '',
    targetBranch: row.target_branch?.trim() || '',
    sha: row.sha?.trim() || '',
    webUrl: row.web_url,
    updatedAt: row.updated_at
  };
}

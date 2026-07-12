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

export interface GitLabMergeRequestChange {
  oldPath: string;
  newPath: string;
  diff: string;
  newFile: boolean;
  renamedFile: boolean;
  deletedFile: boolean;
}

export interface GitLabMergeRequestDiffSummary extends GitLabMergeRequestSummary {
  action?: string;
  changes: GitLabMergeRequestChange[];
  diffSnippet: string;
  changedFileCount: number;
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
  const row = await response.json();

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

export async function fetchGitLabMergeRequestChanges(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  iid: number;
}): Promise<GitLabMergeRequestDiffSummary> {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/merge_requests/${input.iid}/changes`
  );
  const row = await response.json();
  const changes = Array.isArray(row.changes)
    ? row.changes
        .map((change: Record<string, unknown>) => ({
          oldPath: typeof change.old_path === 'string' ? change.old_path : '',
          newPath: typeof change.new_path === 'string' ? change.new_path : '',
          diff: typeof change.diff === 'string' ? change.diff : '',
          newFile: change.new_file === true,
          renamedFile: change.renamed_file === true,
          deletedFile: change.deleted_file === true
        }))
        .filter((change: GitLabMergeRequestChange) => change.newPath.length > 0 || change.oldPath.length > 0)
    : [];

  const diffSnippet = changes
    .slice(0, 12)
    .map((change: GitLabMergeRequestChange) => {
      const header = `### ${change.newPath || change.oldPath}`;
      const status = [
        change.newFile ? 'new file' : null,
        change.renamedFile ? 'renamed file' : null,
        change.deletedFile ? 'deleted file' : null
      ]
        .filter((value): value is string => Boolean(value))
        .join(', ');
      const body = change.diff ? change.diff.split('\n').slice(0, 60).join('\n') : '(no diff text returned)';
      return [header, status ? `- ${status}` : null, body].filter(Boolean).join('\n');
    })
    .join('\n\n');

  return {
    ...(await fetchGitLabMergeRequest(input)),
    action: typeof row.action === 'string' ? row.action : undefined,
    changes,
    diffSnippet,
    changedFileCount: Array.isArray(row.changes) ? row.changes.length : 0
  };
}

export function summarizeGitLabMergeRequestDiff(
  changes: GitLabMergeRequestChange[],
  maxFiles = 12,
  maxLinesPerFile = 60
) {
  return changes
    .slice(0, maxFiles)
    .map((change: GitLabMergeRequestChange) => {
      const header = `### ${change.newPath || change.oldPath}`;
      const status = [
        change.newFile ? 'new file' : null,
        change.renamedFile ? 'renamed file' : null,
        change.deletedFile ? 'deleted file' : null
      ]
        .filter((value): value is string => Boolean(value))
        .join(', ');
      const body = change.diff ? change.diff.split('\n').slice(0, maxLinesPerFile).join('\n') : '(no diff text returned)';
      return [header, status ? `- ${status}` : null, body].filter(Boolean).join('\n');
    })
    .join('\n\n')
    .trim();
}

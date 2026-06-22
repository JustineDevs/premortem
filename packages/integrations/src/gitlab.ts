import { gitLabAuthHeaders } from './gitlab-auth';
import { fetchWithTimeout } from './fetch-with-timeout';

export { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabIssuePayload {
  projectId: string;
  title: string;
  description: string;
  labels?: string[];
  assigneeIds?: number[];
  milestoneId?: number;
  dueDate?: string;
  weight?: number;
}

export interface GitLabLabelDefinition {
  name: string;
  color?: string;
  description?: string;
}

function gitLabJsonHeaders(token: string) {
  return {
    ...gitLabAuthHeaders(token),
    'content-type': 'application/json'
  };
}

export async function listGitLabLabels(baseUrl: string, token: string, projectId: string) {
  const response = await fetchWithTimeout(
    `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/labels?per_page=100`,
    { headers: gitLabAuthHeaders(token) }
  );
  if (!response.ok) throw new Error(`GitLab label list failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<Array<{ name: string }>>;
}

/** Ensures project labels exist via GitLab Labels API (POST /projects/:id/labels). */
export async function ensureGitLabLabels(
  baseUrl: string,
  token: string,
  projectId: string,
  labels: GitLabLabelDefinition[]
) {
  const existing = await listGitLabLabels(baseUrl, token, projectId);
  const existingNames = new Set(existing.map((label) => label.name.toLowerCase()));

  for (const label of labels) {
    if (existingNames.has(label.name.toLowerCase())) continue;

    const response = await fetchWithTimeout(
      `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/labels`,
      {
        method: 'POST',
        headers: gitLabJsonHeaders(token),
        body: JSON.stringify({
          name: label.name,
          color: label.color ? `#${label.color.replace('#', '').slice(0, 6)}` : undefined,
          description: label.description?.slice(0, 255)
        })
      }
    );

    if (!response.ok) {
      throw new Error(`GitLab label create failed: ${response.status} ${await response.text()}`);
    }

    existingNames.add(label.name.toLowerCase());
  }
}

export async function createGitLabIssue(baseUrl: string, token: string, payload: GitLabIssuePayload) {
  const response = await fetchWithTimeout(`${baseUrl}/api/v4/projects/${encodeURIComponent(payload.projectId)}/issues`, {
    method: 'POST',
    headers: gitLabJsonHeaders(token),
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      labels: payload.labels?.join(','),
      assignee_ids: payload.assigneeIds?.length ? payload.assigneeIds : undefined,
      milestone_id: payload.milestoneId,
      due_date: payload.dueDate,
      weight: payload.weight
    })
  });

  if (!response.ok) throw new Error(`GitLab issue create failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function updateGitLabIssueTimeEstimate(
  baseUrl: string,
  token: string,
  projectId: string,
  issueIid: string | number,
  timeEstimate: string
) {
  const response = await fetchWithTimeout(
    `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/time_estimate?duration=${encodeURIComponent(timeEstimate)}`,
    {
      method: 'POST',
      headers: gitLabAuthHeaders(token)
    }
  );

  if (!response.ok) {
    throw new Error(`GitLab issue time estimate update failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

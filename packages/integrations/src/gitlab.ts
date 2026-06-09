export interface GitLabIssuePayload {
  projectId: string;
  title: string;
  description: string;
  labels?: string[];
}

export async function createGitLabIssue(baseUrl: string, token: string, payload: GitLabIssuePayload) {
  const response = await fetch(`${baseUrl}/api/v4/projects/${encodeURIComponent(payload.projectId)}/issues`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'private-token': token
    },
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      labels: payload.labels?.join(',')
    })
  });

  if (!response.ok) throw new Error(`GitLab issue create failed: ${response.status} ${await response.text()}`);
  return response.json();
}

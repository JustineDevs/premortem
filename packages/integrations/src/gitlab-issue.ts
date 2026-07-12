export async function fetchGitLabIssue(
  baseUrl: string,
  token: string,
  projectId: string,
  issueIid: string
) {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitLab issue fetch failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{
    state?: string;
    title?: string;
    description?: string;
    labels?: string[];
    web_url?: string;
  }>;
}

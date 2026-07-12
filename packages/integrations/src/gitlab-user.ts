import { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabUser {
  id: number;
  username: string;
  name?: string;
}

export async function fetchGitLabUser(
  baseUrl: string,
  token: string
): Promise<GitLabUser> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4/user`, {
    headers: gitLabAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`GitLab token validation failed (${response.status}).`);
  }

  const user = await response.json();
  if (typeof user.id !== 'number' || typeof user.username !== 'string') {
    throw new Error('GitLab token validation returned an invalid user payload.');
  }

  return {
    id: user.id,
    username: user.username,
    name: typeof user.name === 'string' ? user.name : undefined
  };
}

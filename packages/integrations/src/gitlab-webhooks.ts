import { gitLabAuthHeaders } from './gitlab-auth';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface GitLabProjectHook {
  id: number;
  url: string;
  issues_events: boolean;
}

export async function listGitLabProjectHooks(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}): Promise<GitLabProjectHook[]> {
  const response = await fetchWithTimeout(
    `${input.baseUrl}/api/v4/projects/${encodeURIComponent(input.externalProjectId)}/hooks`,
    { headers: gitLabAuthHeaders(input.token) }
  );

  if (!response.ok) {
    throw new Error(`GitLab hook list failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<GitLabProjectHook[]>;
}

/** Registers an Issue events hook when missing (idempotent). Requires Maintainer+ on the project. */
export async function ensureGitLabProjectIssueWebhook(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  webhookUrl: string;
  secretToken: string;
}) {
  const hooks = await listGitLabProjectHooks(input);
  const normalizedTarget = input.webhookUrl.replace(/\/$/, '');
  const existing = hooks.find(
    (hook) => hook.url.replace(/\/$/, '') === normalizedTarget && hook.issues_events
  );
  if (existing) {
    return { created: false as const, hookId: existing.id };
  }

  const response = await fetchWithTimeout(
    `${input.baseUrl}/api/v4/projects/${encodeURIComponent(input.externalProjectId)}/hooks`,
    {
      method: 'POST',
      headers: {
        ...gitLabAuthHeaders(input.token),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        url: normalizedTarget,
        token: input.secretToken,
        issues_events: true,
        enable_ssl_verification: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(`GitLab hook create failed: ${response.status} ${await response.text()}`);
  }

  const created = (await response.json()) as { id: number };
  return { created: true as const, hookId: created.id };
}

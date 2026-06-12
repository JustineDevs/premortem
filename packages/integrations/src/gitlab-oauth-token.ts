export interface GitLabOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  created_at?: number;
}

export async function refreshGitLabOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl?: string;
}): Promise<GitLabOAuthTokenResponse> {
  const base = (input.baseUrl ?? 'https://gitlab.com').replace(/\/$/, '');
  const response = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitLab token refresh failed: ${response.status} ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<GitLabOAuthTokenResponse>;
}

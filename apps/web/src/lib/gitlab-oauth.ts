import { randomBytes } from 'node:crypto';

const STATE_COOKIE = 'pm_integration_oauth_state';
const NEXT_COOKIE = 'pm_integration_oauth_next';

export function createOAuthState() {
  return randomBytes(24).toString('hex');
}

export function integrationOAuthCookieNames() {
  return { state: STATE_COOKIE, next: NEXT_COOKIE };
}

export function gitlabAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  baseUrl?: string;
}) {
  const base = input.baseUrl ?? 'https://gitlab.com';
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state: input.state,
    scope: 'read_user api read_repository'
  });
  return `${base}/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitLabCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;
}) {
  const base = input.baseUrl ?? 'https://gitlab.com';
  const response = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`GitLab token exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

export async function fetchGitLabProfile(baseUrl: string, accessToken: string) {
  const response = await fetch(`${baseUrl}/api/v4/user`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`GitLab profile fetch failed: ${response.status}`);
  }
  return response.json() as Promise<{
    id: number;
    username: string;
    name: string;
    web_url?: string;
  }>;
}

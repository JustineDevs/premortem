import { NextResponse, type NextRequest } from 'next/server';

import {
  exchangeGitLabCode,
  integrationOAuthCookieNames
} from '@/lib/gitlab-oauth';
import { gitlabOAuthRedirectUri } from '@/lib/runtime-config';
import { persistGitLabConnection } from '@/lib/server/persist-gitlab-connection';
import { resolveRequestActorContext } from '@/lib/server/request-context';

function redirectWithNotice(request: NextRequest, next: string, notice: string, detail?: string) {
  const redirectUrl = new URL(next, request.url);
  redirectUrl.searchParams.set('integration_notice', notice);
  if (detail) redirectUrl.searchParams.set('integration_detail', detail);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const cookies = integrationOAuthCookieNames();
  const savedState = request.cookies.get(cookies.state)?.value;
  const next = request.cookies.get(cookies.next)?.value ?? '/app?tab=settings';
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const oauthError = request.nextUrl.searchParams.get('error');

  const clearCookies = (response: NextResponse) => {
    response.cookies.set(cookies.state, '', { maxAge: 0, path: '/' });
    response.cookies.set(cookies.next, '', { maxAge: 0, path: '/' });
    return response;
  };

  if (oauthError || !code) {
    return clearCookies(redirectWithNotice(request, next, 'denied'));
  }

  if (!savedState || !state || savedState !== state) {
    return clearCookies(redirectWithNotice(request, next, 'invalid_state'));
  }

  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return clearCookies(redirectWithNotice(request, next, 'config'));
  }

  try {
    const redirectUri = gitlabOAuthRedirectUri(request.nextUrl.origin);
    const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
    const tokenPayload = await exchangeGitLabCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      baseUrl
    });
    const context = await resolveRequestActorContext();
    const persisted = await persistGitLabConnection({
      context,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      expiresInSeconds: tokenPayload.expires_in
    });

    if (!persisted.ok) {
      return clearCookies(
        redirectWithNotice(request, next, 'persist_failed', persisted.error)
      );
    }

    return clearCookies(redirectWithNotice(request, next, 'gitlab_connected'));
  } catch (error) {
    return clearCookies(
      redirectWithNotice(
        request,
        next,
        'oauth_failed',
        error instanceof Error ? error.message : undefined
      )
    );
  }
}

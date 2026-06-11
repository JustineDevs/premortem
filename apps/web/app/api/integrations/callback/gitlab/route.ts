import { NextResponse, type NextRequest } from 'next/server';

import { CanonicalEvents } from '@premortem/observability';
import { trackServerEvent } from '@premortem/observability';

import { getApiBaseUrl } from '@/lib/runtime-config';
import {
  exchangeGitLabCode,
  fetchGitLabProfile,
  integrationOAuthCookieNames
} from '@/lib/gitlab-oauth';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

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
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/callback/gitlab`;
    const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
    const tokenPayload = await exchangeGitLabCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      baseUrl
    });
    const profile = await fetchGitLabProfile(baseUrl, tokenPayload.access_token);
    const context = await resolveRequestActorContext();

    const response = await fetch(`${getApiBaseUrl()}/api/workspace/integrations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...actorHeaders(context)
      },
      body: JSON.stringify({
        provider: 'gitlab',
        externalAccountId: String(profile.id),
        externalAccountName: profile.username,
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        accessScope: {
          summary: 'read_user, api, read_repository',
          profileName: profile.name,
          webUrl: profile.web_url
        }
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return clearCookies(
        redirectWithNotice(
          request,
          next,
          'persist_failed',
          typeof payload.error === 'string' ? payload.error : undefined
        )
      );
    }

    trackServerEvent(context.profileId, CanonicalEvents.gitlabConnected, {
      provider: 'gitlab',
      externalAccountId: String(profile.id)
    });

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

import { NextResponse, type NextRequest } from 'next/server';

import {
  exchangeGitLabCode,
  integrationOAuthCookieNames
} from '@/lib/gitlab-oauth';
import { getPublicAppOrigin, getRequestOrigin, gitlabOAuthRedirectUri } from '@/lib/runtime-config';
import { persistGitLabConnection } from '@/lib/server/persist-gitlab-connection';
import { resolveRequestActorContext } from '@/lib/server/request-context';

function redirectWithNotice(request: NextRequest, next: string, notice: string, detail?: string) {
  const redirectUrl = new URL(next, getPublicAppOrigin(getRequestOrigin(request)));
  redirectUrl.searchParams.set('integration_notice', notice);
  if (detail) redirectUrl.searchParams.set('integration_detail', detail);
  return NextResponse.redirect(redirectUrl);
}

function clearCookies(response: NextResponse) {
  const cookies = integrationOAuthCookieNames();
  response.cookies.set(cookies.state, '', { maxAge: 0, path: '/' });
  response.cookies.set(cookies.next, '', { maxAge: 0, path: '/' });
  return response;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderPostBridge(request: NextRequest) {
  const postTarget = new URL(request.nextUrl.pathname, getPublicAppOrigin(getRequestOrigin(request)));
  const formAction = escapeHtml(postTarget.toString());
  const state = escapeHtml(request.nextUrl.searchParams.get('state') ?? '');
  const code = escapeHtml(request.nextUrl.searchParams.get('code') ?? '');
  const oauthError = escapeHtml(request.nextUrl.searchParams.get('error') ?? '');

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Finishing GitLab connection</title>
  </head>
  <body>
    <form id="gitlab-oauth-post-bridge" method="post" action="${formAction}">
      <input type="hidden" name="state" value="${state}" />
      <input type="hidden" name="code" value="${code}" />
      <input type="hidden" name="error" value="${oauthError}" />
      <noscript>
        <p>Continue to finish connecting GitLab.</p>
        <button type="submit">Continue</button>
      </noscript>
    </form>
    <script>
      document.getElementById('gitlab-oauth-post-bridge')?.submit();
    </script>
  </body>
</html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, max-age=0'
      }
    }
  );
}

export async function GET(request: NextRequest) {
  return renderPostBridge(request);
}

export async function POST(request: NextRequest) {
  const origin = getPublicAppOrigin(getRequestOrigin(request));
  const cookies = integrationOAuthCookieNames();
  const savedState = request.cookies.get(cookies.state)?.value;
  const next = request.cookies.get(cookies.next)?.value ?? '/app?tab=settings';
  const formData = await request.formData();
  const state = formData.get('state');
  const code = formData.get('code');
  const oauthError = formData.get('error');

  const stateValue = typeof state === 'string' ? state : null;
  const codeValue = typeof code === 'string' ? code : null;
  const oauthErrorValue = typeof oauthError === 'string' ? oauthError : null;

  if (oauthErrorValue || !codeValue) {
    return clearCookies(redirectWithNotice(request, next, 'denied'));
  }

  if (!savedState || !stateValue || savedState !== stateValue) {
    return clearCookies(redirectWithNotice(request, next, 'invalid_state'));
  }

  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return clearCookies(redirectWithNotice(request, next, 'config'));
  }

  try {
    const redirectUri = gitlabOAuthRedirectUri(origin);
    const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
    const tokenPayload = await exchangeGitLabCode({
      code: codeValue,
      clientId,
      clientSecret,
      redirectUri,
      baseUrl
    });
    const context = await resolveRequestActorContext(request);
    const persisted = await persistGitLabConnection({
      context,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
      expiresInSeconds: tokenPayload.expires_in
    });

    if (!persisted.ok) {
      return clearCookies(redirectWithNotice(request, next, persisted.error));
    }

    return clearCookies(redirectWithNotice(request, next, 'gitlab_connected'));
  } catch {
    return clearCookies(redirectWithNotice(request, next, 'oauth_failed'));
  }
}

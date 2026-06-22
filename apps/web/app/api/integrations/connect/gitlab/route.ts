import { NextResponse, type NextRequest } from 'next/server';

import {
  createOAuthState,
  gitlabAuthorizeUrl,
  integrationOAuthCookieNames
} from '@/lib/gitlab-oauth';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
  getRequestOrigin,
  gitlabOAuthRedirectUri
} from '@/lib/runtime-config';
import { resolveRequestActorContext } from '@/lib/server/request-context';

function safeNextPath(value: string | null, discover: boolean) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return discover ? '/app?tab=projects&discover=1' : '/app?tab=settings';
  }
  let path = value.includes('tab=') ? value : `${value}${value.includes('?') ? '&' : '?'}tab=settings`;
  if (discover && !path.includes('discover=1')) {
    path = `${path}${path.includes('?') ? '&' : '?'}discover=1`;
  }
  return path;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  const origin = getPublicAppOrigin(getRequestOrigin(request));
  const canonicalOrigin = getCanonicalLoopbackOrigin(getRequestOrigin(request));

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return NextResponse.redirect(canonicalUrl, 303);
  }

  if (!clientId || !clientSecret) {
    const redirectUrl = new URL('/app', origin);
    redirectUrl.searchParams.set('tab', 'settings');
    redirectUrl.searchParams.set('integration_notice', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await resolveRequestActorContext(request);
  } catch {
    const discover = request.nextUrl.searchParams.get('discover') === '1';
    const next = safeNextPath(request.nextUrl.searchParams.get('next'), discover);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }

  const discover = request.nextUrl.searchParams.get('discover') === '1';
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), discover);
  const state = createOAuthState();
  const redirectUri = gitlabOAuthRedirectUri(origin);
  const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
  const authorizeUrl = gitlabAuthorizeUrl({ clientId, redirectUri, state, baseUrl });
  const cookies = integrationOAuthCookieNames();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(cookies.state, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 600,
    path: '/'
  });
  response.cookies.set(cookies.next, next, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 600,
    path: '/'
  });

  return response;
}

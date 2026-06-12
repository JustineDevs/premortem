import { NextResponse, type NextRequest } from 'next/server';
import type { User, UserIdentity } from '@supabase/supabase-js';

import { hasActiveProviderConnection, resolveActorOrganization } from '@premortem/db';

import { authLinks, type AuthMode } from '@/lib/auth-links';
import { getPublicAppOrigin } from '@/lib/runtime-config';
import { isSupabaseAuthConfigured } from '@/lib/supabase/config';
import { createRouteHandlerSupabaseClient, type RouteHandlerSupabase } from '@/lib/supabase/route-handler';
import { persistGitLabConnection } from '@/lib/server/persist-gitlab-connection';
import type { RequestActorContext } from '@/lib/server/request-context';

function isAuthMode(value: string | null): value is AuthMode {
  return value === 'signup' || value === 'login';
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return authLinks.defaultNext;
  }
  return value;
}

function projectsDiscoverPath(next: string): string {
  const path = next.includes('tab=') ? next : '/app?tab=projects';
  return path.includes('discover=1')
    ? path
    : `${path}${path.includes('?') ? '&' : '?'}discover=1`;
}

async function actorContextFromUser(
  user: User,
  accessToken: string | null
): Promise<RequestActorContext> {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const resolved = await resolveActorOrganization(user.id, undefined, {
    email: user.email ?? null,
    fullName: typeof metadata.full_name === 'string' ? metadata.full_name : null,
    username: typeof metadata.user_name === 'string' ? metadata.user_name : null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email,
    accessToken
  };
}

function authFailureRedirect(
  authClient: RouteHandlerSupabase,
  origin: string,
  fallbackPath: string
) {
  const failureUrl = new URL(fallbackPath, origin);
  failureUrl.searchParams.set('error', 'callback');
  return authClient.attachCookies(NextResponse.redirect(failureUrl));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = getPublicAppOrigin(request.nextUrl.origin);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const mode = searchParams.get('mode');
  const fallbackPath =
    isAuthMode(mode) && mode === 'signup' ? authLinks.signup : authLinks.login;

  if (!code) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'callback');
    return NextResponse.redirect(redirectUrl);
  }

  if (!isSupabaseAuthConfigured()) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  const authClient = createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  const { error } = await authClient.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
    }
    return authFailureRedirect(authClient, origin, fallbackPath);
  }

  const {
    data: { user }
  } = await authClient.supabase.auth.getUser();
  const {
    data: { session }
  } = await authClient.supabase.auth.getSession();

  let redirectTarget = new URL(next, origin);

  const signedInWithGitLab =
    user?.app_metadata?.provider === 'gitlab' ||
    user?.identities?.some((identity: UserIdentity) => identity.provider === 'gitlab');

  if (
    user &&
    signedInWithGitLab &&
    process.env.GITLAB_CLIENT_ID &&
    process.env.GITLAB_CLIENT_SECRET
  ) {
    const context = await actorContextFromUser(user, session?.access_token ?? null);
    const hasGitLabIntegration = await hasActiveProviderConnection(
      context.organizationId,
      'gitlab'
    );

    if (!hasGitLabIntegration) {
      const providerToken = session?.provider_token ?? null;

      if (providerToken) {
        const persisted = await persistGitLabConnection({
          context,
          accessToken: providerToken,
          refreshToken: session?.provider_refresh_token
        });

        if (persisted.ok) {
          redirectTarget = new URL(projectsDiscoverPath(next), origin);
          redirectTarget.searchParams.set('integration_notice', 'gitlab_connected');
          return authClient.attachCookies(NextResponse.redirect(redirectTarget));
        }
      }

      redirectTarget = new URL('/api/integrations/connect/gitlab', origin);
      redirectTarget.searchParams.set('next', projectsDiscoverPath(next));
      redirectTarget.searchParams.set('discover', '1');
      return authClient.attachCookies(NextResponse.redirect(redirectTarget));
    }
  }

  return authClient.attachCookies(NextResponse.redirect(redirectTarget));
}

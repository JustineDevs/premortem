import { NextResponse, type NextRequest } from 'next/server';
import type { User, UserIdentity } from '@supabase/supabase-js';

import { isLocalAuthBypassEnabled } from '@premortem/domain';
import { hasActiveProviderConnection, markProfileOnboardingCompleted, resolveActorOrganization } from '@premortem/db';

import { authLinks, type AuthMode } from '@/lib/auth-links';
import { isSupabaseAuthConfigured } from '@/lib/supabase/server-config';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
  getRequestOrigin
} from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient, type RouteHandlerSupabase } from '@/lib/supabase/route-handler';
import { supabaseProfileHintsFromUser } from '@/lib/supabase/profile-hints';
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
  const resolved = await resolveActorOrganization(user.id, undefined, {
    ...supabaseProfileHintsFromUser(user),
    email: user.email ?? null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email,
    accessToken,
    role: resolved.role
  };
}

function authFailureRedirect(
  authClient: RouteHandlerSupabase,
  origin: string,
  fallbackPath: string,
  options?: { description?: string; code?: string }
) {
  const failureUrl = new URL(fallbackPath, origin);
  failureUrl.searchParams.set('error', 'callback');
  if (options?.description) {
    failureUrl.searchParams.set('error_description', options.description);
  }
  if (options?.code) {
    failureUrl.searchParams.set('error_code', options.code);
  }
  return authClient.attachCookies(NextResponse.redirect(failureUrl));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = getPublicAppOrigin(getRequestOrigin(request));
  const canonicalOrigin = getCanonicalLoopbackOrigin(getRequestOrigin(request));
  const code = searchParams.get('code');
  const callbackError = searchParams.get('error');
  const next = safeNextPath(searchParams.get('next'));
  const mode = searchParams.get('mode');
  const fallbackPath =
    isAuthMode(mode) && mode === 'signup' ? authLinks.signup : authLinks.login;

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return NextResponse.redirect(canonicalUrl, 303);
  }

  if (!(await isSupabaseAuthConfigured())) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  if (isLocalAuthBypassEnabled()) {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('mode', 'local_fixture');
    return NextResponse.redirect(redirectUrl);
  }

  const authClient = await createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  if (callbackError) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'callback');
    const errorDescription = searchParams.get('error_description');
    const errorCode = searchParams.get('error_code');
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription);
    }
    if (errorCode) {
      redirectUrl.searchParams.set('error_code', errorCode);
    }
    return authClient.attachCookies(NextResponse.redirect(redirectUrl));
  }

  if (code) {
    const { error } = await authClient.supabase.auth.exchangeCodeForSession(code);
    if (error && process.env.NODE_ENV !== 'production') {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
    }
    if (error) {
      const redirectUrl = new URL(fallbackPath, origin);
      redirectUrl.searchParams.set('error', 'callback');
      redirectUrl.searchParams.set('error_description', error.message);
      return authClient.attachCookies(NextResponse.redirect(redirectUrl));
    }
  }

  const {
    data: { user }
  } = await authClient.supabase.auth.getUser();
  const {
    data: { session }
  } = await authClient.supabase.auth.getSession();

  if (!user || !session) {
    if (!code) {
      return authFailureRedirect(authClient, origin, fallbackPath);
    }

    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'callback');
    redirectUrl.searchParams.set('error_description', 'Session exchange did not produce a user session.');
    return authClient.attachCookies(NextResponse.redirect(redirectUrl));
  }

  let redirectTarget = new URL(next, origin);

  const signedInWithGitLab =
    user?.app_metadata?.provider === 'gitlab' ||
    user?.identities?.some((identity: UserIdentity) => identity.provider === 'gitlab');

  await markProfileOnboardingCompleted(user.id).catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth/callback] onboarding completion failed:', error instanceof Error ? error.message : error);
    }
  });

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

import { NextResponse, type NextRequest } from 'next/server';

import { hasActiveProviderConnection, resolveActorOrganization } from '@premortem/db';

import { authLinks, type AuthMode } from '@/lib/auth-links';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function isAuthMode(value: string | null): value is AuthMode {
  return value === 'signup' || value === 'login';
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return authLinks.defaultNext;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
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

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'callback');
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const signedInWithGitLab =
    user?.app_metadata?.provider === 'gitlab' ||
    user?.identities?.some((identity) => identity.provider === 'gitlab');

  if (
    user &&
    signedInWithGitLab &&
    process.env.GITLAB_CLIENT_ID &&
    process.env.GITLAB_CLIENT_SECRET
  ) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const resolved = await resolveActorOrganization(user.id, undefined, {
      email: user.email ?? null,
      fullName: typeof metadata.full_name === 'string' ? metadata.full_name : null,
      username: typeof metadata.user_name === 'string' ? metadata.user_name : null
    });
    const hasGitLabIntegration = await hasActiveProviderConnection(
      resolved.organizationId,
      'gitlab'
    );

    if (!hasGitLabIntegration) {
      const projectsNext = next.includes('tab=') ? next : '/app?tab=projects';
      const connectUrl = new URL('/api/integrations/connect/gitlab', origin);
      connectUrl.searchParams.set('next', projectsNext);
      connectUrl.searchParams.set('discover', '1');
      return NextResponse.redirect(connectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}

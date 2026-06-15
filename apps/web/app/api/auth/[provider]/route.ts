import { NextResponse, type NextRequest } from 'next/server';

import { authLinks, type AuthMode, type AuthProvider } from '@/lib/auth-links';
import { getPublicAppOrigin } from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler';

const providers: Record<AuthProvider, 'gitlab' | 'github'> = {
  gitlab: 'gitlab',
  github: 'github'
};

function isAuthMode(value: string | null): value is AuthMode {
  return value === 'signup' || value === 'login';
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return authLinks.defaultNext;
  }
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as AuthProvider;

  if (!(provider in providers)) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const modeParam = request.nextUrl.searchParams.get('mode');
  const mode: AuthMode = isAuthMode(modeParam) ? modeParam : 'login';
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const origin = getPublicAppOrigin(request.nextUrl.origin);
  const fallbackPath = mode === 'signup' ? authLinks.signup : authLinks.login;

  const authClient = await createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  const callbackParams = new URLSearchParams({ next, mode });
  const redirectTo = `${origin}${authLinks.callback}?${callbackParams.toString()}`;

  const { data, error } = await authClient.supabase.auth.signInWithOAuth({
    provider: providers[provider],
    options: {
      redirectTo,
      scopes: provider === 'github' ? 'read:user repo' : 'read_user api read_repository'
    }
  });

  if (error || !data.url) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'oauth');
    return authClient.attachCookies(NextResponse.redirect(redirectUrl));
  }

  return authClient.attachCookies(NextResponse.redirect(data.url));
}

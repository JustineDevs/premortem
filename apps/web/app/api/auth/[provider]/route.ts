import { NextResponse, type NextRequest } from 'next/server';

import { authLinks, type AuthMode, type AuthProvider } from '@/lib/auth-links';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  { params }: { params: { provider: string } }
) {
  const provider = params.provider as AuthProvider;

  if (!(provider in providers)) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const modeParam = request.nextUrl.searchParams.get('mode');
  const mode: AuthMode = isAuthMode(modeParam) ? modeParam : 'login';
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const fallbackPath = mode === 'signup' ? authLinks.signup : authLinks.login;

  if (provider === 'github') {
    const redirectUrl = new URL(fallbackPath, request.url);
    redirectUrl.searchParams.set('notice', 'github-soon');
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const redirectUrl = new URL(fallbackPath, request.url);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl);
  }

  const origin = request.nextUrl.origin;
  const callbackParams = new URLSearchParams({ next, mode });
  const redirectTo = `${origin}${authLinks.callback}?${callbackParams.toString()}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providers[provider],
    options: {
      redirectTo,
      scopes: 'read_user read_api read_repository'
    }
  });

  if (error || !data.url) {
    const redirectUrl = new URL(fallbackPath, request.url);
    redirectUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(data.url);
}

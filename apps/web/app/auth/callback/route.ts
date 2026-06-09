import { NextResponse, type NextRequest } from 'next/server';

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

  return NextResponse.redirect(new URL(next, origin));
}

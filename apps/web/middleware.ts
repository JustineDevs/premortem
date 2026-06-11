import { NextResponse, type NextRequest } from 'next/server';
import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseAuthConfigured } from '@/lib/supabase/config';

const PROTECTED_PREFIXES = ['/app', '/audits'];

export async function middleware(request: NextRequest) {
  if (isLocalAuthBypassEnabled()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!isSupabaseAuthConfigured()) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/app/:path*', '/audits/:path*']
};

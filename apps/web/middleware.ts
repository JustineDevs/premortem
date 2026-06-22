import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isLocalAuthBypassEnabled } from '@premortem/domain';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname === '/app' ||
    pathname.startsWith('/app/') ||
    pathname === '/audits' ||
    pathname.startsWith('/audits/')
  );
}

function loginRedirectUrl(request: NextRequest): URL {
  const url = new URL('/login', request.url);
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return url;
}

export async function middleware(request: NextRequest) {
  if (isLocalAuthBypassEnabled() || !isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const config = await resolveSupabaseRuntimeConfig();
  if (!config) {
    return NextResponse.redirect(loginRedirectUrl(request));
  }

  const pendingCookies: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: {
      secure: request.nextUrl.protocol === 'https:'
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.push(cookie);
        }
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const response = NextResponse.redirect(loginRedirectUrl(request));
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  const response = NextResponse.next({ request });
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export const config = {
  matcher: [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth/:path*',
    '/app',
    '/app/:path*',
    '/audits',
    '/audits/:path*',
    '/api/auth/:path*',
    '/api/integrations/:path*'
  ]
};

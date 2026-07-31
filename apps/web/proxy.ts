import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isLocalAuthBypassEnabled } from '@premortem/domain';
import { NextResponse, type NextRequest } from 'next/server';
import { buildSecurityHeaders } from '@premortem/security';

// @ts-ignore Next/Vercel resolves this through the app webpack pipeline.
import { resolveSupabaseRuntimeConfig } from './src/lib/supabase/server-config';
import { ensureCsrfCookie } from './src/lib/csrf';

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

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(buildSecurityHeaders('web'))) {
    response.headers.set(key, value);
  }
  response.headers.set('x-premortem-app', 'premortem-web');
  return response;
}

export async function proxy(request: NextRequest) {
  if (isLocalAuthBypassEnabled() || !isProtectedRoute(request.nextUrl.pathname)) {
    return applySecurityHeaders(ensureCsrfCookie(NextResponse.next({ request }), request));
  }

  const config = await resolveSupabaseRuntimeConfig();

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
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    const response = applySecurityHeaders(ensureCsrfCookie(NextResponse.redirect(loginRedirectUrl(request)), request));
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  const response = applySecurityHeaders(ensureCsrfCookie(NextResponse.next({ request }), request));
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

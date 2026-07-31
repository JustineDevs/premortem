import { NextResponse, type NextRequest } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';
import { checkLoginThrottle } from '@premortem/security';

import { authLinks, type AuthMode, type AuthProvider } from '@/lib/auth-links';
import { assertValidCsrfRequest, ensureCsrfCookie } from '@/lib/csrf';
import {
  getCanonicalLoopbackOrigin,
  getAuthRedirectOrigin,
  getRequestOrigin
} from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler';

function isAuthMode(value: string | null): value is AuthMode {
  return value === 'signup' || value === 'login';
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return authLinks.defaultNext;
  }
  return value;
}

function buildAuthPageRedirect(origin: string, mode: AuthMode, next: string, notice: string) {
  const pagePath = mode === 'signup' ? authLinks.signup : authLinks.login;
  const redirectUrl = new URL(pagePath, origin);
  redirectUrl.searchParams.set('next', next);
  redirectUrl.searchParams.set('notice', notice);
  return NextResponse.redirect(redirectUrl, 303);
}

function withCsrfCookie(request: NextRequest, response: NextResponse) {
  return ensureCsrfCookie(response, request);
}

function wantsJsonResponse(request: NextRequest) {
  return request.headers.get('accept')?.includes('application/json') ?? false;
}

function providerResponse(request: NextRequest, url: URL | string, status = 200) {
  if (wantsJsonResponse(request)) {
    return withCsrfCookie(request, NextResponse.json({ url: url.toString() }, { status }));
  }

  return withCsrfCookie(request, NextResponse.redirect(url, 303));
}

async function readTermsAccepted(request: NextRequest): Promise<boolean> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const value = formData.get('termsAccepted') ?? formData.get('agreedToTerms');
      if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
      }
      return Boolean(value);
    }
  }

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => null);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const record = json as Record<string, unknown>;
      const value = record.termsAccepted ?? record.agreedToTerms;
      if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
      }
      return Boolean(value);
    }
  }

  return false;
}

async function startOAuth(request: NextRequest, provider: AuthProvider) {
  const modeParam = request.nextUrl.searchParams.get('mode');
  const mode: AuthMode = isAuthMode(modeParam) ? modeParam : 'login';
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const requestOrigin = getRequestOrigin(request);
  const origin = getAuthRedirectOrigin(requestOrigin);
  const canonicalOrigin = getCanonicalLoopbackOrigin(requestOrigin);
  const fallbackPath = mode === 'signup' ? authLinks.signup : authLinks.login;

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return providerResponse(request, canonicalUrl, 200);
  }

  if (request.method.toUpperCase() === 'POST') {
    const csrf = assertValidCsrfRequest(request);
    if (!csrf.passed) {
      return wantsJsonResponse(request)
        ? withCsrfCookie(request, NextResponse.json({ error: 'csrf' }, { status: 403 }))
        : withCsrfCookie(request, buildAuthPageRedirect(origin, mode, next, 'callback'));
    }

    const throttleKey = `${provider}:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'}`;
    const throttle = checkLoginThrottle(throttleKey, { limit: 6, windowMs: 10 * 60_000 });
    if (!throttle.allowed) {
      const redirect = wantsJsonResponse(request)
        ? NextResponse.json(
            {
              error: 'rate_limited',
              resetAt: throttle.resetAt
            },
            { status: 429 }
          )
        : buildAuthPageRedirect(origin, mode, next, 'callback');
      return withCsrfCookie(request, redirect);
    }
  }

  if (!(await readTermsAccepted(request))) {
    return wantsJsonResponse(request)
      ? withCsrfCookie(request, NextResponse.json({ error: 'terms' }, { status: 400 }))
      : withCsrfCookie(request, buildAuthPageRedirect(origin, mode, next, 'terms'));
  }

  if (isLocalAuthBypassEnabled()) {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('mode', 'local_fixture');
    return providerResponse(request, redirectUrl);
  }

  if (provider === 'github') {
    return wantsJsonResponse(request)
      ? withCsrfCookie(request, NextResponse.json({ error: 'coming_soon' }, { status: 200 }))
      : withCsrfCookie(request, buildAuthPageRedirect(origin, mode, next, 'coming_soon'));
  }

  const authClient = await createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return wantsJsonResponse(request)
      ? withCsrfCookie(request, NextResponse.json({ error: 'config' }, { status: 503 }))
      : withCsrfCookie(request, NextResponse.redirect(redirectUrl, 303));
  }

  const callbackParams = new URLSearchParams({ next, mode });
  const redirectTo = `${origin}${authLinks.callback}?${callbackParams.toString()}`;
  const scopes = provider === 'gitlab' ? 'read_user' : 'read:user user:email';

  const { data, error } = await authClient.supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes
    }
  });

  if (error || !data.url) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'oauth');
    const response = wantsJsonResponse(request)
      ? NextResponse.json({ error: 'oauth' }, { status: 500 })
      : NextResponse.redirect(redirectUrl, 303);
    return withCsrfCookie(request, authClient.attachCookies(response));
  }

  if (wantsJsonResponse(request)) {
    return withCsrfCookie(request, authClient.attachCookies(NextResponse.json({ url: data.url }, { status: 200 })));
  }

  return withCsrfCookie(request, authClient.attachCookies(NextResponse.redirect(data.url, 303)));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as AuthProvider;

  if (provider !== 'gitlab' && provider !== 'github') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  return startOAuth(request, provider);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as AuthProvider;

  if (provider !== 'gitlab' && provider !== 'github') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  return startOAuth(request, provider);
}

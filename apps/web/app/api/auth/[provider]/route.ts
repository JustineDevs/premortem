import { NextResponse, type NextRequest } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { authLinks, type AuthMode, type AuthProvider } from '@/lib/auth-links';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
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

function wantsJsonResponse(request: NextRequest) {
  return request.headers.get('accept')?.includes('application/json') ?? false;
}

function providerResponse(request: NextRequest, url: URL | string, status = 200) {
  if (wantsJsonResponse(request)) {
    return NextResponse.json({ url: url.toString() }, { status });
  }

  return NextResponse.redirect(url, 303);
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
  const origin = getPublicAppOrigin(getRequestOrigin(request));
  const canonicalOrigin = getCanonicalLoopbackOrigin(getRequestOrigin(request));
  const fallbackPath = mode === 'signup' ? authLinks.signup : authLinks.login;

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return providerResponse(request, canonicalUrl, 200);
  }

  if (!(await readTermsAccepted(request))) {
    return wantsJsonResponse(request)
      ? NextResponse.json({ error: 'terms' }, { status: 400 })
      : buildAuthPageRedirect(origin, mode, next, 'terms');
  }

  if (isLocalAuthBypassEnabled()) {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('mode', 'local_fixture');
    return providerResponse(request, redirectUrl);
  }

  if (provider === 'github') {
    return wantsJsonResponse(request)
      ? NextResponse.json({ error: 'coming_soon' }, { status: 200 })
      : buildAuthPageRedirect(origin, mode, next, 'coming_soon');
  }

  const authClient = await createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return wantsJsonResponse(request)
      ? NextResponse.json({ error: 'config' }, { status: 503 })
      : NextResponse.redirect(redirectUrl, 303);
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
    return authClient.attachCookies(response);
  }

  if (wantsJsonResponse(request)) {
    return authClient.attachCookies(NextResponse.json({ url: data.url }, { status: 200 }));
  }

  return authClient.attachCookies(NextResponse.redirect(data.url, 303));
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

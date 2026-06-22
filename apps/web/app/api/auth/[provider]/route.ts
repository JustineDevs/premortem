import { NextResponse, type NextRequest } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { authLinks, type AuthMode, type AuthProvider } from '@/lib/auth-links';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
  getRequestOrigin
} from '@/lib/runtime-config';
import { isTurnstileConfigured, isTurnstileEnabled, verifyTurnstileToken } from '@/lib/server/turnstile';
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

function buildAuthPageRedirect(origin: string, mode: AuthMode, next: string, notice: string) {
  const pagePath = mode === 'signup' ? authLinks.signup : authLinks.login;
  const redirectUrl = new URL(pagePath, origin);
  redirectUrl.searchParams.set('next', next);
  redirectUrl.searchParams.set('notice', notice);
  return NextResponse.redirect(redirectUrl, 303);
}

async function readTurnstileToken(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const value = formData.get('cf-turnstile-response') ?? formData.get('turnstileToken');
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => null);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const record = json as Record<string, unknown>;
      const token = record.turnstileToken ?? record['cf-turnstile-response'];
      if (typeof token === 'string' && token.trim()) {
        return token.trim();
      }
    }
  }

  return null;
}

async function startGitLabOAuth(request: NextRequest, provider: AuthProvider) {
  const modeParam = request.nextUrl.searchParams.get('mode');
  const mode: AuthMode = isAuthMode(modeParam) ? modeParam : 'login';
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const origin = getPublicAppOrigin(getRequestOrigin(request));
  const canonicalOrigin = getCanonicalLoopbackOrigin(getRequestOrigin(request));
  const fallbackPath = mode === 'signup' ? authLinks.signup : authLinks.login;

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return NextResponse.redirect(canonicalUrl, 303);
  }

  if (isLocalAuthBypassEnabled()) {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('mode', 'local_fixture');
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (isTurnstileEnabled()) {
    if (!isTurnstileConfigured()) {
      return buildAuthPageRedirect(origin, mode, next, 'captcha-config');
    }

    const token = await readTurnstileToken(request);
    const validation = await verifyTurnstileToken(token ?? '', request);
    if (!validation.success) {
      return buildAuthPageRedirect(origin, mode, next, 'captcha');
    }
  }

  const authClient = await createRouteHandlerSupabaseClient(request);
  if (!authClient) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(redirectUrl, 303);
  }

  const callbackParams = new URLSearchParams({ next, mode });
  const redirectTo = `${origin}${authLinks.callback}?${callbackParams.toString()}`;

  const { data, error } = await authClient.supabase.auth.signInWithOAuth({
    provider: providers[provider],
    options: {
      redirectTo,
      scopes: provider === 'github' ? 'read:user user:email' : 'read_user'
    }
  });

  if (error || !data.url) {
    const redirectUrl = new URL(fallbackPath, origin);
    redirectUrl.searchParams.set('error', 'oauth');
    return authClient.attachCookies(NextResponse.redirect(redirectUrl, 303));
  }

  return authClient.attachCookies(NextResponse.redirect(data.url, 303));
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

  return startGitLabOAuth(request, provider);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as AuthProvider;

  if (!(provider in providers)) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  return startGitLabOAuth(request, provider);
}

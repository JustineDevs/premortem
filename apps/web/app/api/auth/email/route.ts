import { NextResponse, type NextRequest } from 'next/server';

import { checkLoginThrottle } from '@premortem/security';
import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { authLinks, type AuthMode } from '@/lib/auth-links';
import { assertValidCsrfRequest, ensureCsrfCookie } from '@/lib/csrf';
import {
  getCanonicalLoopbackOrigin,
  getAuthRedirectOrigin,
  getRequestOrigin
} from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return authLinks.defaultNext;
  }
  return value;
}

function isAuthMode(value: unknown): value is AuthMode {
  return value === 'signup' || value === 'login';
}

function withCsrfCookie(request: NextRequest, response: NextResponse) {
  return ensureCsrfCookie(response, request);
}

function requestIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function json(request: NextRequest, payload: Record<string, unknown>, status = 200) {
  return withCsrfCookie(request, NextResponse.json(payload, { status }));
}

export async function POST(request: NextRequest) {
  const csrf = assertValidCsrfRequest(request);
  if (!csrf.passed) {
    return json(request, { error: csrf.reason ?? 'Invalid CSRF token' }, 403);
  }

  const requestOrigin = getRequestOrigin(request);
  const origin = getAuthRedirectOrigin(requestOrigin);
  const canonicalOrigin = getCanonicalLoopbackOrigin(requestOrigin);
  const body = (await request.json().catch(() => null)) as null | {
    email?: string;
    password?: string;
    confirmPassword?: string;
    mode?: unknown;
    action?: unknown;
    next?: string;
    termsAccepted?: unknown;
    agreedToTerms?: unknown;
  };

  if (canonicalOrigin && canonicalOrigin !== origin) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, canonicalOrigin);
    return withCsrfCookie(request, NextResponse.redirect(canonicalUrl, 303));
  }

  if (!body || typeof body.email !== 'string') {
    return json(request, { error: 'Missing email address' }, 400);
  }

  const next = safeNextPath(body.next ?? null);
  const mode = isAuthMode(body.mode) ? body.mode : 'login';
  const email = body.email.trim();
  const password = typeof body.password === 'string' ? body.password : '';
  const action = typeof body.action === 'string' ? body.action : password ? 'password' : 'magic-link';
  const agreedToTerms =
    body.termsAccepted === true ||
    body.termsAccepted === '1' ||
    body.termsAccepted === 'true' ||
    body.agreedToTerms === true ||
    body.agreedToTerms === '1' ||
    body.agreedToTerms === 'true';

  if (!agreedToTerms) {
    return json(request, { error: 'terms' }, 400);
  }

  const throttle = checkLoginThrottle(`email:${requestIp(request)}:${email.toLowerCase()}`, {
    limit: 6,
    windowMs: 10 * 60_000
  });
  if (!throttle.allowed) {
    return json(request, { error: 'rate_limited', resetAt: throttle.resetAt }, 429);
  }

  if (isLocalAuthBypassEnabled()) {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('mode', 'local_fixture');
    return withCsrfCookie(request, NextResponse.json({ ok: true, redirectTo: redirectUrl.toString(), fixture: true }));
  }

  const authClient = await createRouteHandlerSupabaseClient(request);

  try {
    if (action === 'password') {
      if (!password) {
        return json(request, { error: 'Missing password' }, 400);
      }

      if (mode === 'signup' && typeof body.confirmPassword === 'string' && body.confirmPassword !== password) {
        return json(request, { error: 'Passwords do not match.' }, 400);
      }

      if (mode === 'signup') {
        const { data, error } = await authClient.supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}${authLinks.callback}?next=${encodeURIComponent(next)}&mode=${mode}`
          }
        });

        if (error) {
          return json(request, { error: error.message }, 400);
        }

        if (data.session) {
          return withCsrfCookie(request, authClient.attachCookies(json(request, { ok: true, sessionEstablished: true, next }, 200)));
        }

        return withCsrfCookie(request, authClient.attachCookies(json(request, { ok: true, notice: 'email-confirmation-sent' }, 202)));
      }

      const { error } = await authClient.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return json(request, { error: error.message }, 400);
      }

      return withCsrfCookie(request, authClient.attachCookies(json(request, { ok: true, sessionEstablished: true, next }, 200)));
    }

    const { error } = await authClient.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}${authLinks.callback}?next=${encodeURIComponent(next)}&mode=${mode}`
      }
    });

    if (error) {
      return json(request, { error: error.message }, 400);
    }

    return withCsrfCookie(request, authClient.attachCookies(json(request, { ok: true, notice: 'email-magic-link-sent' }, 202)));
  } catch (error) {
    return json(
      request,
      {
        error: error instanceof Error ? error.message : 'Unable to complete email sign-in.'
      },
      500
    );
  }
}

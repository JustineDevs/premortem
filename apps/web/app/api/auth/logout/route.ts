import { NextResponse, type NextRequest } from 'next/server';

import { authLinks } from '@/lib/auth-links';
import { assertValidCsrfRequest, ensureCsrfCookie } from '@/lib/csrf';
import { getPublicAppOrigin, getRequestOrigin } from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler';

export async function POST(request: NextRequest) {
  const csrf = assertValidCsrfRequest(request);
  if (!csrf.passed) {
    return NextResponse.json({ error: csrf.reason ?? 'Invalid CSRF token' }, { status: 403 });
  }

  const authClient = await createRouteHandlerSupabaseClient(request);
  await authClient.supabase.auth.signOut();

  const redirect = ensureCsrfCookie(
    NextResponse.redirect(
    new URL(authLinks.login, getPublicAppOrigin(getRequestOrigin(request))),
    303
    ),
    request
  );
  return authClient.attachCookies(redirect);
}

import { NextResponse, type NextRequest } from 'next/server';

import { authLinks } from '@/lib/auth-links';
import { getPublicAppOrigin, getRequestOrigin } from '@/lib/runtime-config';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler';

export async function POST(request: NextRequest) {
  const authClient = await createRouteHandlerSupabaseClient(request);

  if (authClient) {
    await authClient.supabase.auth.signOut();
  }

  const redirect = NextResponse.redirect(
    new URL(authLinks.login, getPublicAppOrigin(getRequestOrigin(request))),
    303
  );
  return authClient ? authClient.attachCookies(redirect) : redirect;
}

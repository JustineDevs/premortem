import { NextResponse, type NextRequest } from 'next/server';

import { authLinks } from '@/lib/auth-links';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL(authLinks.login, request.url));
}

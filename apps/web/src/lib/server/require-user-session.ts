import { redirect } from 'next/navigation';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { authLinks } from '@/lib/auth-links';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireUserSession(nextPath: string) {
  if (isLocalAuthBypassEnabled()) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${authLinks.login}?next=${encodeURIComponent(nextPath)}`);
  }
}

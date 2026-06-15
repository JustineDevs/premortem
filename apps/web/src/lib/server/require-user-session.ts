import { redirect } from 'next/navigation';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { authLinks } from '@/lib/auth-links';
import { isSupabaseAuthConfigured } from '@/lib/supabase/server-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireUserSession(nextPath: string) {
  if (isLocalAuthBypassEnabled()) {
    return;
  }

  if (!(await isSupabaseAuthConfigured())) {
    redirect(`${authLinks.login}?next=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect(`${authLinks.login}?next=${encodeURIComponent(nextPath)}`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${authLinks.login}?next=${encodeURIComponent(nextPath)}`);
  }
}

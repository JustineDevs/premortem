import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

export async function createSupabaseServerClient() {
  const config = await resolveSupabaseRuntimeConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can fail in Server Components; route handlers can still set cookies.
        }
      }
    }
  });
}

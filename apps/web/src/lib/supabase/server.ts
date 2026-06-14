import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/config';

export function createSupabaseServerClient() {
  const config = resolveSupabaseRuntimeConfig();
  if (!config) {
    return null;
  }

  const cookieStore = cookies();

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

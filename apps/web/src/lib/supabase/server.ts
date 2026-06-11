import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { isSupabaseAuthConfigured } from '@/lib/supabase/config';

export function createSupabaseServerClient() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
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

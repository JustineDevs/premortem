import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export type RouteHandlerSupabase = {
  supabase: ReturnType<typeof createServerClient>;
  attachCookies: (response: NextResponse) => NextResponse;
};

export async function createRouteHandlerSupabaseClient(
  request: NextRequest
): Promise<RouteHandlerSupabase | null> {
  const config = await resolveSupabaseRuntimeConfig();
  if (!config) {
    return null;
  }

  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production'
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            const index = pendingCookies.findIndex((entry) => entry.name === cookie.name);
            if (index >= 0) {
              pendingCookies.splice(index, 1);
            }
            pendingCookies.push(cookie);
          }
        }
      }
    }
  );

  return {
    supabase,
    attachCookies(response: NextResponse) {
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    }
  };
}

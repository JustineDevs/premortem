import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient(
  config?: { url: string; anonKey: string } | null
) {
  if (browserClient) {
    return browserClient;
  }

  if (!config?.url || !config.anonKey) {
    throw new Error(
      'Supabase auth is required in the browser. Provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}

import { createBrowserClient } from '@supabase/ssr';

import { resolveSupabaseRuntimeConfig } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const config = resolveSupabaseRuntimeConfig();
  if (!config) {
    return null;
  }

  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}

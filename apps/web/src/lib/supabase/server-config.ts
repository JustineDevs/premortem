import { getCloudflareContext } from '@opennextjs/cloudflare';

import { readSupabaseRuntimeConfig, type SupabaseRuntimeConfig } from './config';

function readFromProcessEnv(): SupabaseRuntimeConfig | null {
  return readSupabaseRuntimeConfig(process.env as Record<string, unknown>);
}

let cachedCloudflareConfig: Promise<SupabaseRuntimeConfig | null> | null = null;

export async function resolveSupabaseRuntimeConfig(): Promise<SupabaseRuntimeConfig | null> {
  const fromProcessEnv = readFromProcessEnv();
  if (fromProcessEnv) {
    return fromProcessEnv;
  }

  if (!cachedCloudflareConfig) {
    cachedCloudflareConfig = (async () => {
      try {
        const context = await getCloudflareContext({ async: true });
        return readSupabaseRuntimeConfig(context.env as Record<string, unknown> | undefined);
      } catch {
        return null;
      }
    })();
  }

  return cachedCloudflareConfig;
}

export async function isSupabaseAuthConfigured() {
  return Boolean(await resolveSupabaseRuntimeConfig());
}

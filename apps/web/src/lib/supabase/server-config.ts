import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

function readSupabaseRuntimeConfig(env: Record<string, unknown> | undefined): SupabaseRuntimeConfig | null {
  if (!env) {
    return null;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

  if (typeof url !== 'string' || typeof anonKey !== 'string' || !url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    anonKey
  };
}

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

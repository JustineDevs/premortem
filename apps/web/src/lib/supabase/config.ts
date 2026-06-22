export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

export function readSupabaseRuntimeConfig(env: Record<string, unknown> | undefined): SupabaseRuntimeConfig | null {
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

export function resolveSupabaseRuntimeConfig(): SupabaseRuntimeConfig | null {
  return readSupabaseRuntimeConfig(process.env as Record<string, unknown>);
}

export function isSupabaseAuthConfigured() {
  return Boolean(resolveSupabaseRuntimeConfig());
}

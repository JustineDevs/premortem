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

export function requireSupabaseRuntimeConfig(env: Record<string, unknown> | undefined): SupabaseRuntimeConfig {
  const config = readSupabaseRuntimeConfig(env);
  if (!config) {
    throw new Error(
      'Supabase auth is required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_URL and SUPABASE_ANON_KEY.'
    );
  }
  return config;
}

export function resolveSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  return requireSupabaseRuntimeConfig(process.env as Record<string, unknown>);
}

export function isSupabaseAuthConfigured() {
  return Boolean(readSupabaseRuntimeConfig(process.env as Record<string, unknown>));
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

function resolveSupabaseRuntimePair() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url: url.replace(/\/$/, ''), anonKey };
}

export function createSupabaseConfig(): SupabaseConfig {
  const runtimePair = resolveSupabaseRuntimePair();
  if (!runtimePair) {
    throw new Error('Supabase env vars are missing');
  }

  return {
    url: runtimePair.url,
    anonKey: runtimePair.anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

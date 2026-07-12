import { createClient } from '@supabase/supabase-js';

export interface VerifiedSupabaseUser {
  id: string;
  email?: string | null;
}

const SUPABASE_USER_CACHE_TTL_MS = 60_000;
const supabaseUserCache = new Map<
  string,
  { expiresAt: number; user: VerifiedSupabaseUser | null }
>();
let supabaseAuthClient: ReturnType<typeof createClient> | undefined;

function supabaseAuthConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

function getSupabaseAuthClient() {
  if (supabaseAuthClient !== undefined) {
    return supabaseAuthClient;
  }

  const config = supabaseAuthConfig();
  if (!config) {
    throw new Error(
      'Supabase auth is required. Set SUPABASE_URL and SUPABASE_ANON_KEY or their NEXT_PUBLIC_ equivalents.'
    );
  }

  supabaseAuthClient = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return supabaseAuthClient;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export function extractApiKeyToken(request: Request): string | null {
  const header = request.headers.get('x-premortem-api-key') ?? request.headers.get('authorization');
  if (!header) return null;

  if (header.startsWith('ApiKey ')) {
    const token = header.slice('ApiKey '.length).trim();
    return token.length > 0 ? token : null;
  }

  if (request.headers.get('x-premortem-api-key')) {
    const token = header.trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

export async function verifySupabaseAccessToken(
  accessToken: string
): Promise<VerifiedSupabaseUser | null> {
  const client = getSupabaseAuthClient();
  if (!accessToken) return null;

  const cached = supabaseUserCache.get(accessToken);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  const user = data.user;
  if (error) {
    throw new Error(`Supabase auth failed to verify access token: ${error.message}`);
  }
  if (!user?.id) return null;

  const verified = { id: user.id, email: user.email ?? null };
  supabaseUserCache.set(accessToken, {
    expiresAt: now + SUPABASE_USER_CACHE_TTL_MS,
    user: verified
  });
  return verified;
}

export interface VerifiedSupabaseUser {
  id: string;
  email?: string | null;
}

function supabaseAuthConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function verifySupabaseAccessToken(
  accessToken: string
): Promise<VerifiedSupabaseUser | null> {
  const config = supabaseAuthConfig();
  if (!config || !accessToken) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: config.anonKey
    }
  });

  if (!response.ok) return null;

  const user = (await response.json()) as { id?: string; email?: string | null };
  if (!user?.id) return null;

  return { id: user.id, email: user.email ?? null };
}

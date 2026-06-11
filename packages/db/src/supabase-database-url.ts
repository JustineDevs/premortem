/**
 * Supabase free-tier Postgres: runtime uses transaction pooler (:6543),
 * migrations use session pooler (:5432) on the same pooler host — not db.*.supabase.co direct.
 */

function toUrl(raw: string): URL {
  return new URL(raw.replace(/^postgresql:/i, 'postgres:'));
}

function fromUrl(url: URL): string {
  return url.toString().replace(/^postgres:/i, 'postgresql:');
}

function isDirectSupabaseHost(hostname: string): boolean {
  return hostname.endsWith('.supabase.co') && hostname.startsWith('db.');
}

function isPoolerHost(hostname: string): boolean {
  return hostname.includes('.pooler.supabase.com');
}

function isLocalPostgresHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'postgres';
}

export function shouldNormalizeSupabaseDatabaseUrl(raw: string): boolean {
  const url = toUrl(raw);
  if (isLocalPostgresHost(url.hostname)) return false;
  return isPoolerHost(url.hostname) || isDirectSupabaseHost(url.hostname);
}

/** Transaction mode for Prisma runtime queries (port 6543 + pgbouncer=true). */
export function normalizeTransactionPoolerUrl(raw: string, env: NodeJS.ProcessEnv = process.env): string {
  const url = toUrl(raw);

  if (!shouldNormalizeSupabaseDatabaseUrl(raw)) {
    return fromUrl(url);
  }

  if (isDirectSupabaseHost(url.hostname)) {
    throw new Error(
      'DATABASE_URL points at Supabase direct host (db.*.supabase.co). ' +
        'On free tier use the transaction pooler instead: ' +
        'aws-[n]-[region].pooler.supabase.com:6543/postgres?pgbouncer=true'
    );
  }

  if (isPoolerHost(url.hostname)) {
    url.port = '6543';
  }

  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('sslmode', 'require');
  const isServerless =
    env?.VERCEL === '1' ||
    env?.AWS_LAMBDA_FUNCTION_NAME ||
    env?.PREMORTEM_SERVERLESS === '1';
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', isServerless ? '1' : '5');
  } else if (!isServerless && url.searchParams.get('connection_limit') === '1') {
    url.searchParams.set('connection_limit', '5');
  }

  return fromUrl(url);
}

/** Session mode for Prisma migrations (port 5432 on pooler host, no pgbouncer flag). */
export function normalizeSessionPoolerUrl(raw: string, transactionUrl?: string): string {
  let url = toUrl(raw);

  if (!shouldNormalizeSupabaseDatabaseUrl(raw)) {
    return fromUrl(url);
  }

  if (isDirectSupabaseHost(url.hostname)) {
    if (!transactionUrl) {
      throw new Error(
        'DIRECT_URL points at Supabase direct host (db.*.supabase.co). ' +
          'Use session pooler on the same host as DATABASE_URL: pooler.supabase.com:5432/postgres'
      );
    }
    url = new URL(toUrl(transactionUrl).toString());
  }

  if (isPoolerHost(url.hostname)) {
    url.port = '5432';
  }

  url.searchParams.delete('pgbouncer');
  url.searchParams.set('sslmode', 'require');

  return fromUrl(url);
}

export function deriveSessionPoolerFromTransaction(transactionUrl: string): string {
  if (!shouldNormalizeSupabaseDatabaseUrl(transactionUrl)) {
    return transactionUrl;
  }

  const url = toUrl(transactionUrl);
  url.port = '5432';
  url.searchParams.delete('pgbouncer');
  url.searchParams.set('sslmode', 'require');
  return fromUrl(url);
}

export function applySupabaseDatabaseEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (env.DATABASE_URL && shouldNormalizeSupabaseDatabaseUrl(env.DATABASE_URL)) {
    env.DATABASE_URL = normalizeTransactionPoolerUrl(env.DATABASE_URL, env);
  }

  if (env.DIRECT_URL && shouldNormalizeSupabaseDatabaseUrl(env.DIRECT_URL)) {
    env.DIRECT_URL = normalizeSessionPoolerUrl(env.DIRECT_URL, env.DATABASE_URL);
  } else if (env.DIRECT_URL) {
    // keep local/docker DIRECT_URL as-is
  } else if (env.DATABASE_URL && shouldNormalizeSupabaseDatabaseUrl(env.DATABASE_URL)) {
    env.DIRECT_URL = deriveSessionPoolerFromTransaction(env.DATABASE_URL);
  } else if (env.DATABASE_URL && !env.DIRECT_URL) {
    env.DIRECT_URL = env.DATABASE_URL;
  }

  return env;
}

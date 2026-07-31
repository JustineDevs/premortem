const PRODUCTION_REQUIRED_ENV = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_WEBHOOK_SECRET'
] as const;

const STRICT_OPTIONAL_ENV = [
  'AUTH_JWT_SECRET',
  'SENTRY_DSN'
] as const;

function hasTrimmedEnv(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function hasSupabaseOAuthEnv(env: NodeJS.ProcessEnv): boolean {
  return hasTrimmedEnv(env, 'NEXT_PUBLIC_SUPABASE_URL') && hasTrimmedEnv(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

function hasLlmEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.OPENROUTER_API_KEY?.trim() ||
      env.OPEN_ROUTER_API_KEY?.trim() ||
      env.GEMINI_API_KEY?.trim() ||
      env.OPENAI_API_KEY?.trim() ||
      env.ANTHROPIC_API_KEY?.trim()
  );
}

function hasGitLabEnv(env: NodeJS.ProcessEnv): boolean {
  return (
    Boolean(env.GITLAB_TOKEN?.trim()) ||
    Boolean(env.GITLAB_CLIENT_ID?.trim() && env.GITLAB_CLIENT_SECRET?.trim())
  );
}

function collectProductionBootEnvIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.PREMORTEM_PRODUCTION_MODE !== '1') return [];

  const missing: string[] = [];
  for (const key of [
    ...PRODUCTION_REQUIRED_ENV,
    'DIRECT_URL',
    'NEO4J_URI',
    'NEO4J_PASSWORD',
    'SENTRY_DSN',
    'NEXT_PUBLIC_POSTHOG_KEY'
  ] as const) {
    if (!hasTrimmedEnv(env, key)) missing.push(key);
  }

  if (!hasSupabaseOAuthEnv(env)) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (!hasLlmEnv(env)) {
    missing.push('OPENROUTER_API_KEY or GEMINI_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  if (!hasGitLabEnv(env)) {
    missing.push('GITLAB_TOKEN or GITLAB_CLIENT_ID/SECRET');
  }

  if (env.NEO4J_DISABLED === '1') {
    missing.push('NEO4J_DISABLED must be unset when PREMORTEM_PRODUCTION_MODE=1');
  }

  if (env.PREMORTEM_AUTH_DISABLED === '1') {
    missing.push('PREMORTEM_AUTH_DISABLED must be unset when PREMORTEM_PRODUCTION_MODE=1');
  }

  return missing;
}

export function checkRequiredEnv(options?: { production?: boolean }): string[] {
  const production = options?.production ?? process.env.NODE_ENV === 'production';
  if (!production) return [];

  const missing = [
    ...collectProductionBootEnvIssues(process.env),
    ...STRICT_OPTIONAL_ENV.filter((key) => !process.env[key]?.trim())
  ];

  return Array.from(new Set(missing));
}

export function assertRequiredEnv(options?: { production?: boolean }): void {
  const missing = checkRequiredEnv(options);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/** Strict production behavior: real GitLab, LLM, Neo4j, and publish — no mock bypasses. */
export function isProductionMode(): boolean {
  return process.env.PREMORTEM_PRODUCTION_MODE === '1';
}

/** Smoke/CI harness only: bypass Supabase and use LOCAL_DEV_FIXTURE IDs. */
export function isLocalAuthBypassEnabled(): boolean {
  return process.env.PREMORTEM_AUTH_DISABLED === '1' && !isProductionMode();
}

function hasSupabaseAuthEnv(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim()
  );
}

export function isSupabaseAuthConfiguredInEnv(): boolean {
  return hasSupabaseAuthEnv();
}

/** Seed LOCAL_DEV_FIXTURE rows only when auth bypass is explicitly enabled. */
export function shouldSeedLocalDevFixture(): boolean {
  return isLocalAuthBypassEnabled();
}

/**
 * Configured local dev with Supabase: real user IDs from OAuth, personal workspace on first login.
 * Smoke scripts opt out via PREMORTEM_SMOKE_USE_FIXTURE=1.
 */
export function prefersRealUserAuth(): boolean {
  if (process.env.PREMORTEM_SMOKE_USE_FIXTURE === '1') return false;
  return isSupabaseAuthConfiguredInEnv() && hasConfiguredRuntimeCredentials();
}

/** True when `.env.local` has enough credentials to run real ingest + LLM without mocks. */
export function hasConfiguredRuntimeCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  const hasDb = Boolean(env.DATABASE_URL?.trim());
  const hasGitlab = Boolean(env.GITLAB_TOKEN?.trim());
  const hasLlm = Boolean(
    env.OPENROUTER_API_KEY?.trim() ||
      env.OPEN_ROUTER_API_KEY?.trim() ||
      env.GEMINI_API_KEY?.trim() ||
      env.OPENAI_API_KEY?.trim() ||
      env.ANTHROPIC_API_KEY?.trim()
  );
  return hasDb && hasGitlab && hasLlm;
}

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

export function collectProductionBootEnvIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.PREMORTEM_PRODUCTION_MODE !== '1') return [];

  const missing: string[] = [];
  for (const key of [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEO4J_URI',
    'NEO4J_PASSWORD',
    'STRIPE_WEBHOOK_SECRET',
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

  if (!hasTrimmedEnv(env, 'NANGO_SECRET_KEY') && !hasTrimmedEnv(env, 'NANGO_API_KEY')) {
    missing.push('NANGO_SECRET_KEY');
  }

  if (env.NEO4J_DISABLED === '1') {
    missing.push('NEO4J_DISABLED must be unset when PREMORTEM_PRODUCTION_MODE=1');
  }

  if (env.PREMORTEM_AUTH_DISABLED === '1') {
    missing.push('PREMORTEM_AUTH_DISABLED must be unset when PREMORTEM_PRODUCTION_MODE=1');
  }

  return missing;
}

function envFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim();
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

function resolveIngestBypassFlag(envName: string): boolean {
  const flag = envFlag(envName);
  if (flag === true) return true;
  if (flag === false) return false;
  return !hasConfiguredRuntimeCredentials();
}

export function validateProductionBootEnv(): string[] {
  if (!isProductionMode()) return [];

  return collectProductionBootEnvIssues(process.env);
}

export function allowsMockExecutor(): boolean {
  return !isProductionMode() && process.env.PREMORTEM_EXECUTOR === 'mock';
}

export function allowsLocalIngestBypass(): boolean {
  if (isProductionMode()) return false;
  return resolveIngestBypassFlag('PREMORTEM_INGEST_LOCAL');
}

/** When set, local filesystem ingest wins even if GitLab credentials exist (dev-only). */
export function allowsForceLocalIngest(): boolean {
  if (isProductionMode()) return false;
  return resolveIngestBypassFlag('PREMORTEM_FORCE_LOCAL_INGEST');
}

export function allowsPublishDryRun(): boolean {
  return !isProductionMode() && process.env.PREMORTEM_PUBLISH_DRY_RUN === '1';
}

/** Dev/smoke paths may exercise publish without Starter billing enforcement. */
export function skipsPublishEntitlementCheck(): boolean {
  if (isProductionMode()) return false;
  if (allowsPublishDryRun()) return true;
  if (isLocalAuthBypassEnabled()) return true;
  if (hasConfiguredRuntimeCredentials()) return true;
  return false;
}

export function allowsReconcileDryRun(): boolean {
  return !isProductionMode() && process.env.PREMORTEM_RECONCILE_DRY_RUN === '1';
}

/** When `.env.local` is fully populated, prefer real GitLab + LLM paths for dev and smoke. */
export function applyConfiguredDevDefaults(env: NodeJS.ProcessEnv = process.env) {
  if (env.PREMORTEM_PRODUCTION_MODE === '1' || !hasConfiguredRuntimeCredentials(env)) {
    return { mode: env.PREMORTEM_PRODUCTION_MODE === '1' ? 'production' : 'fixture' };
  }

  if (env.PREMORTEM_INGEST_LOCAL === undefined) delete env.PREMORTEM_INGEST_LOCAL;
  if (env.PREMORTEM_FORCE_LOCAL_INGEST === undefined) delete env.PREMORTEM_FORCE_LOCAL_INGEST;
  env.PREMORTEM_EXECUTOR ??= 'llm';
  env.NEO4J_DISABLED ??= '0';

  const hasSupabase = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
  if (
    hasSupabase &&
    env.PREMORTEM_SMOKE_USE_FIXTURE !== '1' &&
    env.PREMORTEM_AUTH_DISABLED !== '1'
  ) {
    delete env.PREMORTEM_AUTH_DISABLED;
  }

  return { mode: 'configured' };
}

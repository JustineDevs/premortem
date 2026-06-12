/** Strict production behavior: real GitLab, LLM, Neo4j, and publish — no mock bypasses. */
export function isProductionMode(): boolean {
  return process.env.PREMORTEM_PRODUCTION_MODE === '1';
}

/** Smoke/CI harness only: bypass Supabase and use LOCAL_DEV_FIXTURE IDs. */
export function isLocalAuthBypassEnabled(): boolean {
  return process.env.PREMORTEM_AUTH_DISABLED === '1' && !isProductionMode();
}

export function isSupabaseAuthConfiguredInEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
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
export function hasConfiguredRuntimeCredentials(): boolean {
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  const hasGitlab = Boolean(process.env.GITLAB_TOKEN?.trim());
  const hasLlm =
    Boolean(process.env.GEMINI_API_KEY?.trim()) ||
    Boolean(
      process.env.AZURE_OPENAI_ENDPOINT?.trim() &&
        process.env.AZURE_OPENAI_API_KEY?.trim() &&
        (process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || process.env.AZURE_OPENAI_MODEL?.trim())
    );
  return hasDb && hasGitlab && hasLlm;
}

function envFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim();
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

export function validateProductionBootEnv(): string[] {
  if (!isProductionMode()) return [];

  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENCRYPTION_KEY',
    'NEO4J_URI',
    'NEO4J_PASSWORD'
  ] as const;

  const missing: string[] = required.filter((key) => !process.env[key]?.trim());

  const hasLlm =
    Boolean(process.env.GEMINI_API_KEY?.trim()) ||
    Boolean(
      process.env.AZURE_OPENAI_ENDPOINT?.trim() &&
        process.env.AZURE_OPENAI_API_KEY?.trim() &&
        process.env.AZURE_OPENAI_DEPLOYMENT?.trim()
    );
  if (!hasLlm) {
    missing.push('GEMINI_API_KEY or AZURE_OPENAI_*');
  }

  const hasGitLab =
    Boolean(process.env.GITLAB_TOKEN?.trim()) ||
    Boolean(process.env.GITLAB_CLIENT_ID?.trim() && process.env.GITLAB_CLIENT_SECRET?.trim());
  if (!hasGitLab) {
    missing.push('GITLAB_TOKEN or GITLAB_CLIENT_ID/SECRET');
  }

  if (process.env.PREMORTEM_AUTH_DISABLED === '1') {
    missing.push('PREMORTEM_AUTH_DISABLED must be unset when PREMORTEM_PRODUCTION_MODE=1');
  }

  return missing;
}

export function allowsMockExecutor(): boolean {
  return !isProductionMode() && process.env.PREMORTEM_EXECUTOR === 'mock';
}

export function allowsLocalIngestBypass(): boolean {
  if (isProductionMode()) return false;
  const flag = envFlag('PREMORTEM_INGEST_LOCAL');
  if (flag === true) return true;
  if (flag === false) return false;
  return !hasConfiguredRuntimeCredentials();
}

/** When set, local filesystem ingest wins even if GitLab credentials exist (dev-only). */
export function allowsForceLocalIngest(): boolean {
  if (isProductionMode()) return false;
  const flag = envFlag('PREMORTEM_FORCE_LOCAL_INGEST');
  if (flag === true) return true;
  if (flag === false) return false;
  return !hasConfiguredRuntimeCredentials();
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

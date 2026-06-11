/**
 * Keep in sync with hasConfiguredRuntimeCredentials() in packages/domain/src/production-mode.ts
 */

export function hasConfiguredRuntimeCredentials(env = process.env) {
  const hasDb = Boolean(env.DATABASE_URL?.trim());
  const hasGitlab = Boolean(env.GITLAB_TOKEN?.trim());
  const hasLlm =
    Boolean(env.GEMINI_API_KEY?.trim()) ||
    Boolean(
      env.AZURE_OPENAI_ENDPOINT?.trim() &&
        env.AZURE_OPENAI_API_KEY?.trim() &&
        (env.AZURE_OPENAI_DEPLOYMENT?.trim() || env.AZURE_OPENAI_MODEL?.trim())
    );
  return hasDb && hasGitlab && hasLlm;
}

/** When `.env.local` is fully populated, prefer real GitLab + LLM paths for dev and smoke. */
export function applyConfiguredDevDefaults(env = process.env) {
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
  // Real integrations + Supabase: onboard actual users; smoke harness sets PREMORTEM_SMOKE_USE_FIXTURE=1.
  if (hasSupabase && env.PREMORTEM_SMOKE_USE_FIXTURE !== '1') {
    delete env.PREMORTEM_AUTH_DISABLED;
  }

  return { mode: 'configured' };
}

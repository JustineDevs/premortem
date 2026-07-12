function hasTrimmedEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasPostHogKey() {
  return Boolean(
    process.env.POSTHOG_API_KEY?.trim()?.startsWith('phc_') ||
      process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()?.startsWith('phc_')
  );
}

function hasPhoenixConfig() {
  return Boolean(process.env.PHOENIX_API_KEY?.trim()) && Boolean(
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() || process.env.PHOENIX_BASE_URL?.trim()
  );
}

function hasLangfuseConfig() {
  return hasTrimmedEnv('LANGFUSE_PUBLIC_KEY') && hasTrimmedEnv('LANGFUSE_SECRET_KEY');
}

export function collectCoreObservabilityIssues(): string[] {
  const missing: string[] = [];

  if (!hasTrimmedEnv('SENTRY_DSN')) {
    missing.push('SENTRY_DSN');
  }

  if (!hasPostHogKey()) {
    missing.push('POSTHOG_API_KEY or NEXT_PUBLIC_POSTHOG_KEY');
  }

  if (!hasPhoenixConfig()) {
    missing.push('PHOENIX_API_KEY and PHOENIX_COLLECTOR_ENDPOINT or PHOENIX_BASE_URL');
  }

  if (!hasLangfuseConfig()) {
    missing.push('LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY');
  }

  return missing;
}

export function assertCoreObservabilityConfigured(): void {
  const missing = collectCoreObservabilityIssues();
  if (missing.length > 0) {
    throw new Error(`Core observability is required and must be configured: ${missing.join(', ')}`);
  }
}

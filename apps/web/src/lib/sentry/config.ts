function parseSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1';
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0.1;
}

function isPhoenixPrimaryEnabled() {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
      process.env.PHOENIX_OTEL_ENABLED === '1'
  );
}

export function getSentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  return dsn && dsn.trim().length > 0 ? dsn : undefined;
}

export function getBaseSentryOptions() {
  const dsn = getSentryDsn();
  const phoenixPrimary = isPhoenixPrimaryEnabled();

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseSampleRate(),
    ignoreErrors: ['NEXT_REDIRECT', 'NEXT_NOT_FOUND'],
    // Phoenix owns OpenInference export; avoid duplicate auto.fetch ERROR spans in Arize.
    skipOpenTelemetrySetup: phoenixPrimary
  };
}

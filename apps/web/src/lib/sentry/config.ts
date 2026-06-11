function parseSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1';
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0.1;
}

export function getSentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  return dsn && dsn.trim().length > 0 ? dsn : undefined;
}

export function getBaseSentryOptions() {
  const dsn = getSentryDsn();

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseSampleRate()
  };
}

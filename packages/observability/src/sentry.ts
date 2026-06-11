import * as Sentry from '@sentry/node';

import { initPhoenixTracing } from './phoenix';

let sentryInitialized = false;

export function initServerObservability(serviceName: string) {
  initPhoenixTracing(serviceName);

  const dsn = process.env.SENTRY_DSN;
  if (!dsn || sentryInitialized) return;

  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    initialScope: {
      tags: { service: serviceName }
    }
  });
  sentryInitialized = true;
}

export function captureServerException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error('captureServerException', error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

export function captureServerMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}

import * as Sentry from '@sentry/node';
import { nativeNodeFetchIntegration, type NodeOptions } from '@sentry/node';

import { isPhoenixEnabled, initPhoenixTracing } from './phoenix';

let sentryInitialized = false;

function gitLabFetchUrl(url: string) {
  return /gitlab\.com\/api\/v4/i.test(url) || /\/api\/v4\/projects\//i.test(url);
}

export function getServerSentryInitOptions(serviceName: string): NodeOptions {
  const phoenixPrimary = isPhoenixEnabled();

  return {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    initialScope: {
      tags: { service: serviceName }
    },
    // Phoenix owns OpenInference export; avoid duplicate auto.fetch ERROR spans in Arize.
    skipOpenTelemetrySetup: phoenixPrimary,
    integrations: (integrations) => {
      if (!phoenixPrimary) return integrations;

      return integrations.map((integration) => {
        if (integration.name !== 'NodeFetch') return integration;

        return nativeNodeFetchIntegration({
          spans: false,
          breadcrumbs: true,
          ignoreOutgoingRequests: gitLabFetchUrl
        });
      });
    }
  };
}

export function initServerObservability(serviceName: string) {
  initPhoenixTracing(serviceName);

  const dsn = process.env.SENTRY_DSN;
  if (!dsn || sentryInitialized) return;

  Sentry.init(getServerSentryInitOptions(serviceName));
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

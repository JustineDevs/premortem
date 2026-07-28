import * as Sentry from '@sentry/node';
import type { SeverityLevel, NodeOptions } from '@sentry/node';

let sentryInitialized = false;
let sentryInitPromise: Promise<void> | undefined;

function shouldInitializeSentry() {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function isWorkerLikeRuntime() {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined';
}

function gitLabFetchUrl(url: string) {
  return /gitlab\.com\/api\/v4/i.test(url) || /\/api\/v4\/projects\//i.test(url);
}

export function getServerSentryInitOptions(serviceName: string): NodeOptions {
  return {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    initialScope: {
      tags: { service: serviceName }
    },
    skipOpenTelemetrySetup: Boolean(
      process.env.PHOENIX_API_KEY?.trim() ||
        process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
        process.env.PHOENIX_OTEL_ENABLED === '1'
    )
  };
}

export async function initServerObservability(serviceName: string) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    throw new Error('Sentry is required. Set SENTRY_DSN before starting the service.');
  }
  if (sentryInitialized || isWorkerLikeRuntime() || !shouldInitializeSentry()) return;
  if (sentryInitPromise) return sentryInitPromise;

  sentryInitPromise = (async () => {
    const options = getServerSentryInitOptions(serviceName);
    if (options.skipOpenTelemetrySetup) {
      options.integrations = (integrations) =>
        integrations.map((integration) => {
          if (integration.name !== 'NodeFetch') return integration;

          return Sentry.nativeNodeFetchIntegration({
            spans: false,
            breadcrumbs: true,
            ignoreOutgoingRequests: gitLabFetchUrl
          });
        });
    }

    Sentry.init(options);
    sentryInitialized = true;
  })();

  try {
    await sentryInitPromise;
  } finally {
    sentryInitPromise = undefined;
  }
}

export function captureServerException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN || isWorkerLikeRuntime() || !shouldInitializeSentry()) {
    throw new Error('Sentry is required. Set SENTRY_DSN before capturing server exceptions.');
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

export function captureServerMessage(message: string, level: SeverityLevel = 'info') {
  if (!process.env.SENTRY_DSN || isWorkerLikeRuntime() || !shouldInitializeSentry()) {
    throw new Error('Sentry is required. Set SENTRY_DSN before capturing server messages.');
  }
  Sentry.captureMessage(message, level);
}

export async function probeSentryDelivery(
  serviceName = 'premortem-observability-smoke',
  message = 'premortem-observability-smoke'
) {
  await initServerObservability(serviceName);
  Sentry.captureMessage(message, 'info');
  await Sentry.flush(5000);
}

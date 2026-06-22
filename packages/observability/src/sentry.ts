import type { SeverityLevel } from '@sentry/node';
import type { NodeOptions } from '@sentry/node';

let sentryInitialized = false;
let sentryModulePromise: Promise<typeof import('@sentry/node')> | undefined;

function shouldInitializeSentry() {
  return (process.env.APP_ENV ?? process.env.NODE_ENV) === 'production';
}

function loadSentryModule() {
  sentryModulePromise ??= import('@sentry/node');
  return sentryModulePromise;
}

function isCloudflareWorkerRuntime() {
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

export function initServerObservability(serviceName: string) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || sentryInitialized || isCloudflareWorkerRuntime() || !shouldInitializeSentry()) return;

  void loadSentryModule()
    .then((Sentry) => {
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
    })
    .catch((error) => {
      console.error('initServerObservability.sentry-load-failed', error);
    });
}

export function captureServerException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN || isCloudflareWorkerRuntime() || !shouldInitializeSentry()) {
    console.error('captureServerException', error, context);
    return;
  }

  void loadSentryModule()
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context) {
          for (const [key, value] of Object.entries(context)) {
            scope.setExtra(key, value);
          }
        }
        Sentry.captureException(error);
      });
    })
    .catch((loadError) => {
      console.error('captureServerException.sentry-load-failed', loadError, error, context);
    });
}

export function captureServerMessage(message: string, level: SeverityLevel = 'info') {
  if (!process.env.SENTRY_DSN || isCloudflareWorkerRuntime() || !shouldInitializeSentry()) return;
  void loadSentryModule()
    .then((Sentry) => {
      Sentry.captureMessage(message, level);
    })
    .catch((error) => {
      console.error('captureServerMessage.sentry-load-failed', error, message, level);
    });
}

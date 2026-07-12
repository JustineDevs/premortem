import type { SeverityLevel } from '@sentry/node';
import type { NodeOptions } from '@sentry/node';

let sentryInitialized = false;
let sentryModulePromise: Promise<typeof import('@sentry/node')> | undefined;
let sentryInitPromise: Promise<void> | undefined;

function shouldInitializeSentry() {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function loadSentryModule() {
  const loader = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<typeof import('@sentry/node')>;
  sentryModulePromise ??= loader('@sentry/node');
  return sentryModulePromise;
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
    const Sentry = await loadSentryModule();
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
      throw loadError;
    });
}

export function captureServerMessage(message: string, level: SeverityLevel = 'info') {
  if (!process.env.SENTRY_DSN || isWorkerLikeRuntime() || !shouldInitializeSentry()) {
    throw new Error('Sentry is required. Set SENTRY_DSN before capturing server messages.');
  }
  void loadSentryModule()
    .then((Sentry) => {
      Sentry.captureMessage(message, level);
    })
    .catch((error) => {
      throw error;
    });
}

export async function probeSentryDelivery(
  serviceName = 'premortem-observability-smoke',
  message = 'premortem-observability-smoke'
) {
  await initServerObservability(serviceName);
  const Sentry = await loadSentryModule();
  Sentry.captureMessage(message, 'info');
  await Sentry.flush(5000);
}

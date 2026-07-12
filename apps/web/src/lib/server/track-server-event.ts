import { CanonicalEvents } from '@premortem/observability/events';

export { CanonicalEvents };

function resolvePostHogProjectKey() {
  const candidates = [process.env.POSTHOG_API_KEY, process.env.NEXT_PUBLIC_POSTHOG_KEY];
  for (const key of candidates) {
    const trimmed = key?.trim();
    if (trimmed?.startsWith('phc_')) return trimmed;
  }

  throw new Error(
    'PostHog is required. Set POSTHOG_API_KEY or NEXT_PUBLIC_POSTHOG_KEY to a phc_ project key.'
  );
}

function resolvePostHogHost() {
  return (
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    'https://us.i.posthog.com'
  ).replace(/\/+$/, '');
}

export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const apiKey = resolvePostHogProjectKey();
  const response = await fetch(`${resolvePostHogHost()}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      distinct_id: distinctId,
      event,
      properties: {
        source: 'server',
        ...properties
      },
      timestamp: new Date().toISOString()
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed: ${response.status} ${await response.text()}`);
  }
}

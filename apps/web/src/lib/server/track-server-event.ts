import { CanonicalEvents } from '@/lib/canonical/events';

export { CanonicalEvents };

function resolvePostHogProjectKey() {
  const candidates = [process.env.POSTHOG_API_KEY, process.env.NEXT_PUBLIC_POSTHOG_KEY];
  for (const key of candidates) {
    const trimmed = key?.trim();
    if (trimmed?.startsWith('phc_')) return trimmed;
  }
  return null;
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
  if (!apiKey) return;

  try {
    await fetch(`${resolvePostHogHost()}/capture/`, {
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
  } catch (error) {
    console.error('trackServerEvent failed', error);
  }
}

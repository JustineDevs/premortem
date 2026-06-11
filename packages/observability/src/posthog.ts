import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

/** PostHog capture/evaluate requires a project key (`phc_`), not a personal API key (`phx_`). */
export function resolvePostHogProjectKey() {
  const candidates = [process.env.POSTHOG_API_KEY, process.env.NEXT_PUBLIC_POSTHOG_KEY];
  for (const key of candidates) {
    const trimmed = key?.trim();
    if (trimmed?.startsWith('phc_')) return trimmed;
  }
  return null;
}

function getPostHogClient() {
  if (client) return client;

  const apiKey = resolvePostHogProjectKey();
  const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (!apiKey) return null;

  client = new PostHog(apiKey, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = getPostHogClient();
  if (!posthog) return;

  posthog.capture({
    distinctId,
    event,
    properties: {
      source: 'server',
      ...properties
    }
  });
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}

export { getPostHogClient };

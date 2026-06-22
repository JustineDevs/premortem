import { createClient, type PhoenixClient } from '@arizeai/phoenix-client';

function resolvePhoenixUrl() {
  const raw =
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
    process.env.PHOENIX_BASE_URL?.trim() ||
    'http://localhost:6006';

  return raw.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
}

function isPhoenixEnabled() {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
      process.env.PHOENIX_OTEL_ENABLED === '1'
  );
}

let cachedClient: PhoenixClient | undefined;

export function isPhoenixClientConfigured() {
  return isPhoenixEnabled() && Boolean(process.env.PHOENIX_API_KEY?.trim());
}

export function createPremortemPhoenixClient(): PhoenixClient {
  if (cachedClient) return cachedClient;

  const baseUrl = resolvePhoenixUrl();
  const apiKey = process.env.PHOENIX_API_KEY?.trim();

  cachedClient = createClient({
    options: {
      baseUrl,
      ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {})
    }
  });

  return cachedClient;
}

export function resetPremortemPhoenixClientForTests() {
  cachedClient = undefined;
}

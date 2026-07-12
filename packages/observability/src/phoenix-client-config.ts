import { createClient, type PhoenixClient } from '@arizeai/phoenix-client';

function resolvePhoenixUrl() {
  const raw = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() || process.env.PHOENIX_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'Phoenix is required. Set PHOENIX_COLLECTOR_ENDPOINT or PHOENIX_BASE_URL before loading the app.'
    );
  }

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
  if (!apiKey) {
    throw new Error(
      'Phoenix is required. Set PHOENIX_API_KEY and PHOENIX_BASE_URL or PHOENIX_COLLECTOR_ENDPOINT.'
    );
  }

  cachedClient = createClient({
    options: {
      baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` }
    }
  });

  return cachedClient;
}

export function resetPremortemPhoenixClientForTests() {
  cachedClient = undefined;
}

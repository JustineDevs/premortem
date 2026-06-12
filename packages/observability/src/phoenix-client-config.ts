import { createClient, type PhoenixClient } from '@arizeai/phoenix-client';

import { isPhoenixEnabled, resolvePhoenixUrl } from './phoenix';

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

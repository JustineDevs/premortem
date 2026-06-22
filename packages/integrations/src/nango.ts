import { Nango } from '@nangohq/node';

export interface NangoProxyRequest {
  connectionId: string;
  providerConfigKey: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  baseUrlOverride?: string;
  data?: unknown;
  retries?: number;
}

export interface NangoConnectSessionRequest {
  tags?: Record<string, string>;
  allowedIntegrations?: string[];
  overrides?: Record<string, unknown>;
}

export interface NangoConnectSessionResponse {
  connectSessionToken: string;
  connectLink?: string;
  expiresAt?: string;
}

function resolveNangoSecretKey() {
  const secretKey = process.env.NANGO_SECRET_KEY?.trim() || process.env.NANGO_API_KEY?.trim();
  if (!secretKey) {
    throw new Error('NANGO_SECRET_KEY is required');
  }
  return secretKey;
}

function resolveNangoHost() {
  return process.env.NANGO_BASE_URL?.trim() || undefined;
}

export function createNangoClient() {
  return new Nango({
    secretKey: resolveNangoSecretKey(),
    ...(resolveNangoHost() ? { host: resolveNangoHost() } : {})
  });
}

export async function createNangoConnectSession(
  input: NangoConnectSessionRequest = {}
): Promise<NangoConnectSessionResponse> {
  const nango = createNangoClient() as Nango & {
    createConnectSession: (options: Record<string, unknown>) => Promise<{
      data?: {
        token?: string;
        connect_link?: string;
        expires_at?: string;
      };
    }>;
  };

  const { data } = await nango.createConnectSession({
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.allowedIntegrations ? { allowed_integrations: input.allowedIntegrations } : {}),
    ...(input.overrides ? { overrides: input.overrides } : {})
  });

  if (!data?.token) {
    throw new Error('Nango connect session creation returned no token');
  }

  return {
    connectSessionToken: data.token,
    ...(data.connect_link ? { connectLink: data.connect_link } : {}),
    ...(data.expires_at ? { expiresAt: data.expires_at } : {})
  };
}

export async function createNangoReconnectSession(
  input: NangoConnectSessionRequest & { connectionId: string; integrationId: string }
): Promise<NangoConnectSessionResponse> {
  const nango = createNangoClient() as Nango & {
    createReconnectSession: (options: Record<string, unknown>) => Promise<{
      data?: {
        token?: string;
        connect_link?: string;
        expires_at?: string;
      };
    }>;
  };

  const { data } = await nango.createReconnectSession({
    connection_id: input.connectionId,
    integration_id: input.integrationId,
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.allowedIntegrations ? { allowed_integrations: input.allowedIntegrations } : {}),
    ...(input.overrides ? { overrides: input.overrides } : {})
  });

  if (!data?.token) {
    throw new Error('Nango reconnect session creation returned no token');
  }

  return {
    connectSessionToken: data.token,
    ...(data.connect_link ? { connectLink: data.connect_link } : {}),
    ...(data.expires_at ? { expiresAt: data.expires_at } : {})
  };
}

export async function getNangoToken(
  connectionId: string,
  providerConfigKey: string
): Promise<string | null> {
  const nango = createNangoClient();
  const connection = await nango.getConnection(providerConfigKey, connectionId);
  const credentials = connection.credentials as
    | { access_token?: string; accessToken?: string }
    | undefined;
  return credentials?.access_token ?? credentials?.accessToken ?? null;
}

export async function nangoProxy(
  input: NangoProxyRequest
): Promise<{ status?: number; data?: { ok?: boolean; error?: string } | unknown }> {
  const nango = createNangoClient();
  return nango.proxy({
    method: input.method,
    providerConfigKey: input.providerConfigKey,
    connectionId: input.connectionId,
    endpoint: input.endpoint,
    ...(input.baseUrlOverride ? { baseUrlOverride: input.baseUrlOverride } : {}),
    ...(typeof input.retries === 'number' ? { retries: input.retries } : {}),
    ...(typeof input.data === 'undefined' ? {} : { data: input.data })
  });
}

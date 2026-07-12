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

export interface NangoConnectionSummary {
  id: string;
  providerConfigKey: string;
  integrationId: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: Record<string, string>;
  credentials?: {
    raw?: NangoConnectionRawCredentials;
  };
}

interface NangoConnectionRawCredentials {
  scope?: string;
  [key: string]: unknown;
}

function resolveNangoSecretKey() {
  const secretKey =
    process.env.NANGO_TOOLBOX_SECRET_KEY?.trim() ||
    process.env.NANGO_SECRET_KEY?.trim() ||
    process.env.NANGO_API_KEY?.trim();
  if (!secretKey) {
    throw new Error('NANGO_TOOLBOX_SECRET_KEY is required');
  }
  return secretKey;
}

function resolveNangoHost() {
  const serverUrl = process.env.NANGO_SERVER_URL?.trim();
  if (serverUrl) {
    return serverUrl;
  }

  const legacyBaseUrl = process.env.NANGO_BASE_URL?.trim();
  if (
    legacyBaseUrl &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(legacyBaseUrl)
  ) {
    return legacyBaseUrl;
  }

  return 'https://api.nango.dev';
}

export function createNangoClient() {
  return new Nango({
    secretKey: resolveNangoSecretKey(),
    ...(resolveNangoHost() ? { host: resolveNangoHost() } : {})
  });
}

async function nangoRequest(path: string) {
  const host = resolveNangoHost();
  const response = await fetch(`${host.replace(/\/$/, '')}${path}`, {
    headers: {
      Authorization: `Bearer ${resolveNangoSecretKey()}`,
      'content-type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Nango request failed (${response.status}): ${await response.text()}`);
  }

  return response.json() as Promise<unknown>;
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

export async function listNangoConnections(
  integrationId: string
): Promise<NangoConnectionSummary[]> {
  const payload = await nangoRequest(`/connections?integrationId=${encodeURIComponent(integrationId)}`);
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : Array.isArray((payload as { connections?: unknown }).connections)
        ? (payload as { connections: unknown[] }).connections
        : [];

  return records
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const credentials = item.credentials && typeof item.credentials === 'object' ? (item.credentials as Record<string, unknown>) : {};
      const raw = credentials.raw && typeof credentials.raw === 'object' ? (credentials.raw as Record<string, unknown>) : undefined;
      const tagSources = [
        item.tags,
        item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>).tags : undefined,
        raw?.tags
      ];
      const connectionTags = Object.fromEntries(
        tagSources
          .filter((tags): tags is Record<string, unknown> => Boolean(tags) && typeof tags === 'object')
          .flatMap((tags) => Object.entries(tags))
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );

      const credentialsSummary = raw ? { raw: raw as NangoConnectionRawCredentials } : undefined;

      return {
        id:
          typeof item.id === 'string'
            ? item.id
            : typeof item.connection_id === 'string'
              ? item.connection_id
              : typeof item.connectionId === 'string'
                ? item.connectionId
                : '',
        providerConfigKey:
          typeof item.providerConfigKey === 'string'
            ? item.providerConfigKey
            : typeof item.provider_config_key === 'string'
              ? item.provider_config_key
              : integrationId,
        integrationId:
          typeof item.integrationId === 'string'
            ? item.integrationId
            : typeof item.integration_id === 'string'
              ? item.integration_id
              : integrationId,
        createdAt:
          typeof item.created_at === 'string'
            ? item.created_at
            : typeof item.createdAt === 'string'
              ? item.createdAt
              : undefined,
        updatedAt:
          typeof item.updated_at === 'string'
            ? item.updated_at
            : typeof item.updatedAt === 'string'
              ? item.updatedAt
              : undefined,
        tags: connectionTags,
        credentials: credentialsSummary
      };
    })
    .filter((item) => item.id.length > 0);
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

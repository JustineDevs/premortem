import { refreshGitLabOAuthToken, gitLabAuthHeaders } from '@premortem/integrations';
import { isProductionMode } from '@premortem/domain';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { prisma } from './client';
import { resolveGitLabApiBaseUrl } from './gitlab-url';

const TOKEN_REFRESH_SKEW_MS = 60_000;
const STORED_TOKEN_PREFIX = 'enc:v1:';

function allowsEnvGitLabTokenFallback(): boolean {
  if (isProductionMode()) return false;
  return process.env.PREMORTEM_ALLOW_ENV_GITLAB_TOKEN === '1';
}

export class GitLabTokenError extends Error {
  readonly code: 'gitlab_token_expired' | 'gitlab_reconnect_required';

  constructor(
    message: string,
    code: 'gitlab_token_expired' | 'gitlab_reconnect_required' = 'gitlab_reconnect_required'
  ) {
    super(message);
    this.name = 'GitLabTokenError';
    this.code = code;
  }
}

export interface ResolvedGitLabCredentials {
  baseUrl: string;
  token: string;
  connectionId?: string;
  source: 'connection' | 'env';
}

function encryptionKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string');
  }
  return key;
}

function encryptToken(token: string): string {
  const key = encryptionKey();
  if (!key) {
    if (isProductionMode()) {
      throw new Error('ENCRYPTION_KEY is required to store provider tokens in production');
    }
    return `plain:${token}`;
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${STORED_TOKEN_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function decryptToken(ciphertext: string): string {
  const key = encryptionKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required to read encrypted provider tokens');
  }

  const payload = Buffer.from(ciphertext, 'base64');
  const iv = payload.subarray(0, 16);
  const tag = payload.subarray(16, 32);
  const encrypted = payload.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function decodeStoredToken(value: string) {
  if (value.startsWith('plain:')) {
    return value.slice('plain:'.length);
  }
  if (value.startsWith(STORED_TOKEN_PREFIX)) {
    return decryptToken(value.slice(STORED_TOKEN_PREFIX.length));
  }
  return value;
}

export function encodeStoredToken(token: string) {
  return encryptToken(token);
}

function tokenNeedsRefresh(expiresAt: Date | null | undefined) {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now() + TOKEN_REFRESH_SKEW_MS;
}

async function verifyGitLabAccessTokenLive(baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4/user`, {
    headers: gitLabAuthHeaders(token)
  });
  return response.ok;
}

async function refreshStoredGitLabConnectionTokens(connectionId: string, refreshToken: string) {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);
  const payload = await refreshGitLabOAuthToken({
    clientId,
    clientSecret,
    refreshToken,
    baseUrl
  });

  const tokenExpiresAt =
    typeof payload.expires_in === 'number' && payload.expires_in > 0
      ? new Date(Date.now() + payload.expires_in * 1000)
      : undefined;

  await prisma.providerConnection.update({
    where: { id: connectionId },
    data: {
      encryptedAccessToken: encodeStoredToken(payload.access_token),
      encryptedRefreshToken: payload.refresh_token
        ? encodeStoredToken(payload.refresh_token)
        : undefined,
      tokenExpiresAt,
      status: 'active',
      lastSyncedAt: new Date()
    }
  });

  return payload.access_token;
}

/** Returns a live GitLab access token, refreshing OAuth credentials when needed. */
export async function ensureGitLabAccessTokenForConnection(connectionId: string): Promise<string> {
  const connection = await prisma.providerConnection.findUnique({
    where: { id: connectionId }
  });

  if (!connection?.encryptedAccessToken) {
    throw new GitLabTokenError(
      'GitLab integration is missing an access token. Reconnect GitLab in Settings.',
      'gitlab_reconnect_required'
    );
  }

  const accessToken = decodeStoredToken(connection.encryptedAccessToken);
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  if (!tokenNeedsRefresh(connection.tokenExpiresAt)) {
    return accessToken;
  }

  const refreshToken = connection.encryptedRefreshToken
    ? decodeStoredToken(connection.encryptedRefreshToken)
    : null;

  if (refreshToken) {
    try {
      const refreshed = await refreshStoredGitLabConnectionTokens(connection.id, refreshToken);
      if (refreshed) {
        return refreshed;
      }
    } catch {
      // Fall through to live verification / reconnect guidance.
    }
  }

  if (await verifyGitLabAccessTokenLive(baseUrl, accessToken)) {
    return accessToken;
  }

  throw new GitLabTokenError(
    'GitLab access token expired. Reconnect GitLab in Settings to refresh repository access.',
    'gitlab_token_expired'
  );
}

async function resolveConnectionAccessToken(connection: {
  id: string;
  encryptedAccessToken: string | null;
}) {
  if (!connection.encryptedAccessToken) return null;
  return ensureGitLabAccessTokenForConnection(connection.id);
}

export async function resolveGitLabCredentialsForOrganization(
  organizationId: string,
  options?: { connectionId?: string }
): Promise<ResolvedGitLabCredentials | null> {
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  if (options?.connectionId) {
    const connection = await prisma.providerConnection.findFirst({
      where: {
        id: options.connectionId,
        organizationId,
        provider: 'gitlab',
        status: { in: ['active', 'pending'] }
      }
    });

    if (connection?.encryptedAccessToken) {
      const token = await resolveConnectionAccessToken(connection);
      if (!token) return null;
      return {
        baseUrl,
        token,
        connectionId: connection.id,
        source: 'connection'
      };
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      providerConnections: {
        where: { provider: 'gitlab', status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 1
      }
    }
  });

  if (!organization) return null;

  const connection = organization.providerConnections[0];

  if (connection?.encryptedAccessToken) {
    const token = await resolveConnectionAccessToken(connection);
    if (!token) return null;
    return {
      baseUrl,
      token,
      connectionId: connection.id,
      source: 'connection'
    };
  }

  if (allowsEnvGitLabTokenFallback()) {
    const envToken = process.env.GITLAB_TOKEN;
    if (envToken) {
      return { baseUrl, token: envToken, source: 'env' };
    }
  }

  return null;
}

export async function resolveGitLabCredentialsForProject(
  projectId: string
): Promise<ResolvedGitLabCredentials | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      connection: true,
      organization: {
        include: {
          providerConnections: {
            where: { provider: 'gitlab', status: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  if (!project) return null;

  const connection = project.connection ?? project.organization.providerConnections[0];
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  if (connection?.encryptedAccessToken) {
    const token = await resolveConnectionAccessToken(connection);
    if (!token) return null;
    return {
      baseUrl,
      token,
      connectionId: connection.id,
      source: 'connection'
    };
  }

  if (allowsEnvGitLabTokenFallback()) {
    const envToken = process.env.GITLAB_TOKEN;
    if (envToken) {
      return { baseUrl, token: envToken, source: 'env' };
    }
  }

  return null;
}

export async function storeProviderAccessToken(connectionId: string, token: string) {
  return prisma.providerConnection.update({
    where: { id: connectionId },
    data: {
      encryptedAccessToken: encodeStoredToken(token),
      status: 'active',
      lastSyncedAt: new Date()
    }
  });
}

export interface ResolvedGitHubCredentials {
  token: string;
  connectionId?: string;
  source: 'connection' | 'env';
}

export async function resolveGitHubCredentialsForProject(
  projectId: string
): Promise<ResolvedGitHubCredentials | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      connection: true,
      organization: {
        include: {
          providerConnections: {
            where: { provider: 'github', status: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  if (!project) return null;

  const connection = project.connection?.provider === 'github'
    ? project.connection
    : project.organization.providerConnections[0];

  if (connection?.encryptedAccessToken) {
    return {
      token: decodeStoredToken(connection.encryptedAccessToken),
      connectionId: connection.id,
      source: 'connection'
    };
  }

  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken) {
    return { token: envToken, source: 'env' };
  }

  return null;
}

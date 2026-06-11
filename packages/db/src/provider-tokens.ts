import { isProductionMode } from '@premortem/domain';

import { prisma } from './client';
import { resolveGitLabApiBaseUrl } from './gitlab-url';

function allowsEnvGitLabTokenFallback(): boolean {
  if (isProductionMode()) return false;
  return process.env.PREMORTEM_ALLOW_ENV_GITLAB_TOKEN === '1';
}

export interface ResolvedGitLabCredentials {
  baseUrl: string;
  token: string;
  connectionId?: string;
  source: 'connection' | 'env';
}

function decodeStoredToken(value: string) {
  if (value.startsWith('plain:')) {
    return value.slice('plain:'.length);
  }
  return value;
}

export async function resolveGitLabCredentialsForOrganization(
  organizationId: string
): Promise<ResolvedGitLabCredentials | null> {
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
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  if (connection?.encryptedAccessToken) {
    return {
      baseUrl,
      token: decodeStoredToken(connection.encryptedAccessToken),
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
    return {
      baseUrl,
      token: decodeStoredToken(connection.encryptedAccessToken),
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
      encryptedAccessToken: `plain:${token}`,
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

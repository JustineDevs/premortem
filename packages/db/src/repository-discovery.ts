import {
  listAccessibleGitLabProjects,
  parseGitLabExternalProjectId,
  resolveGitLabProjectByReference,
  type GitLabDiscoveredProject
} from '@premortem/integrations';
import type { Prisma } from '@prisma/client';

import {
  AuditReadinessError,
  verifyGitLabRegistrationAccess
} from './audit-readiness';
import { assertCanRegisterProject, EntitlementError } from './entitlements';
import { prisma } from './client';
import { slugifyProjectNameForRepo } from './repositories';

export type DiscoveredRepositoryRow = GitLabDiscoveredProject & {
  enabled: boolean;
  projectId: string | null;
  source: 'discovered' | 'public_watch' | 'manual';
};

function decodeStoredToken(encrypted?: string | null): string | null {
  if (!encrypted) return null;
  if (encrypted.startsWith('plain:')) return encrypted.slice('plain:'.length);
  return encrypted;
}

function resolveGitLabApiBaseUrl(baseUrl?: string | null) {
  return (baseUrl ?? process.env.GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/$/, '');
}

async function getGitLabConnectionForOrg(input: {
  organizationId: string;
  connectionId: string;
}) {
  const connection = await prisma.providerConnection.findFirst({
    where: {
      id: input.connectionId,
      organizationId: input.organizationId,
      provider: 'gitlab',
      status: { in: ['active', 'pending'] }
    },
    include: {
      projects: {
        where: { status: { in: ['active', 'disconnected'] } }
      }
    }
  });

  if (!connection) {
    throw new Error('GitLab integration not found for this workspace.');
  }

  const token = decodeStoredToken(connection.encryptedAccessToken);
  if (!token) {
    throw new Error('GitLab integration is missing an access token. Reconnect GitLab in Settings.');
  }

  return { connection, token };
}

function enabledProjectByExternalId(
  projects: Array<{ id: string; externalProjectId: string; status: string; metadata: unknown }>
) {
  const map = new Map<string, { id: string; status: string; metadata: unknown }>();
  for (const project of projects) {
    map.set(project.externalProjectId, project);
  }
  return map;
}

function projectSource(metadata: unknown): DiscoveredRepositoryRow['source'] {
  if (!metadata || typeof metadata !== 'object') return 'manual';
  const source = (metadata as Record<string, unknown>).source;
  if (source === 'discovered' || source === 'public_watch' || source === 'manual') {
    return source;
  }
  return 'manual';
}

export async function listDiscoveredRepositories(input: {
  organizationId: string;
  connectionId: string;
}): Promise<{ repositories: DiscoveredRepositoryRow[]; lastSyncedAt: string | null }> {
  const { connection, token } = await getGitLabConnectionForOrg(input);
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  const discovered = await listAccessibleGitLabProjects({
    baseUrl,
    token,
    minAccessLevel: 10
  });

  const enabledMap = enabledProjectByExternalId(connection.projects);

  const repositories: DiscoveredRepositoryRow[] = discovered.map((row) => {
    const enabledProject = enabledMap.get(row.externalProjectId);
    return {
      ...row,
      enabled: enabledProject?.status === 'active',
      projectId: enabledProject?.id ?? null,
      source: enabledProject ? projectSource(enabledProject.metadata) : 'discovered'
    };
  });

  await prisma.providerConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncedAt: new Date(),
      status: 'active',
      accessScope: {
        ...(typeof connection.accessScope === 'object' && connection.accessScope !== null
          ? (connection.accessScope as Record<string, unknown>)
          : {}),
        discoveredCount: repositories.length,
        discoveredAt: new Date().toISOString()
      } as Prisma.JsonObject
    }
  });

  return {
    repositories,
    lastSyncedAt: new Date().toISOString()
  };
}

async function createProjectFromDiscovery(input: {
  organizationId: string;
  connectionId?: string | null;
  createdById?: string;
  discovered: GitLabDiscoveredProject;
  source: 'discovered' | 'public_watch';
  publishCapable: boolean;
}) {
  const slug = `${slugifyProjectNameForRepo(input.discovered.name)}-${Date.now().toString(36).slice(-6)}`;
  const metadata: Record<string, unknown> = {
    source: input.source,
    discoveredAt: new Date().toISOString(),
    publishCapable: input.publishCapable,
    gitlabAccessLevel: input.discovered.accessLevel
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({
      where: {
        organizationId: input.organizationId,
        provider: 'gitlab',
        externalProjectId: input.discovered.externalProjectId
      }
    });

    if (existing) {
      return tx.project.update({
        where: { id: existing.id },
        data: {
          connectionId: input.connectionId ?? null,
          name: input.discovered.name,
          repoUrl: input.discovered.repoUrl,
          defaultBranch: input.discovered.defaultBranch,
          visibility: input.discovered.visibility,
          status: 'active',
          metadata: {
            ...(typeof existing.metadata === 'object' && existing.metadata !== null
              ? (existing.metadata as Record<string, unknown>)
              : {}),
            ...metadata
          } as Prisma.JsonObject,
          connectedAt: new Date()
        }
      });
    }

    const project = await tx.project.create({
      data: {
        organizationId: input.organizationId,
        connectionId: input.connectionId ?? null,
        provider: 'gitlab',
        externalProjectId: input.discovered.externalProjectId,
        name: input.discovered.name,
        slug,
        repoUrl: input.discovered.repoUrl,
        defaultBranch: input.discovered.defaultBranch,
        visibility: input.discovered.visibility,
        status: 'active',
        createdById: input.createdById,
        connectedAt: new Date(),
        metadata: metadata as Prisma.JsonObject
      }
    });

    await tx.projectSetting.create({
      data: { projectId: project.id }
    });

    return project;
  });
}

export async function enableDiscoveredRepositories(input: {
  organizationId: string;
  connectionId: string;
  externalProjectIds: string[];
  createdById?: string;
}) {
  const ids = [...new Set(input.externalProjectIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new Error('externalProjectIds is required.');
  }

  const { connection, token } = await getGitLabConnectionForOrg({
    organizationId: input.organizationId,
    connectionId: input.connectionId
  });
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);

  const catalog = await listAccessibleGitLabProjects({
    baseUrl,
    token,
    minAccessLevel: 10
  });
  const catalogById = new Map(catalog.map((row) => [row.externalProjectId, row]));

  const enabled: Array<{ id: string; externalProjectId: string; name: string }> = [];
  const errors: Array<{ externalProjectId: string; error: string; code?: string }> = [];

  for (const externalProjectId of ids) {
    const discovered = catalogById.get(externalProjectId);
    if (!discovered) {
      errors.push({
        externalProjectId,
        error: 'Repository is not accessible with the connected GitLab account.',
        code: 'not_accessible'
      });
      continue;
    }

    try {
      const existing = await prisma.project.findFirst({
        where: {
          organizationId: input.organizationId,
          provider: 'gitlab',
          externalProjectId
        }
      });
      if (!existing) {
        await assertCanRegisterProject(input.organizationId);
      }
      await verifyGitLabRegistrationAccess({
        organizationId: input.organizationId,
        externalProjectId,
        repoUrl: discovered.repoUrl
      });

      const project = await createProjectFromDiscovery({
        organizationId: input.organizationId,
        connectionId: connection.id,
        createdById: input.createdById,
        discovered,
        source: 'discovered',
        publishCapable: discovered.canWriteIssues
      });

      enabled.push({
        id: project.id,
        externalProjectId: project.externalProjectId,
        name: project.name
      });
    } catch (error) {
      if (error instanceof EntitlementError) {
        errors.push({
          externalProjectId,
          error: error.message,
          code: error.code
        });
        break;
      }
      if (error instanceof AuditReadinessError) {
        errors.push({
          externalProjectId,
          error: error.message,
          code: error.code
        });
        continue;
      }
      errors.push({
        externalProjectId,
        error: error instanceof Error ? error.message : 'Failed to enable repository.'
      });
    }
  }

  return { enabled, errors };
}

export async function disableOrganizationProject(input: {
  organizationId: string;
  projectId: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      organizationId: input.organizationId
    }
  });

  if (!project) {
    throw new Error('Project not found.');
  }

  return prisma.project.update({
    where: { id: project.id },
    data: { status: 'disconnected' }
  });
}

export async function registerPublicGitLabProject(input: {
  organizationId: string;
  repoUrlOrPath: string;
  createdById?: string;
}) {
  const baseUrl = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);
  const externalProjectId = parseGitLabExternalProjectId(input.repoUrlOrPath, baseUrl);

  const existing = externalProjectId
    ? await prisma.project.findFirst({
        where: {
          organizationId: input.organizationId,
          provider: 'gitlab',
          externalProjectId
        }
      })
    : null;

  if (!existing) {
    await assertCanRegisterProject(input.organizationId);
  }

  const discovered = await resolveGitLabProjectByReference({
    baseUrl,
    repoUrlOrPath: input.repoUrlOrPath
  });

  if (discovered.visibility === 'private') {
    throw new AuditReadinessError(
      'This repository is private. Connect GitLab and enable it from your accessible repositories.',
      'gitlab_private_repo',
      'repoUrl',
      'gitlab'
    );
  }

  const project = await createProjectFromDiscovery({
    organizationId: input.organizationId,
    createdById: input.createdById,
    discovered,
    source: 'public_watch',
    publishCapable: false
  });

  return project;
}

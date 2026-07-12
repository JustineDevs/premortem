import { allowsLocalIngestBypass, allowsMockExecutor, isProductionMode } from '@premortem/domain';
import { isLlmProviderTargetUsable, resolveLlmProviderTargets } from '@premortem/llm';
import { fetchGitLabUser, gitLabAuthHeaders, getNangoToken } from '@premortem/integrations';

import { prisma } from './client';
import { fetchWithTimeout } from './fetch-with-timeout';
import { resolveGitLabCredentialsForOrganization, resolveGitLabCredentialsForProject } from './provider-tokens';
import { decodeStoredToken } from './token-codec';
import { getOrganizationLlmSettings } from './workspace';

export class AuditReadinessError extends Error {
  readonly code: string;
  readonly field: string;
  readonly system: string;

  constructor(message: string, code: string, field: string, system = 'premortem') {
    super(message);
    this.name = 'AuditReadinessError';
    this.code = code;
    this.field = field;
    this.system = system;
  }
}

async function resolveGitLabTokenFromConnection(connection: {
  encryptedAccessToken: string | null;
  nangoConnectionId: string | null;
  nangoProviderKey: string | null;
}) {
  if (connection.nangoConnectionId && connection.nangoProviderKey) {
    try {
      return await getNangoToken(connection.nangoConnectionId, connection.nangoProviderKey);
    } catch {
      return null;
    }
  }

  if (!connection.encryptedAccessToken) {
    return null;
  }

  try {
    return decodeStoredToken(connection.encryptedAccessToken);
  } catch {
    return null;
  }
}

async function verifyLlmConfiguration(organizationId: string) {
  if (allowsMockExecutor()) return;
  const llmSettings = await getOrganizationLlmSettings(organizationId);
  const targets = resolveLlmProviderTargets({
    model: llmSettings.selectedGeminiModel,
    vendorRouting: llmSettings.vendorRouting,
    customProviders: llmSettings.customProviders
  });

  if (!targets.some((target) => isLlmProviderTargetUsable(target))) {
    throw new AuditReadinessError(
      'Configure at least one enabled managed or local model route before running audits.',
      'llm_not_configured',
      'llm',
      'llm'
    );
  }
}

export async function verifyGitLabRepoReadAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  const encoded = encodeURIComponent(input.externalProjectId);
  const response = await fetchWithTimeout(
    `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encoded}`,
    { headers: gitLabAuthHeaders(input.token) }
  );

  if (!response.ok) {
    throw new AuditReadinessError(
      `GitLab repository read access failed (${response.status}). Reconnect GitLab or verify the project path (${input.externalProjectId}).`,
      'gitlab_repo_access',
      'gitlab',
      'gitlab'
    );
  }

  return response.json();
}

async function verifyGitLabGroupMemberAccess(input: {
  baseUrl: string;
  token: string;
  groupId: number;
}) {
  const base = input.baseUrl.replace(/\/$/, '');
  const user = await fetchGitLabUser(base, input.token).catch(() => null);
  if (!user?.id) return null;

  const memberResponse = await fetchWithTimeout(
    `${base}/api/v4/groups/${input.groupId}/members/all/${user.id}`,
    { headers: gitLabAuthHeaders(input.token) }
  );
  if (!memberResponse.ok) return null;

  const member = await memberResponse.json();
  return member.access_level ?? 0;
}

export async function verifyGitLabIssueWriteAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  const project = await verifyGitLabRepoReadAccess(input);
  const projectAccess = project.permissions?.project_access?.access_level ?? 0;
  const groupAccess = project.permissions?.group_access?.access_level ?? 0;
  let accessLevel = Math.max(projectAccess, groupAccess);

  if (accessLevel < 30) {
    const namespaceId =
      project.namespace?.kind === 'group' && typeof project.namespace.id === 'number'
        ? project.namespace.id
        : null;
    const memberAccess = namespaceId
      ? await verifyGitLabGroupMemberAccess({
          baseUrl: input.baseUrl,
          token: input.token,
          groupId: namespaceId
        })
      : null;
    if (memberAccess) {
      accessLevel = Math.max(accessLevel, memberAccess);
    }
  }

  if (accessLevel < 30) {
    throw new AuditReadinessError(
      'GitLab token lacks Developer access required to publish issues. Grant at least Developer role on the connected project.',
      'gitlab_issue_write',
      'gitlab',
      'gitlab'
    );
  }

  return project;
}

/** Probes GitLab write access on the target project without mutating GitLab state. */
export async function verifyGitLabIssueCreateAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  return verifyGitLabIssueWriteAccess(input);
}

export async function probeGitLabIssueWriteAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}): Promise<boolean> {
  try {
    await verifyGitLabIssueWriteAccess(input);
    return true;
  } catch {
    return false;
  }
}

export async function canCreateGitLabIssues(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  try {
    await verifyGitLabIssueCreateAccess(input);
    return true;
  } catch {
    return false;
  }
}

export async function findPublishCapableGitLabTokenFromConnections(externalProjectId: string) {
  const baseUrl = (process.env.GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/$/, '');
  const connections = await prisma.providerConnection.findMany({
    where: {
      provider: 'gitlab',
      status: 'active',
      OR: [{ encryptedAccessToken: { not: null } }, { nangoConnectionId: { not: null } }]
    },
    orderBy: { updatedAt: 'desc' },
    take: 12
  });

  for (const connection of connections) {
    const token = await resolveGitLabTokenFromConnection(connection);
    if (!token) continue;
    if (!(await canCreateGitLabIssues({ baseUrl, token, externalProjectId }))) continue;
    return { token, connectionId: connection.id, externalAccountName: connection.externalAccountName };
  }

  return null;
}

/** Resolves a GitLab token that can publish issues for production stranger smoke. */
export async function resolveSmokeGitLabPublishToken(input: { externalProjectId: string }) {
  const baseUrl = (process.env.GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/$/, '');
  const candidates = [
    process.env.GITLAB_SMOKE_PUBLISH_TOKEN?.trim(),
    process.env.GITLAB_TOKEN?.trim()
  ].filter(Boolean) as string[];

  for (const token of candidates) {
    if (await canCreateGitLabIssues({ baseUrl, token, externalProjectId: input.externalProjectId })) {
      return { token, source: 'env' as const };
    }
  }

  const fromConnection = await findPublishCapableGitLabTokenFromConnections(input.externalProjectId);
  if (fromConnection) {
    return {
      token: fromConnection.token,
      source: 'connection' as const,
      connectionId: fromConnection.connectionId,
      externalAccountName: fromConnection.externalAccountName
    };
  }

  throw new AuditReadinessError(
    'No GitLab token can publish issues for production smoke. Set GITLAB_TOKEN (or GITLAB_SMOKE_PUBLISH_TOKEN) to a Personal Access Token with api scope, or connect GitLab in /app Settings with issue-write access.',
    'gitlab_issue_create',
    'GITLAB_TOKEN',
    'gitlab'
  );
}

function externalProjectIdFromRepoUrl(repoUrl: string, fallback: string): string {
  try {
    const pathname = new URL(repoUrl).pathname.replace(/^\//, '').replace(/\.git$/, '');
    return pathname || fallback;
  } catch {
    return fallback;
  }
}

/** Validates repo access when registering a GitLab project. */
export async function verifyGitLabRegistrationAccess(input: {
  organizationId: string;
  repoUrl?: string;
  externalProjectId?: string;
  connectionId?: string;
  baseUrl?: string;
  token?: string;
  requireIssueWrite?: boolean;
}) {
  if (allowsLocalIngestBypass()) return;

  const externalProjectId =
    input.externalProjectId ??
    (input.repoUrl ? externalProjectIdFromRepoUrl(input.repoUrl, '') : '');

  if (!externalProjectId) {
    throw new AuditReadinessError(
      'GitLab repository URL or project path is required.',
      'gitlab_project_missing',
      'repoUrl',
      'gitlab'
    );
  }

  let baseUrl = input.baseUrl;
  let token = input.token;

  if (!baseUrl || !token) {
    const credentials = await resolveGitLabCredentialsForOrganization(input.organizationId, {
      connectionId: input.connectionId
    });
    if (!credentials?.token) {
      throw new AuditReadinessError(
        'Connect GitLab in Settings before registering a repository.',
        'gitlab_not_connected',
        'gitlab',
        'gitlab'
      );
    }
    baseUrl = credentials.baseUrl;
    token = credentials.token;
  }

  await verifyGitLabRepoReadAccess({
    baseUrl,
    token,
    externalProjectId
  });

  if (input.requireIssueWrite !== false) {
    await verifyGitLabIssueWriteAccess({
      baseUrl,
      token,
      externalProjectId
    });
  }
}

async function resolveGitLabProjectCredentials(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.provider !== 'gitlab' || !project.externalProjectId) {
    if (isProductionMode()) {
      throw new AuditReadinessError(
        'Project is not connected to a GitLab repository. Register a GitLab project before running an audit.',
        'gitlab_project_missing',
        'gitlab',
        'gitlab'
      );
    }
    return null;
  }

  const credentials = await resolveGitLabCredentialsForProject(projectId);
  if (!credentials?.token) {
    throw new AuditReadinessError(
      'GitLab is not connected for this project. Connect GitLab in Settings before running an audit.',
      'gitlab_not_connected',
      'gitlab',
      'gitlab'
    );
  }

  return {
    project,
    credentials
  };
}

async function verifyGitLabProjectReadAccessForScan(projectId: string) {
  if (allowsLocalIngestBypass()) return;

  const resolved = await resolveGitLabProjectCredentials(projectId);
  if (!resolved) return;

  await verifyGitLabRepoReadAccess({
    baseUrl: resolved.credentials.baseUrl,
    token: resolved.credentials.token,
    externalProjectId: resolved.project.externalProjectId!
  });
}

/** Validates GitLab issue write/create access before publishing to GitLab. */
export async function assertGitLabPublishReadiness(projectId: string) {
  if (allowsLocalIngestBypass()) return;

  const resolved = await resolveGitLabProjectCredentials(projectId);
  if (!resolved) return;

  await verifyGitLabIssueWriteAccess({
    baseUrl: resolved.credentials.baseUrl,
    token: resolved.credentials.token,
    externalProjectId: resolved.project.externalProjectId!
  });

  if (isProductionMode()) {
    await verifyGitLabIssueCreateAccess({
      baseUrl: resolved.credentials.baseUrl,
      token: resolved.credentials.token,
      externalProjectId: resolved.project.externalProjectId!
    });
  }
}

export async function assertAuditReadiness(input: {
  organizationId: string;
  projectId: string;
}) {
  await verifyLlmConfiguration(input.organizationId);
  await verifyGitLabProjectReadAccessForScan(input.projectId);
}

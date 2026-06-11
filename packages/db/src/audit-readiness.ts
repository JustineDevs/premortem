import { allowsLocalIngestBypass, allowsMockExecutor, isProductionMode } from '@premortem/domain';
import { gitLabAuthHeaders } from '@premortem/integrations';

import { prisma } from './client';
import { fetchWithTimeout } from './fetch-with-timeout';
import {
  resolveGitLabCredentialsForOrganization,
  resolveGitLabCredentialsForProject
} from './provider-tokens';
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

async function verifyAzureDeploymentReachable() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return;

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=2025-01-01-preview`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1
    })
  });

  if (!response.ok) {
    throw new AuditReadinessError(
      `Azure OpenAI deployment "${deployment}" is unreachable (${response.status}). Verify AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT.`,
      'azure_deployment_unreachable',
      'AZURE_OPENAI_DEPLOYMENT',
      'azure-openai'
    );
  }
}

async function verifyLlmConfiguration(organizationId: string) {
  if (allowsMockExecutor()) return;

  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasAzure = Boolean(
    process.env.AZURE_OPENAI_ENDPOINT?.trim() &&
      process.env.AZURE_OPENAI_API_KEY?.trim() &&
      process.env.AZURE_OPENAI_DEPLOYMENT?.trim()
  );

  if (!hasGemini && !hasAzure) {
    throw new AuditReadinessError(
      'Configure GEMINI_API_KEY or Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT) before running audits.',
      'llm_not_configured',
      'llm',
      'llm'
    );
  }

  await getOrganizationLlmSettings(organizationId);

  if (hasGemini) {
    return;
  }

  if (hasAzure) {
    await verifyAzureDeploymentReachable();
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
    { headers: { 'PRIVATE-TOKEN': input.token } }
  );

  if (!response.ok) {
    throw new AuditReadinessError(
      `GitLab repository read access failed (${response.status}). Reconnect GitLab or verify the project path (${input.externalProjectId}).`,
      'gitlab_repo_access',
      'gitlab',
      'gitlab'
    );
  }

  return response.json() as Promise<{
    permissions?: {
      project_access?: { access_level?: number };
      group_access?: { access_level?: number };
    };
  }>;
}

async function verifyGitLabMemberAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  const base = input.baseUrl.replace(/\/$/, '');
  const encodedProject = encodeURIComponent(input.externalProjectId);

  const userResponse = await fetchWithTimeout(`${base}/api/v4/user`, {
    headers: { 'PRIVATE-TOKEN': input.token }
  });
  if (!userResponse.ok) return null;

  const user = (await userResponse.json()) as { id?: number };
  if (!user.id) return null;

  const memberResponse = await fetchWithTimeout(
    `${base}/api/v4/projects/${encodedProject}/members/all/${user.id}`,
    { headers: { 'PRIVATE-TOKEN': input.token } }
  );
  if (!memberResponse.ok) return null;

  const member = (await memberResponse.json()) as { access_level?: number };
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
    const memberAccess = await verifyGitLabMemberAccess(input);
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

function decodeStoredProviderToken(value: string) {
  return value.startsWith('plain:') ? value.slice('plain:'.length) : value;
}

async function readGitLabPatScopes(baseUrl: string, token: string): Promise<string[] | null> {
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/v4/personal_access_tokens/self`, {
    headers: gitLabAuthHeaders(token)
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { scopes?: string[] };
  return payload.scopes ?? null;
}

/** Probes GitLab issue create + close on the target project (validates api scope, not just role). */
export async function verifyGitLabIssueCreateAccess(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
}) {
  await verifyGitLabIssueWriteAccess(input);

  const base = input.baseUrl.replace(/\/$/, '');
  const encodedProject = encodeURIComponent(input.externalProjectId);

  const response = await fetchWithTimeout(`${base}/api/v4/projects/${encodedProject}/issues`, {
    method: 'POST',
    headers: {
      ...gitLabAuthHeaders(input.token),
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      title: '[premortem-readiness] publish probe — safe to close',
      description: 'Automated production-readiness probe. This issue is closed immediately.'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    const scopes = await readGitLabPatScopes(base, input.token);
    const scopeHint =
      scopes && !scopes.includes('api') && scopes.includes('read_api')
        ? ' Token has read_api only. Create a Personal Access Token with api scope (GitLab → Edit profile → Access Tokens).'
        : '';
    throw new AuditReadinessError(
      `GitLab issue create probe failed (${response.status}). Use a token with api scope on ${input.externalProjectId}.${scopeHint} ${body.slice(0, 200)}`,
      'gitlab_issue_create',
      'GITLAB_TOKEN',
      'gitlab'
    );
  }

  const created = (await response.json()) as { iid?: number };
  if (created.iid) {
    await fetchWithTimeout(`${base}/api/v4/projects/${encodedProject}/issues/${created.iid}`, {
      method: 'PUT',
      headers: {
        ...gitLabAuthHeaders(input.token),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ state_event: 'close' })
    });
  }

  return created;
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
    where: { provider: 'gitlab', status: 'active', encryptedAccessToken: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 12
  });

  for (const connection of connections) {
    if (!connection.encryptedAccessToken) continue;
    const token = decodeStoredProviderToken(connection.encryptedAccessToken);
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

/** Validates repo read + issue-write permissions when registering a GitLab project. */
export async function verifyGitLabRegistrationAccess(input: {
  organizationId: string;
  repoUrl?: string;
  externalProjectId?: string;
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

  const credentials = await resolveGitLabCredentialsForOrganization(input.organizationId);
  if (!credentials?.token) {
    throw new AuditReadinessError(
      'Connect GitLab in Settings before registering a repository.',
      'gitlab_not_connected',
      'gitlab',
      'gitlab'
    );
  }

  await verifyGitLabIssueWriteAccess({
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    externalProjectId
  });
}

async function verifyGitLabProjectPermissions(projectId: string) {
  if (allowsLocalIngestBypass()) return;

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
    return;
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

  await verifyGitLabIssueWriteAccess({
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    externalProjectId: project.externalProjectId
  });

  if (isProductionMode()) {
    await verifyGitLabIssueCreateAccess({
      baseUrl: credentials.baseUrl,
      token: credentials.token,
      externalProjectId: project.externalProjectId
    });
  }
}

export async function assertAuditReadiness(input: {
  organizationId: string;
  projectId: string;
}) {
  await verifyLlmConfiguration(input.organizationId);
  await verifyGitLabProjectPermissions(input.projectId);
}

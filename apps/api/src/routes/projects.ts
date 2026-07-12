import {
  assertCanRegisterProject,
  AuditReadinessError,
  createOrganizationProject,
  EntitlementError,
  getPublishedIssueAccuracyForProject,
  listOrganizationProjects,
  registerPublicGitHubProject,
  registerPublicGitLabProject,
  resolveGitLabCredentialsForProject,
  updateProjectSettings,
  verifyGitLabRegistrationAccess
} from '@premortem/db';
import { ProjectConnectionStatus } from '@premortem/domain';
import { captureServerException } from '@premortem/observability';
import { syncGitLabQualityGate } from '@premortem/integrations';

import { apiErrorResponse } from '../lib/error-response';
import {
  readJsonRecord,
  readOptionalBoolean,
  readOptionalRecord,
  readOptionalString,
  readOptionalStringArray,
  readOptionalStringLiteral,
  readRequiredString
} from '../lib/request-body';
import { ORG_WRITE_ROLES, requireApiRole } from '../lib/authorization';
import { resolveApiActorContext } from '../lib/request-context';

function normalizeProvider(provider: string | undefined): 'gitlab' | 'github' {
  if (provider === 'github') return 'github';
  return 'gitlab';
}

function inferPublicRepositoryProvider(reference: string, provider?: string): 'gitlab' | 'github' {
  const explicit = normalizeProvider(provider);
  if (provider === 'github') return 'github';
  if (provider === 'gitlab') return 'gitlab';

  const normalized = reference.trim().toLowerCase();
  if (
    normalized.includes('github.com/') ||
    normalized.startsWith('git@github.com:') ||
    normalized.startsWith('git://github.com/')
  ) {
    return 'github';
  }

  if (
    normalized.includes('gitlab.com/') ||
    normalized.startsWith('git@gitlab.com:') ||
    normalized.startsWith('git://gitlab.com/')
  ) {
    return 'gitlab';
  }

  return explicit;
}

function fallbackRepoUrl(project: {
  provider: 'gitlab' | 'github';
  externalProjectId: string;
  repoUrl: string | null;
}) {
  return (
    project.repoUrl ??
    (project.provider === 'github'
      ? `https://github.com/${project.externalProjectId}`
      : `https://gitlab.com/${project.externalProjectId}`)
  );
}

async function syncProjectQualityGate(projectId: string) {
  const credentials = await resolveGitLabCredentialsForProject(projectId);
  if (!credentials) return null;

  const { prisma } = await import('@premortem/db');
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { provider: true, externalProjectId: true }
  });

  if (!project || project.provider !== 'gitlab' || !project.externalProjectId) {
    return null;
  }

  return syncGitLabQualityGate({
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    externalProjectId: project.externalProjectId
  });
}

export async function handleProjectCreate(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};

  const name = readRequiredString(body, 'name');
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const repoUrl = readOptionalString(body, 'repoUrl');
  const branch = readOptionalString(body, 'branch');
  const provider = normalizeProvider(readOptionalString(body, 'provider'));
  const scanCodeSnippet = readOptionalString(body, 'scanCodeSnippet');

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_WRITE_ROLES);
  const resolvedOrganizationId = actor.organizationId;

  try {
    await assertCanRegisterProject(resolvedOrganizationId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        { error: 'Project limit reached.', code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  if (provider === 'gitlab' && repoUrl?.trim()) {
    try {
      await verifyGitLabRegistrationAccess({
        organizationId: resolvedOrganizationId,
        repoUrl: repoUrl.trim(),
        requireIssueWrite: false
      });
    } catch (error) {
      if (error instanceof AuditReadinessError) {
        return Response.json(
          {
            error: 'Repository is not ready for registration.',
            code: error.code,
            field: error.field,
            system: error.system
          },
          { status: 422 }
        );
      }
      throw error;
    }
  }

  try {
    const project = await createOrganizationProject({
      organizationId: resolvedOrganizationId,
      name,
      provider,
      repoUrl: repoUrl?.trim(),
      defaultBranch: branch?.trim() || 'main',
      createdById: actor.profileId,
      scanCodeSnippet
    });

    await syncProjectQualityGate(project.id).catch((error) =>
      captureServerException(error, { context: 'gitlab-quality-gate-sync', projectId: project.id })
    );

    return Response.json({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: fallbackRepoUrl(project),
      branch: project.defaultBranch ?? 'main',
      status: project.status ?? ProjectConnectionStatus.ACTIVE,
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
      projectSettings: project.projectSettings ?? null,
      lastAuditScore: null,
      lastAuditDate: null,
      scanCodeSnippet:
        typeof project.metadata === 'object' &&
        project.metadata !== null &&
        'scanCodeSnippet' in project.metadata
          ? String((project.metadata as Record<string, unknown>).scanCodeSnippet)
          : undefined
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to register project', { fallbackStatus: 500 });
  }
}

export async function handleProjectList(request: Request) {
  const actor = await resolveApiActorContext(request);
  const organizationId = actor.organizationId;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor')?.trim() || undefined;
  const takeParam = Number.parseInt(url.searchParams.get('take') ?? '100', 10);
  const take = Number.isFinite(takeParam) ? takeParam : 100;
  const { projects, nextCursor } = await listOrganizationProjects(organizationId, {
    cursor,
    take
  });

  return Response.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: fallbackRepoUrl(project),
      branch: project.defaultBranch,
      status: project.status ?? ProjectConnectionStatus.ACTIVE,
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
      projectSettings: project.projectSettings ?? null,
      lastAuditScore: null,
      lastAuditDate: null,
      scanCodeSnippet:
        typeof project.metadata === 'object' &&
        project.metadata !== null &&
        'scanCodeSnippet' in project.metadata
          ? String((project.metadata as Record<string, unknown>).scanCodeSnippet)
          : undefined
    })),
    nextCursor
  });
}

export async function handleProjectSettingsPatch(request: Request, projectId: string) {
  const body = (await readJsonRecord(request)) ?? {};
  const notificationSettings = readOptionalRecord(body, 'notificationSettings');
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_WRITE_ROLES);

  const projectSettings = await updateProjectSettings({
    organizationId: actor.organizationId,
    projectId,
    autoRunOnPush: readOptionalBoolean(body, 'autoRunOnPush'),
    autoPublishApprovedIssues: readOptionalBoolean(body, 'autoPublishApprovedIssues'),
    auditDefaultBranchOnly: readOptionalBoolean(body, 'auditDefaultBranchOnly'),
    enabledAgents: readOptionalStringArray(body, 'enabledAgents') ?? undefined,
    severityThreshold: readOptionalStringLiteral(body, 'severityThreshold', [
      'low',
      'medium',
      'high',
      'critical'
    ]),
    labelsTemplate: readOptionalStringArray(body, 'labelsTemplate') ?? undefined,
    ignorePaths: readOptionalStringArray(body, 'ignorePaths') ?? undefined,
    notificationSettings
  });

  await syncProjectQualityGate(projectId).catch((error) =>
    captureServerException(error, { context: 'gitlab-quality-gate-sync', projectId })
  );

  return Response.json({ ok: true, projectSettings });
}

export async function handleProjectAccuracy(request: Request, projectId: string) {
  const actor = await resolveApiActorContext(request);
  const { prisma } = await import('@premortem/db');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true }
  });

  if (!project || project.organizationId !== actor.organizationId) {
    return Response.json({ error: `Project ${projectId} not found` }, { status: 404 });
  }

  const accuracy = await getPublishedIssueAccuracyForProject({
    organizationId: actor.organizationId,
    projectId
  });

  return Response.json({ ok: true, accuracy });
}

export async function handlePublicProjectCreate(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const reference = readRequiredString(body, 'reference');
  const provider = inferPublicRepositoryProvider(
    reference ?? '',
    readOptionalString(body, 'provider')
  );

  if (!reference) {
    return Response.json({ error: 'reference is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_WRITE_ROLES);

  try {
    await assertCanRegisterProject(actor.organizationId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        { error: 'Project limit reached.', code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  try {
    const project =
      provider === 'github'
        ? await registerPublicGitHubProject({
            organizationId: actor.organizationId,
            repoUrlOrPath: reference,
            createdById: actor.profileId
          })
        : await registerPublicGitLabProject({
            organizationId: actor.organizationId,
            repoUrlOrPath: reference,
            createdById: actor.profileId
          });

    return Response.json({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: fallbackRepoUrl(project),
      branch: project.defaultBranch ?? 'main',
      status: project.status ?? ProjectConnectionStatus.ACTIVE,
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
      publishCapable: false,
      source: 'public_watch'
    });
  } catch (error) {
    if (error instanceof AuditReadinessError) {
      return Response.json(
        {
          error: 'Repository is not ready for registration.',
          code: error.code,
          field: error.field,
          system: error.system
        },
        { status: 422 }
      );
    }
    return apiErrorResponse(error, 'Failed to register public repository.', {
      fallbackStatus: 502
    });
  }
}

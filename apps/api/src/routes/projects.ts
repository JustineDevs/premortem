import {
  assertCanRegisterProject,
  AuditReadinessError,
  createOrganizationProject,
  EntitlementError,
  getPublishedIssueAccuracyForProject,
  listOrganizationProjects,
  registerPublicGitLabProject,
  updateProjectSettings,
  verifyGitLabRegistrationAccess
} from '@premortem/db';
import { ProjectConnectionStatus } from '@premortem/domain';

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
  const organizationId = readOptionalString(body, 'organizationId');
  if (organizationId && organizationId !== actor.organizationId) {
    return Response.json({ error: 'organizationId is not allowed for this session.' }, { status: 403 });
  }
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

    return Response.json({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: project.repoUrl ?? `https://gitlab.com/${project.externalProjectId}`,
      branch: project.defaultBranch ?? 'main',
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
      projectSettings: project.projectSettings ?? null,
      lastAuditScore: null,
      lastAuditDate: null,
      infrastructureCount: 0,
      apiEndpointsCount: 0,
      unencryptedEndpointsCount: 0,
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
  const url = new URL(request.url);
  const requestedOrgId = url.searchParams.get('organizationId');
  if (requestedOrgId && requestedOrgId !== actor.organizationId) {
    return Response.json({ error: 'organizationId is not allowed for this session.' }, { status: 403 });
  }
  const organizationId = actor.organizationId;
  const projects = await listOrganizationProjects(organizationId);

  return Response.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: project.repoUrl ?? `https://gitlab.com/${project.externalProjectId}`,
      branch: project.defaultBranch,
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
      projectSettings: project.projectSettings ?? null,
      lastAuditScore: null,
      lastAuditDate: null,
      infrastructureCount: 0,
      apiEndpointsCount: 0,
      unencryptedEndpointsCount: 0,
      scanCodeSnippet:
        typeof project.metadata === 'object' &&
        project.metadata !== null &&
        'scanCodeSnippet' in project.metadata
          ? String((project.metadata as Record<string, unknown>).scanCodeSnippet)
          : undefined
    }))
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
    const project = await registerPublicGitLabProject({
      organizationId: actor.organizationId,
      repoUrlOrPath: reference,
      createdById: actor.profileId
    });

    return Response.json({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: project.repoUrl ?? `https://gitlab.com/${project.externalProjectId}`,
      branch: project.defaultBranch ?? 'main',
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

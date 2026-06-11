import {
  assertCanRegisterProject,
  AuditReadinessError,
  createOrganizationProject,
  EntitlementError,
  listOrganizationProjects,
  registerPublicGitLabProject,
  verifyGitLabRegistrationAccess
} from '@premortem/db';
import { ProjectConnectionStatus } from '@premortem/domain';

import { resolveApiActorContext } from '../lib/request-context';

function normalizeProvider(provider: string | undefined): 'gitlab' | 'github' {
  if (provider === 'github') return 'github';
  return 'gitlab';
}

export async function handleProjectCreate(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    repoUrl?: string;
    branch?: string;
    provider?: string;
    scanCodeSnippet?: string;
    organizationId?: string;
  };

  if (!body.name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);
  const organizationId = body.organizationId ?? actor.organizationId;

  try {
    await assertCanRegisterProject(organizationId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }

  if (normalizeProvider(body.provider) === 'gitlab' && body.repoUrl?.trim()) {
    try {
      await verifyGitLabRegistrationAccess({
        organizationId,
        repoUrl: body.repoUrl.trim()
      });
    } catch (error) {
      if (error instanceof AuditReadinessError) {
        return Response.json(
          {
            error: error.message,
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
      organizationId,
      name: body.name.trim(),
      provider: normalizeProvider(body.provider),
      repoUrl: body.repoUrl?.trim(),
      defaultBranch: body.branch?.trim() || 'main',
      createdById: actor.profileId,
      scanCodeSnippet: body.scanCodeSnippet
    });

    return Response.json({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: project.repoUrl ?? `https://gitlab.com/${project.externalProjectId}`,
      branch: project.defaultBranch ?? 'main',
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
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
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to register project' },
      { status: 500 }
    );
  }
}

export async function handleProjectList(request: Request) {
  const actor = await resolveApiActorContext(request);
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId') ?? actor.organizationId;
  const projects = await listOrganizationProjects(organizationId);

  return Response.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      provider: project.provider,
      repoUrl: project.repoUrl ?? `https://gitlab.com/${project.externalProjectId}`,
      branch: project.defaultBranch,
      connectionStatus: project.status ?? ProjectConnectionStatus.ACTIVE,
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

export async function handlePublicProjectCreate(request: Request) {
  const body = (await request.json()) as { reference?: string };
  const reference = body.reference?.trim();

  if (!reference) {
    return Response.json({ error: 'reference is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);

  try {
    await assertCanRegisterProject(actor.organizationId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
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
          error: error.message,
          code: error.code,
          field: error.field,
          system: error.system
        },
        { status: 422 }
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to register public repository.' },
      { status: 502 }
    );
  }
}

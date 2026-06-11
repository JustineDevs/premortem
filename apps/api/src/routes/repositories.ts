import {
  disableOrganizationProject,
  enableDiscoveredRepositories,
  EntitlementError,
  listDiscoveredRepositories
} from '@premortem/db';

import { resolveApiActorContext } from '../lib/request-context';

export async function handleIntegrationRepositoriesList(
  request: Request,
  connectionId: string
) {
  const actor = await resolveApiActorContext(request);

  try {
    const payload = await listDiscoveredRepositories({
      organizationId: actor.organizationId,
      connectionId
    });
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to list repositories.' },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 502 }
    );
  }
}

export async function handleIntegrationRepositoriesEnable(
  request: Request,
  connectionId: string
) {
  const body = (await request.json()) as { externalProjectIds?: string[] };
  const externalProjectIds = body.externalProjectIds ?? [];

  if (!Array.isArray(externalProjectIds) || externalProjectIds.length === 0) {
    return Response.json({ error: 'externalProjectIds is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);

  try {
    const result = await enableDiscoveredRepositories({
      organizationId: actor.organizationId,
      connectionId,
      externalProjectIds,
      createdById: actor.profileId
    });

    const status = result.enabled.length > 0 ? 200 : 422;
    return Response.json(result, { status });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to enable repositories.' },
      { status: 502 }
    );
  }
}

export async function handleIntegrationRepositoriesDisable(
  request: Request,
  connectionId: string
) {
  const body = (await request.json()) as { projectId?: string };
  if (!body.projectId?.trim()) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);

  try {
    const project = await disableOrganizationProject({
      organizationId: actor.organizationId,
      projectId: body.projectId.trim()
    });

    if (project.connectionId && project.connectionId !== connectionId) {
      return Response.json({ error: 'Project is not linked to this integration.' }, { status: 409 });
    }

    return Response.json({ ok: true, project: { id: project.id, status: project.status } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to disable repository.' },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 502 }
    );
  }
}

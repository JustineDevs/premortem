import {
  disableOrganizationProject,
  enableDiscoveredRepositories,
  EntitlementError,
  GitLabTokenError,
  listDiscoveredRepositories
} from '@premortem/db';

import { apiErrorResponse } from '../lib/error-response';
import {
  readJsonRecord,
  readOptionalStringArray,
  readRequiredString
} from '../lib/request-body';
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
    if (error instanceof GitLabTokenError) {
      return Response.json(
        { error: 'GitLab authorization required.', code: error.code },
        { status: 401 }
      );
    }
    return apiErrorResponse(error, 'Failed to list repositories.', {
      fallbackStatus: 502,
      notFoundStatus: 404
    });
  }
}

export async function handleIntegrationRepositoriesEnable(
  request: Request,
  connectionId: string
) {
  const body = (await readJsonRecord(request)) ?? {};
  const externalProjectIds = readOptionalStringArray(body, 'externalProjectIds');

  if (!externalProjectIds || externalProjectIds.length === 0) {
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

    const status =
      result.enabled.length > 0
        ? 200
        : result.errors.some(
              (entry) => entry.code === 'repo_limit' || entry.code === 'feature_locked'
            )
          ? 403
          : 422;
    const error =
      result.enabled.length > 0
        ? undefined
        : result.errors[0]?.error ?? 'No repositories could be enabled.';
    return Response.json(error ? { ...result, error } : result, { status });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        { error: 'Plan limit reached.', code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof GitLabTokenError) {
      return Response.json(
        { error: 'GitLab authorization required.', code: error.code },
        { status: 401 }
      );
    }
    return apiErrorResponse(error, 'Failed to enable repositories.', { fallbackStatus: 502 });
  }
}

export async function handleIntegrationRepositoriesDisable(
  request: Request,
  connectionId: string
) {
  const body = (await readJsonRecord(request)) ?? {};
  const projectId = readRequiredString(body, 'projectId');
  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);

  try {
    const project = await disableOrganizationProject({
      organizationId: actor.organizationId,
      projectId
    });

    if (project.connectionId && project.connectionId !== connectionId) {
      return Response.json({ error: 'Project is not linked to this integration.' }, { status: 409 });
    }

    return Response.json({ ok: true, project: { id: project.id, status: project.status } });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to disable repository.', {
      fallbackStatus: 502,
      notFoundStatus: 404
    });
  }
}

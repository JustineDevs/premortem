import { isLocalAuthBypassEnabled } from '@premortem/domain';
import { resolveActorOrganization, extractBearerToken, verifySupabaseAccessToken } from '@premortem/db';

export interface ApiActorContext {
  profileId: string;
  organizationId: string;
  email?: string | null;
}

export class ApiUnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

async function resolveFromHeaders(request: Request): Promise<ApiActorContext> {
  const profileId = request.headers.get('x-premortem-actor-id')?.trim();
  if (!profileId) {
    throw new ApiUnauthorizedError('Missing x-premortem-actor-id');
  }
  const hintedOrg = request.headers.get('x-premortem-organization-id')?.trim() || undefined;
  const email = request.headers.get('x-premortem-user-email');

  const resolved = await resolveActorOrganization(profileId, hintedOrg, {
    email: email ?? null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email
  };
}

export async function resolveApiActorContext(request: Request): Promise<ApiActorContext> {
  if (isLocalAuthBypassEnabled()) {
    return resolveFromHeaders(request);
  }

  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiUnauthorizedError();
  }

  const user = await verifySupabaseAccessToken(token);
  if (!user) {
    throw new ApiUnauthorizedError();
  }

  const hintedOrg = request.headers.get('x-premortem-organization-id')?.trim() || undefined;
  const resolved = await resolveActorOrganization(user.id, hintedOrg, {
    email: user.email ?? null
  });

  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email
  };
}

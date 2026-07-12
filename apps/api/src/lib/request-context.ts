import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import {
  resolveActorOrganization,
  extractApiKeyToken,
  extractBearerToken,
  verifyOrganizationApiKey,
  verifySupabaseAccessToken
} from '@premortem/db';
import type { AppRole } from '@premortem/db';

export interface ApiActorContext {
  profileId: string;
  organizationId: string;
  email?: string | null;
  role: AppRole;
}

export class ApiUnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}

export interface ApiAuthIdentity {
  profileId: string;
  email?: string | null;
  accessToken?: string | null;
}

export async function resolveApiAuthIdentity(request: Request): Promise<ApiAuthIdentity> {
  if (isLocalAuthBypassEnabled()) {
    return {
      profileId: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      accessToken: null
    };
  }

  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiUnauthorizedError();
  }

  const user = await verifySupabaseAccessToken(token);
  if (!user) {
    throw new ApiUnauthorizedError();
  }

  return {
    profileId: user.id,
    email: user.email,
    accessToken: token
  };
}

async function resolveFromHeaders(request: Request): Promise<ApiActorContext> {
  const profileId = request.headers.get('x-premortem-actor-id')?.trim();
    if (!profileId) {
      if (isLocalAuthBypassEnabled()) {
        return {
          profileId: LOCAL_DEV_FIXTURE.profileId,
          organizationId: LOCAL_DEV_FIXTURE.organizationId,
          email: LOCAL_DEV_FIXTURE.email,
          role: 'member'
        };
      }
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
    email,
    role: resolved.role
  };
}

export async function resolveApiActorContext(request: Request): Promise<ApiActorContext> {
  if (isLocalAuthBypassEnabled()) {
    const context = await resolveFromHeaders(request);
    const resolved = await resolveActorOrganization(context.profileId, context.organizationId, {
      email: context.email ?? null
    });
    return {
      ...context,
      role: resolved.role
    };
  }

  const apiKeyToken = extractApiKeyToken(request);
  if (apiKeyToken) {
    const resolved = await verifyOrganizationApiKey(apiKeyToken);
    if (resolved) {
      const actor = await resolveActorOrganization(resolved.profileId, resolved.organizationId);
      return {
        profileId: actor.profileId,
        organizationId: actor.organizationId,
        email: null,
        role: actor.role
      };
    }
  }

  const user = await resolveApiAuthIdentity(request);

  const hintedOrg = request.headers.get('x-premortem-organization-id')?.trim() || undefined;
  const resolved = await resolveActorOrganization(user.profileId, hintedOrg, {
    email: user.email ?? null
  });

  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email,
    role: resolved.role
  };
}

import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import {
  resolveActorOrganization,
  extractApiKeyToken,
  extractBearerToken,
  getOrganizationMembershipRole,
  verifyOrganizationApiKey,
  verifySupabaseAccessToken
} from '@premortem/db';
import type { AppRole } from '@premortem/db';
import {
  verifyActorContextSignature,
  verifyUserIdSignature
} from '@premortem/security';

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

function hasValidSignedIdentity(request: Request, profileId: string): boolean {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim() ?? null;
  if (!secret) return false;

  const signedUserId = request.headers.get('x-user-id')?.trim();
  const signature = request.headers.get('x-user-id-sig')?.trim();
  if (!signedUserId || !signature || signedUserId !== profileId) {
    return false;
  }

  return verifyUserIdSignature(profileId, signature, secret);
}

function readSignedActorContext(request: Request) {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim() ?? null;
  if (!secret) return null;

  const profileId = request.headers.get('x-user-id')?.trim();
  const organizationId = request.headers.get('x-premortem-organization-id')?.trim();
  const role = request.headers.get('x-premortem-role')?.trim() as AppRole | null;
  const signature = request.headers.get('x-premortem-context-sig')?.trim();
  if (!profileId || !organizationId || !role || !signature) return null;

  if (!verifyActorContextSignature(profileId, organizationId, role, signature, secret)) return null;

  return { profileId, organizationId, role };
}

export async function resolveApiAuthIdentity(request: Request): Promise<ApiAuthIdentity> {
  if (isLocalAuthBypassEnabled()) {
    return {
      profileId: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      accessToken: null
    };
  }

  const signedProfileId = request.headers.get('x-user-id')?.trim();
  const signedSignature = request.headers.get('x-user-id-sig')?.trim();
  if (signedProfileId && signedSignature && hasValidSignedIdentity(request, signedProfileId)) {
    return {
      profileId: signedProfileId,
      email: request.headers.get('x-premortem-user-email'),
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
        role: 'owner'
      };
    }
    throw new ApiUnauthorizedError('Missing x-premortem-actor-id');
  }
  const hintedOrg = request.headers.get('x-premortem-organization-id')?.trim() || undefined;
  const email = request.headers.get('x-premortem-user-email');

  const signedActorContext = readSignedActorContext(request);
  if (signedActorContext) {
    return {
      profileId: signedActorContext.profileId,
      organizationId: signedActorContext.organizationId,
      email,
      role: signedActorContext.role
    };
  }

  if (hasValidSignedIdentity(request, profileId)) {
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
    return resolveFromHeaders(request);
  }

  const signedActorContext = readSignedActorContext(request);
  if (signedActorContext) {
    return {
      profileId: signedActorContext.profileId,
      organizationId: signedActorContext.organizationId,
      email: request.headers.get('x-premortem-user-email'),
      role: signedActorContext.role
    };
  }

  const signedProfileId = request.headers.get('x-user-id')?.trim();
  const signedSignature = request.headers.get('x-user-id-sig')?.trim();
  if (signedProfileId && signedSignature && hasValidSignedIdentity(request, signedProfileId)) {
    const hintedOrg = request.headers.get('x-premortem-organization-id')?.trim() || undefined;
    const email = request.headers.get('x-premortem-user-email');
    const resolved = await resolveActorOrganization(signedProfileId, hintedOrg, {
      email: email ?? null
    });
    return {
      profileId: resolved.profileId,
      organizationId: resolved.organizationId,
      email,
      role: resolved.role
    };
  }

  const apiKeyToken = extractApiKeyToken(request);
  if (apiKeyToken) {
    const resolved = await verifyOrganizationApiKey(apiKeyToken);
    if (resolved) {
      const role =
        (await getOrganizationMembershipRole({
          organizationId: resolved.organizationId,
          userId: resolved.profileId
        })) ?? 'member';
      return {
        profileId: resolved.profileId,
        organizationId: resolved.organizationId,
        email: null,
        role
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

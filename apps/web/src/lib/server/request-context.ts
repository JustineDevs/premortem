import { headers } from 'next/headers';

import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import { resolveActorOrganization, extractBearerToken, verifySupabaseAccessToken } from '@premortem/db';
import type { AppRole } from '@premortem/db';
import {
  identityHeadersForActorContext,
  verifyActorContextSignature,
  verifyUserIdSignature
} from '@premortem/security';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseAuthConfigured } from '@/lib/supabase/server-config';
import { supabaseProfileHintsFromUser } from '@/lib/supabase/profile-hints';

export function hasValidSignedIdentity(request: Pick<Request, 'headers'>, profileId: string): boolean {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim() ?? null;
  if (!secret) return false;

  const signedUserId = request.headers.get('x-user-id')?.trim();
  const signature = request.headers.get('x-user-id-sig')?.trim();
  if (!signedUserId || !signature || signedUserId !== profileId) {
    return false;
  }

  return verifyUserIdSignature(profileId, signature, secret);
}

function readSignedActorContext(request: Pick<Request, 'headers'>) {
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

export interface RequestActorContext {
  profileId: string;
  organizationId: string;
  email?: string | null;
  accessToken?: string | null;
  role: AppRole;
}

async function resolveFromSupabaseUser(
  userId: string,
  email: string | null | undefined,
  accessToken: string | null
): Promise<RequestActorContext> {
  const resolved = await resolveActorOrganization(userId, undefined, {
    email: email ?? null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: email ?? null,
    accessToken,
    role: resolved.role
  };
}

export async function resolveRequestActorContext(
  incoming?: Pick<Request, 'headers'>
): Promise<RequestActorContext> {
  if (isLocalAuthBypassEnabled()) {
    return {
      profileId: LOCAL_DEV_FIXTURE.profileId,
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      email: LOCAL_DEV_FIXTURE.email,
      accessToken: null,
      role: 'owner'
    };
  }

  const signedUserId = incoming?.headers.get('x-user-id')?.trim();
  const signedSignature = incoming?.headers.get('x-user-id-sig')?.trim();
  const signedActorContext = incoming ? readSignedActorContext(incoming) : null;
  if (signedActorContext) {
    const email = incoming?.headers.get('x-premortem-user-email');
    return {
      profileId: signedActorContext.profileId,
      organizationId: signedActorContext.organizationId,
      email,
      accessToken: null,
      role: signedActorContext.role
    };
  }
  if (incoming && signedUserId && signedSignature && hasValidSignedIdentity(incoming, signedUserId)) {
    const hintedOrg = incoming.headers.get('x-premortem-organization-id')?.trim() || undefined;
    const email = incoming.headers.get('x-premortem-user-email');
    const resolved = await resolveActorOrganization(signedUserId, hintedOrg, {
      email: email ?? null
    });
    return {
      profileId: resolved.profileId,
      organizationId: resolved.organizationId,
      email,
      accessToken: null,
      role: resolved.role
    };
  }

  if (!(await isSupabaseAuthConfigured())) {
    throw new Error('Supabase auth is not configured');
  }

  let bearerFromRequest = incoming ? extractBearerToken(incoming as Request) : null;
  if (!bearerFromRequest) {
    const headerStore = await headers();
    const authorization = headerStore.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
      bearerFromRequest = authorization.slice('Bearer '.length).trim();
    }
  }
  if (bearerFromRequest) {
    const user = await verifySupabaseAccessToken(bearerFromRequest);
    if (user) {
      return resolveFromSupabaseUser(user.id, user.email, bearerFromRequest);
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error('Supabase auth is not configured');
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const resolved = await resolveActorOrganization(user.id, undefined, {
    ...supabaseProfileHintsFromUser(user),
    email: user.email ?? null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email,
    accessToken: session?.access_token ?? null,
    role: resolved.role
  };
}

export function actorHeaders(context: RequestActorContext) {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim() ?? null;
  return {
    ...identityHeadersForActorContext({
      profileId: context.profileId,
      organizationId: context.organizationId,
      role: context.role,
      secret: secret ?? undefined
    }),
    ...(context.email ? { 'x-premortem-user-email': context.email } : {}),
    ...(context.accessToken ? { authorization: `Bearer ${context.accessToken}` } : {})
  };
}

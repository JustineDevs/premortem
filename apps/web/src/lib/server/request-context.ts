import { headers } from 'next/headers';

import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import { resolveActorOrganization } from '@premortem/db/actor-context';
import { extractBearerToken, verifySupabaseAccessToken } from '@premortem/db/supabase-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseProfileHintsFromUser } from '@/lib/supabase/profile-hints';

type AppRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing';

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
    const resolved = await resolveActorOrganization(LOCAL_DEV_FIXTURE.profileId, LOCAL_DEV_FIXTURE.organizationId, {
      email: LOCAL_DEV_FIXTURE.email
    });
    return {
      profileId: resolved.profileId,
      organizationId: resolved.organizationId,
      email: LOCAL_DEV_FIXTURE.email,
      accessToken: null,
      role: resolved.role
    };
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
    accessToken: bearerFromRequest ?? session?.access_token ?? null,
    role: resolved.role
  };
}

export function actorHeaders(context: RequestActorContext) {
  return {
    'x-premortem-actor-id': context.profileId,
    'x-premortem-organization-id': context.organizationId,
    'x-premortem-role': context.role,
    ...(context.email ? { 'x-premortem-user-email': context.email } : {}),
    ...(context.accessToken ? { authorization: `Bearer ${context.accessToken}` } : {})
  };
}

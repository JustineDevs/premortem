import { headers } from 'next/headers';

import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import { resolveActorOrganization, extractBearerToken, verifySupabaseAccessToken } from '@premortem/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseAuthConfigured } from '@/lib/supabase/config';

export interface RequestActorContext {
  profileId: string;
  organizationId: string;
  email?: string | null;
  accessToken?: string | null;
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
    accessToken
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
      accessToken: null
    };
  }

  if (!isSupabaseAuthConfigured()) {
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

  const supabase = createSupabaseServerClient();
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

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const resolved = await resolveActorOrganization(user.id, undefined, {
    email: user.email ?? null,
    fullName: typeof metadata.full_name === 'string' ? metadata.full_name : null,
    username: typeof metadata.user_name === 'string' ? metadata.user_name : null
  });
  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    email: user.email,
    accessToken: session?.access_token ?? null
  };
}

export function actorHeaders(context: RequestActorContext) {
  return {
    'x-premortem-actor-id': context.profileId,
    'x-premortem-organization-id': context.organizationId,
    ...(context.email ? { 'x-premortem-user-email': context.email } : {}),
    ...(context.accessToken ? { authorization: `Bearer ${context.accessToken}` } : {})
  };
}

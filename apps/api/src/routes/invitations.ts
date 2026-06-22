import { acceptOrganizationInvitation, getOrganizationInvitationByToken } from '@premortem/db';

import { apiErrorResponse } from '../lib/error-response';
import { resolveApiAuthIdentity } from '../lib/request-context';

export async function handleInvitationRead(_request: Request, token: string) {
  const invitation = await getOrganizationInvitationByToken(token);
  if (!invitation) {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }

  return Response.json({ invitation });
}

export async function handleInvitationAccept(request: Request, token: string) {
  try {
    const actor = await resolveApiAuthIdentity(request);
    const accepted = await acceptOrganizationInvitation({
      token,
      acceptedById: actor.profileId,
      acceptedByEmail: actor.email
    });

    if (!accepted) {
      return Response.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const refreshed = await getOrganizationInvitationByToken(token);
    return Response.json({ ok: true, invitation: refreshed?.invitation ?? accepted.invitation });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (/not match/i.test(message) || /expired/i.test(message)) {
      return Response.json({ error: 'Invitation is no longer valid.' }, { status: 403 });
    }
    return apiErrorResponse(error, 'Failed to accept invitation', { fallbackStatus: 401 });
  }
}

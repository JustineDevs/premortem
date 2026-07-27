import { installWorkspaceSkillDraft, recordActivityEvent } from '@premortem/db';

import { ORG_ADMIN_ROLES, requireApiRole } from '../lib/authorization.js';
import { resolveApiActorContext } from '../lib/request-context.js';
import { readJsonRecord, readRequiredString } from '../lib/request-body.js';

export async function handleWorkspaceSkillsInstall(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const skillId = readRequiredString(body, 'skillId');
  if (!skillId) {
    return Response.json({ error: 'skillId is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);

  const result = await installWorkspaceSkillDraft({
    organizationId: actor.organizationId,
    skillId
  });

  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'skills.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: `Installed skill draft ${result.draft.title}`
  });

  return Response.json({
    ok: true,
    skills: result.skillState,
    installedSkillId: result.installedSkillId
  });
}

import { listReconciliationEvents } from '@premortem/db';

import { resolveApiActorContext } from '../lib/request-context';

export async function handleReconciliationList(request: Request) {
  const actor = await resolveApiActorContext(request);
  const events = await listReconciliationEvents(actor.organizationId, 25);
  return Response.json({ events });
}

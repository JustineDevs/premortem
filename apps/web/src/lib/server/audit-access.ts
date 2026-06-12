import { NextResponse } from 'next/server';

import { getAuditRunSnapshot } from '@premortem/orchestrator';

import { bffErrorResponse } from '@/lib/server/bff-errors';
import { resolveRequestActorContext } from '@/lib/server/request-context';

type AuditAccessResult =
  | { ok: true; snapshot: NonNullable<Awaited<ReturnType<typeof getAuditRunSnapshot>>> }
  | { ok: false; response: NextResponse };

export async function resolveAuthorizedAuditSnapshot(
  request: Request,
  auditRunId: string
): Promise<AuditAccessResult> {
  try {
    const context = await resolveRequestActorContext(request);
    const snapshot = await getAuditRunSnapshot(auditRunId);
    if (!snapshot || snapshot.organizationId !== context.organizationId) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Audit run not found' }, { status: 404 })
      };
    }
    return { ok: true, snapshot };
  } catch (error) {
    return { ok: false, response: bffErrorResponse(error, 'Failed to authorize audit access') };
  }
}

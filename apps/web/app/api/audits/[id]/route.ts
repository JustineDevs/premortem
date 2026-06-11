import { NextResponse } from 'next/server';

import { fetchRuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await resolveRequestActorContext(request);
    const auditRun = await fetchRuntimeAuditSnapshot(params.id, actorHeaders(context));
    if (auditRun.organizationId !== context.organizationId) {
      return NextResponse.json({ error: 'Audit run not found' }, { status: 404 });
    }
    return NextResponse.json({ auditRun, snapshot: auditRun });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load audit');
  }
}

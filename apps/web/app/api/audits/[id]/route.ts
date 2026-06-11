import { NextResponse } from 'next/server';

import { fetchRuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await resolveRequestActorContext(request);
    const auditRun = await fetchRuntimeAuditSnapshot(params.id, actorHeaders(context));
    return NextResponse.json({ auditRun, snapshot: auditRun });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load audit' },
      { status: 502 }
    );
  }
}

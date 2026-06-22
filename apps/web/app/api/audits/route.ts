import { NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/server/bff-errors';
import { fetchRuntimeAudits } from '@/lib/premortem-api/client';
import { hydrateAuditRunsFromSnapshots, mapAuditListItemToAuditRun } from '@/lib/premortem-api/hydrate-audits';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hydrate = url.searchParams.get('hydrate') === '1';
  const limit = Number(url.searchParams.get('limit') ?? '24');

  try {
    const context = await resolveRequestActorContext(request);
    const headers = actorHeaders(context);
    const auditRuns = await fetchRuntimeAudits(limit, headers);
    const audits = auditRuns.map((audit) =>
      mapAuditListItemToAuditRun(audit, audit.projectName ?? audit.projectId)
    );

    if (!hydrate) {
      return NextResponse.json(audits);
    }

    const hydrated = await hydrateAuditRunsFromSnapshots(
      audits,
      Math.min(limit, 1),
      headers
    );
    return NextResponse.json({
      audits: hydrated.audits,
      riskClusters: hydrated.riskClusters
    });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load audits');
  }
}

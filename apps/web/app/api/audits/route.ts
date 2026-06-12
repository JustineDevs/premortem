import { NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/server/bff-errors';
import {
  fetchRuntimeAudits,
  fetchRuntimeProjects
} from '@/lib/premortem-api/client';
import {
  hydrateAuditRunsFromSnapshots,
  mapAuditListItemToAuditRun,
  projectNameMapFromProjects
} from '@/lib/premortem-api/hydrate-audits';
import { mapRuntimeProject } from '@/lib/premortem-api/map-runtime-to-console';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hydrate = url.searchParams.get('hydrate') === '1';
  const limit = Number(url.searchParams.get('limit') ?? '24');

  try {
    const context = await resolveRequestActorContext(request);
    const headers = actorHeaders(context);
    const [auditRuns, projects] = await Promise.all([
      fetchRuntimeAudits(limit, headers),
      fetchRuntimeProjects(headers)
    ]);
    const projectNameById = projectNameMapFromProjects(
      projects.map((project) => mapRuntimeProject(project as Record<string, unknown>))
    );

    const audits = auditRuns.map((audit) =>
      mapAuditListItemToAuditRun(audit, projectNameById.get(audit.projectId) ?? audit.projectId)
    );

    if (!hydrate) {
      return NextResponse.json(audits);
    }

    const hydrated = await hydrateAuditRunsFromSnapshots(
      audits,
      projectNameById,
      Math.min(limit, 12),
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

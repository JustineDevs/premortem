import { NextResponse } from 'next/server';

import { CanonicalEvents } from '@premortem/observability';
import { trackServerEvent } from '@premortem/observability';

import { publishRuntimeIssue } from '@/lib/premortem-api/client';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { resolveRequestActorContext, actorHeaders } from '@/lib/server/request-context';

export async function POST(
  request: Request,
  { params }: { params: { issueId: string } }
) {
  if (!checkBffRateLimit(bffRateLimitKey(request, `/api/issues/${params.issueId}/publish`))) {
    return bffRateLimitResponse();
  }

  try {
    const context = await resolveRequestActorContext(request);
    const payload = await publishRuntimeIssue(params.issueId, actorHeaders(context));
    trackServerEvent(context.profileId, CanonicalEvents.issuePublished, {
      issueCandidateId: params.issueId,
      dryRun: payload.dryRun === true
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? Number(statusMatch[1]) : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

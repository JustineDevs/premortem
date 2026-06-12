import { NextResponse } from 'next/server';

import { CanonicalEvents } from '@premortem/observability';
import { trackServerEvent } from '@premortem/observability';

import { proxyPremortemApi } from '@/lib/server/proxy-api';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(
  request: Request,
  { params }: { params: { issueId: string } }
) {
  if (!checkBffRateLimit(bffRateLimitKey(request, `/api/issues/${params.issueId}/publish`))) {
    return bffRateLimitResponse();
  }

  try {
    const context = await resolveRequestActorContext(request);
    const response = await proxyPremortemApi(
      `/api/issues/${params.issueId}/publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      request
    );
    const payload = (await response.json().catch(() => ({}))) as {
      dryRun?: boolean;
      ok?: boolean;
    };

    if (response.ok) {
      trackServerEvent(context.profileId, CanonicalEvents.issuePublished, {
        issueCandidateId: params.issueId,
        dryRun: payload.dryRun === true
      });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { CanonicalEvents } from '@/lib/canonical/events';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { resolveRequestActorContext } from '@/lib/server/request-context';
import { trackServerEvent } from '@/lib/server/track-server-event';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  if (!checkBffRateLimit(bffRateLimitKey(request, `/api/issues/${issueId}/publish`))) {
    return bffRateLimitResponse();
  }

  try {
    const context = await resolveRequestActorContext(request);
    const response = await proxyPremortemApi(
      `/api/issues/${issueId}/publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      request
    );
    const payload = (await response.clone().json().catch(() => ({}))) as {
      dryRun?: boolean;
      ok?: boolean;
    };

    if (response.ok) {
      trackServerEvent(context.profileId, CanonicalEvents.issuePublished, {
        issueCandidateId: issueId,
        dryRun: payload.dryRun === true
      });
    }

    return new Response(response.body, { status: response.status, headers: response.headers });
  } catch (error) {
    return bffErrorResponse(error, 'Publish failed');
  }
}

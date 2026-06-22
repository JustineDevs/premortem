import { proxyPremortemApi } from '@/lib/server/proxy-api';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { readJsonRecord, readOptionalString } from '@/lib/server/request-body';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  const path = `/api/issues/${issueId}/split`;
  if (!checkBffRateLimit(bffRateLimitKey(request, path))) {
    return bffRateLimitResponse();
  }

  try {
    const context = await resolveRequestActorContext(request);
    const body = (await readJsonRecord(request)) ?? {};
    const title = readOptionalString(body, 'title');
    const notes = readOptionalString(body, 'notes');
    return proxyPremortemApi(
      path,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...actorHeaders(context)
        },
        body: JSON.stringify({
          title,
          notes
        })
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Split failed');
  }
}

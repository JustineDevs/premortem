import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestActorContext(request);
    const url = new URL(request.url);
    const response = await fetch(
      `${getApiBaseUrl()}/api/workspace/activity/export${url.search}`,
      {
        headers: {
          accept: request.headers.get('accept') ?? 'application/json',
          ...actorHeaders(context)
        },
        cache: 'no-store'
      }
    );
    return response;
  } catch (error) {
    return bffErrorResponse(error, 'Failed to export activity log');
  }
}

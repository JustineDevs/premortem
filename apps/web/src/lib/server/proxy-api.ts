import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { trackServerEvent } from '@/lib/server/track-server-event';

export async function proxyPremortemApi(path: string, init?: RequestInit, request?: Request) {
  if (request && !checkBffRateLimit(bffRateLimitKey(request, path))) {
    return bffRateLimitResponse();
  }

  let context: Awaited<ReturnType<typeof resolveRequestActorContext>>;
  try {
    context = await resolveRequestActorContext(request);
  } catch (error) {
    return bffErrorResponse(error, 'Unauthorized');
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.headers ?? {}),
        ...actorHeaders(context)
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      trackServerEvent(context.profileId, 'bff_proxy_error', {
        path,
        status: response.status,
        duration_ms: Date.now() - startedAt
      });
    }

    const requestId = response.headers.get('x-request-id');
    const headers = new Headers(response.headers);
    if (requestId) {
      headers.set('x-request-id', requestId);
    }

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error(error);
    trackServerEvent(context.profileId, 'bff_proxy_exception', {
      path,
      duration_ms: Date.now() - startedAt
    });
    return bffErrorResponse(error, 'Upstream API request failed');
  }
}

/** @deprecated Prefer proxyPremortemApi; kept for route compatibility. */
export async function proxyPremortemApiOrUnauthorized(
  path: string,
  init?: RequestInit,
  request?: Request
) {
  return proxyPremortemApi(path, init, request);
}

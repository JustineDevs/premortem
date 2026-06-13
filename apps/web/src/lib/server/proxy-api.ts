import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { bffErrorResponse, readUpstreamJson } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { trackServerEvent } from '@/lib/server/track-server-event';

export async function proxyPremortemApi(path: string, init?: RequestInit, request?: Request) {
  if (request && !checkBffRateLimit(bffRateLimitKey(request, path))) {
    return bffRateLimitResponse();
  }

  const context = await resolveRequestActorContext(request);
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

    const payload = await readUpstreamJson(response);

    if (!response.ok) {
      trackServerEvent(context.profileId, 'bff_proxy_error', {
        path,
        status: response.status,
        duration_ms: Date.now() - startedAt
      });
    }

    const requestId = response.headers.get('x-request-id');
    return NextResponse.json(payload, {
      status: response.status,
      headers: requestId ? { 'x-request-id': requestId } : undefined
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

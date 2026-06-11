import { NextResponse } from 'next/server';

import { captureException } from '@sentry/nextjs';
import { trackServerEvent } from '@premortem/observability';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

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

    const payload = await response.json().catch(() => ({}));

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
    captureException(error);
    trackServerEvent(context.profileId, 'bff_proxy_exception', {
      path,
      duration_ms: Date.now() - startedAt
    });
    throw error;
  }
}

export async function proxyPremortemApiOrUnauthorized(
  path: string,
  init?: RequestInit,
  request?: Request
) {
  try {
    return await proxyPremortemApi(path, init, request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

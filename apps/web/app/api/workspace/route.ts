import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse, readUpstreamJson } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext, type RequestActorContext } from '@/lib/server/request-context';

async function proxyApi(path: string, init?: RequestInit, context?: RequestActorContext) {
  const actor = context ?? (await resolveRequestActorContext());
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
      ...actorHeaders(actor)
    },
    cache: 'no-store'
  });
  const payload = await readUpstreamJson(response);
  const requestId = response.headers.get('x-request-id');
  return NextResponse.json(payload, {
    status: response.status,
    headers: requestId ? { 'x-request-id': requestId } : undefined
  });
}

export async function GET(request: Request) {
  try {
    const context = await resolveRequestActorContext(request);
    return await proxyApi('/api/workspace', undefined, context);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load workspace');
  }
}

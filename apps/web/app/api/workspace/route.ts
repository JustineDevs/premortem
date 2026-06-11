import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
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
  const payload = await response.json();
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load workspace' },
      { status: 401 }
    );
  }
}

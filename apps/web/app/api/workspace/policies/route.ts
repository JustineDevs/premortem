import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

async function proxyPatch(path: string, request: Request) {
  const context = await resolveRequestActorContext();
  const body = await request.json();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...actorHeaders(context)
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function PATCH(request: Request) {
  try {
    return proxyPatch('/api/workspace/policies', request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 502 });
  }
}

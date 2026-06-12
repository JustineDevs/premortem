import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

async function patchWorkspace(path: string, body: unknown, request: Request) {
  const context = await resolveRequestActorContext(request);
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
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return patchWorkspace('/api/workspace/profile', body, request);
  } catch (error) {
    return bffErrorResponse(error, 'Profile update failed');
  }
}

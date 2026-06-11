import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

async function patchWorkspace(path: string, body: unknown) {
  const context = await resolveRequestActorContext();
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
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return patchWorkspace('/api/workspace/profile', body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Profile update failed' },
      { status: 502 }
    );
  }
}

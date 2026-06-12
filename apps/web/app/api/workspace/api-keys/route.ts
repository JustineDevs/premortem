import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestActorContext(request);
    const body = await request.json();
    const response = await fetch(`${getApiBaseUrl()}/api/workspace/api-keys`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...actorHeaders(context)
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to create API key');
  }
}

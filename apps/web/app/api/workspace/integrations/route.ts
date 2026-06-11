import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request) {
  try {
    const context = await resolveRequestActorContext();
    const body = await request.json();
    const response = await fetch(`${getApiBaseUrl()}/api/workspace/integrations`, {
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 502 });
  }
}

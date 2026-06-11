import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET() {
  try {
    const context = await resolveRequestActorContext();
    const response = await fetch(`${getApiBaseUrl()}/api/reconciliation`, {
      headers: {
        accept: 'application/json',
        ...actorHeaders(context)
      },
      cache: 'no-store'
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 502 });
  }
}

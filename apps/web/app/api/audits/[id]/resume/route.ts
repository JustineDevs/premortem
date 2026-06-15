import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveRequestActorContext();
    const response = await fetch(`${getApiBaseUrl()}/api/audits/${id}/resume`, {
      method: 'POST',
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

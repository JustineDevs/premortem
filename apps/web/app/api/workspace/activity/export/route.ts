import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse, readUpstreamJson } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request) {
  try {
    const context = await resolveRequestActorContext(request);
    const url = new URL(request.url);
    const response = await fetch(
      `${getApiBaseUrl()}/api/workspace/activity/export${url.search}`,
      {
        headers: {
          accept: request.headers.get('accept') ?? 'application/json',
          ...actorHeaders(context)
        },
        cache: 'no-store'
      }
    );

    if (response.headers.get('content-type')?.includes('text/csv')) {
      return new NextResponse(await response.text(), {
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'text/csv; charset=utf-8',
          'content-disposition':
            response.headers.get('content-disposition') ?? 'attachment; filename="export.csv"'
        }
      });
    }

    const payload = await readUpstreamJson(response);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to export activity log');
  }
}

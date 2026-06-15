import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const context = await resolveRequestActorContext(request);
    const { keyId } = await params;
    const response = await fetch(`${getApiBaseUrl()}/api/workspace/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        ...actorHeaders(context)
      },
      cache: 'no-store'
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to revoke API key');
  }
}

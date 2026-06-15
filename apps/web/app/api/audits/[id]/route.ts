import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await resolveRequestActorContext(request);
    const response = await fetch(`${getApiBaseUrl()}/api/audits/${id}`, {
      headers: {
        accept: 'application/json',
        ...actorHeaders(context)
      },
      cache: 'no-store'
    });

    const requestId = response.headers.get('x-request-id');
    const payload = (await response.json()) as {
      auditRun?: { organizationId?: string } & Record<string, unknown>;
      snapshot?: { organizationId?: string } & Record<string, unknown>;
    };
    const auditRun = payload.auditRun ?? payload.snapshot;

    if (!response.ok) {
      return NextResponse.json(payload, {
        status: response.status,
        headers: requestId ? { 'x-request-id': requestId } : undefined
      });
    }

    if (!auditRun || auditRun.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Audit run not found' },
        {
          status: 404,
          headers: requestId ? { 'x-request-id': requestId } : undefined
        }
      );
    }
    return NextResponse.json(
      { auditRun, snapshot: auditRun },
      { headers: requestId ? { 'x-request-id': requestId } : undefined }
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load audit');
  }
}

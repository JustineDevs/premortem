import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return proxyPremortemApi(`/api/audits/${id}/resume`, { method: 'POST' }, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to resume audit');
  }
}

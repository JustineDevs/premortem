import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return proxyPremortemApi(`/api/workspace/integrations/${id}/sync`, { method: 'POST' }, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to sync integration');
  }
}

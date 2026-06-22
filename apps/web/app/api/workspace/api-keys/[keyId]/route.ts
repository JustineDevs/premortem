import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const { keyId } = await params;
    return proxyPremortemApi(`/api/workspace/api-keys/${keyId}`, { method: 'DELETE' }, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to revoke API key');
  }
}

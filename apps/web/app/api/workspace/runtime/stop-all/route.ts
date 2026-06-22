import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function POST(request: Request) {
  try {
    return proxyPremortemApi('/api/workspace/runtime/stop-all', {
      method: 'POST',
      headers: { accept: 'application/json' }
    }, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to stop workspace runtime');
  }
}

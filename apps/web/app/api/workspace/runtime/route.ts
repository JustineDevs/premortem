import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return proxyPremortemApi(
      '/api/workspace/runtime',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to update runtime settings');
  }
}

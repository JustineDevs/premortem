import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function PATCH(request: Request) {
  try {
    return proxyPremortemApi(
      '/api/workspace/policies',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: await request.text()
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to update workspace policies');
  }
}

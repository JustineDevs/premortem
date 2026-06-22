import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function PATCH(request: Request) {
  try {
    return proxyPremortemApi(
      '/api/workspace/profile',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: await request.text()
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Profile update failed');
  }
}

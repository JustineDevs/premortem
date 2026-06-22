import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return proxyPremortemApi(
      '/api/workspace/notifications',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to update notifications');
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.search ? `?${url.searchParams.toString()}` : '';
    return proxyPremortemApi(`/api/workspace/notifications${query}`, undefined, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load notifications');
  }
}

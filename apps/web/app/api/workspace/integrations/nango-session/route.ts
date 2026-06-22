import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function POST(request: Request) {
  try {
    return proxyPremortemApi(
      '/api/workspace/integrations/nango-session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: await request.text()
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to create Nango connect session');
  }
}

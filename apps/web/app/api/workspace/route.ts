import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function GET(request: Request) {
  try {
    return await proxyPremortemApi('/api/workspace', undefined, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load workspace');
  }
}

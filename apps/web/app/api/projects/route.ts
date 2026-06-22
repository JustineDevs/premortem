import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function GET(request: Request) {
  try {
    return proxyPremortemApi('/api/projects', undefined, request);
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load projects');
  }
}

export async function POST(request: Request) {
  return proxyPremortemApi(
    '/api/projects',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text()
    },
    request
  );
}

import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyPremortemApiOrUnauthorized(
    '/api/projects/public',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    },
    request
  );
}

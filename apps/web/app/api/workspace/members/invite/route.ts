import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function POST(request: Request) {
  return proxyPremortemApi(
    '/api/workspace/members/invite',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text()
    },
    request
  );
}

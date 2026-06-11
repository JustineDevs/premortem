import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.text();
  return proxyPremortemApiOrUnauthorized(
    `/api/workspace/integrations/${params.id}/repositories/enable`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    },
    request
  );
}

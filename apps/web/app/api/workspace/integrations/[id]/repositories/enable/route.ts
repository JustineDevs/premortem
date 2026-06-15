import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await request.text();
  const { id } = await params;
  return proxyPremortemApiOrUnauthorized(
    `/api/workspace/integrations/${id}/repositories/enable`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    },
    request
  );
}

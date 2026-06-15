import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyPremortemApiOrUnauthorized(
    `/api/workspace/integrations/${id}/repositories`,
    { method: 'GET' },
    request
  );
}

import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return proxyPremortemApiOrUnauthorized(
    `/api/workspace/integrations/${params.id}/repositories`,
    { method: 'GET' },
    request
  );
}

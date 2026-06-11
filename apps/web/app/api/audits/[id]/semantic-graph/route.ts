import { proxyPremortemApi } from '@/lib/server/proxy-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return proxyPremortemApi(`/api/audits/${params.id}/semantic-graph`, undefined, request);
}

import { proxyPremortemApi } from '@/lib/server/proxy-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyPremortemApi(`/api/audits/${id}/semantic-graph`, undefined, request);
}

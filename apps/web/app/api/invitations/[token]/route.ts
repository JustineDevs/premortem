import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return proxyPremortemApi(`/api/invitations/${token}`, undefined, _request);
}

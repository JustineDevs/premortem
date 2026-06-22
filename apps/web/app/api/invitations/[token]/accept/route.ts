import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return proxyPremortemApi(
    `/api/invitations/${token}/accept`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    },
    request
  );
}

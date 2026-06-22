import { proxyPremortemApi } from '@/lib/server/proxy-api';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  const path = `/api/issues/${issueId}/outcome`;
  if (!checkBffRateLimit(bffRateLimitKey(request, path))) {
    return bffRateLimitResponse();
  }

  let payload: Record<string, unknown> = {};
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      payload = body as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }
  return proxyPremortemApi(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    },
    request
  );
}

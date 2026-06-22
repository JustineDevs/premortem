import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return proxyPremortemApi(`/api/projects/${projectId}/accuracy`, undefined, request);
}

import { bffErrorResponse } from '@/lib/server/bff-errors';
import { proxyPremortemApi } from '@/lib/server/proxy-api';

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = await request.json();
    const { projectId } = await params;
    return proxyPremortemApi(
      `/api/projects/${projectId}/settings`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      request
    );
  } catch (error) {
    return bffErrorResponse(error, 'Failed to update project settings');
  }
}

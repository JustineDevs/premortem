import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function POST(request: Request) {
  return proxyPremortemApiOrUnauthorized('/api/issues/reconcile', { method: 'POST' }, request);
}

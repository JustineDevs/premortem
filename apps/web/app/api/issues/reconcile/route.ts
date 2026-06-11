import { NextResponse } from 'next/server';

import { proxyPremortemApiOrUnauthorized } from '@/lib/server/proxy-api';

export async function POST() {
  return proxyPremortemApiOrUnauthorized('/api/issues/reconcile', { method: 'POST' });
}

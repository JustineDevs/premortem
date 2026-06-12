import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';

export async function GET() {
  try {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/health`, { cache: 'no-store' });
    return NextResponse.json({
      ok: response.ok,
      apiHealthy: response.ok,
      service: 'premortem-web-bff'
    });
  } catch {
    return NextResponse.json({ ok: false, apiHealthy: false, service: 'premortem-web-bff' }, { status: 503 });
  }
}

import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../src/lib/runtime-config';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'premortem-web',
    mode: 'nextjs',
    apiBaseUrl: getApiBaseUrl()
  });
}

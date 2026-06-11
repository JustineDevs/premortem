import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiBase = process.env.PREMORTEM_API_BASE_URL ?? 'http://127.0.0.1:18787';
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

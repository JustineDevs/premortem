import { NextResponse } from 'next/server';
import { runSecurityAudit } from '@/lib/premortem-os/run-audit';

export async function POST(request: Request) {
  const body = (await request.json()) as { projectId?: string; customSnippet?: string };
  const result = await runSecurityAudit(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true, audit: result.audit });
}

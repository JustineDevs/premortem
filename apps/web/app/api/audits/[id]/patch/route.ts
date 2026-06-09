import { NextResponse } from 'next/server';
import { deployPatch } from '@/lib/premortem-os/patch-audit';

export async function POST(request: Request, context: { params: { id: string } }) {
  const body = (await request.json()) as { issueId?: string };
  const issueId = body.issueId;

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  const result = deployPatch(context.params.id, issueId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    finding: result.finding,
    auditScore: result.auditScore
  });
}

import { NextResponse } from 'next/server';
import type { IssueStatusType } from '@/lib/premortem-os/types';
import { updateFindingStatus } from '@/lib/premortem-os/patch-audit';

export async function POST(
  request: Request,
  context: { params: { id: string; issueId: string } }
) {
  const body = (await request.json()) as { action?: IssueStatusType };
  const action = body.action;

  if (!action) {
    return NextResponse.json({ error: 'Action is required' }, { status: 400 });
  }

  const result = updateFindingStatus(context.params.id, context.params.issueId, action);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true, finding: result.finding });
}

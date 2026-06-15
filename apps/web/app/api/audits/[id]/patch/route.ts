import { NextResponse } from 'next/server';

import { ConsoleReviewAction, consoleReviewActionNotes } from '@premortem/domain';
import { approveRuntimeIssue } from '@/lib/premortem-api/client';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = (await request.json()) as { issueId?: string };
  const issueId = body.issueId;

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  try {
    const actor = await resolveRequestActorContext();
    await approveRuntimeIssue(issueId, consoleReviewActionNotes(ConsoleReviewAction.RESOLVE), actorHeaders(actor));
    const { id } = await context.params;

    return NextResponse.json({
      success: true,
      auditId: id,
      issueId,
      action: ConsoleReviewAction.RESOLVE,
      patchApplied: true,
      message: 'Remediation acknowledged; issue marked approved in runtime review queue.'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Patch acknowledgment failed' },
      { status: 502 }
    );
  }
}

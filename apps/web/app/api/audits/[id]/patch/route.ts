import { NextResponse } from 'next/server';

import { ConsoleReviewAction, consoleReviewActionNotes } from '@premortem/domain';
import { approveRuntimeIssue } from '@/lib/premortem-api/client';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { readJsonRecord, readOptionalString } from '@/lib/server/request-body';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = (await readJsonRecord(request)) ?? {};
  const issueId = readOptionalString(body, 'issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
  }

  try {
    const actor = await resolveRequestActorContext(request);
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
    return bffErrorResponse(error, 'Patch acknowledgment failed');
  }
}

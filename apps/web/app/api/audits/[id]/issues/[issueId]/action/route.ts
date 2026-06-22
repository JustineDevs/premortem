import { NextResponse } from 'next/server';

import {
  type ConsoleReviewActionValue,
  ConsoleReviewAction,
  ReviewAction,
  consoleReviewActionNotes,
  consoleReviewActionToReviewAction
} from '@premortem/domain';

import {
  approveRuntimeIssue,
  deferRuntimeIssue,
  editRuntimeIssue,
  mergeRuntimeIssue,
  publishRuntimeIssue,
  rejectRuntimeIssue,
  splitRuntimeIssue
} from '@/lib/premortem-api/client';
import { CanonicalEvents } from '@/lib/canonical/events';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import {
  readJsonRecord,
  readOptionalRecord,
  readOptionalString,
  readOptionalStringLiteral
} from '@/lib/server/request-body';
import { trackServerEvent } from '@/lib/server/track-server-event';

const ALLOWED_CONSOLE_ACTIONS = Object.values(ConsoleReviewAction) as ConsoleReviewActionValue[];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { id, issueId } = await params;
  const rateKey = `/api/audits/${id}/issues/${issueId}/action`;
  if (!checkBffRateLimit(bffRateLimitKey(request, rateKey))) {
    return bffRateLimitResponse();
  }

  const body = (await readJsonRecord(request)) ?? {};
  const action = readOptionalStringLiteral(body, 'action', ALLOWED_CONSOLE_ACTIONS);
  const fields = readOptionalRecord(body, 'fields') ?? undefined;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  try {
    const context = await resolveRequestActorContext(request);
    const headers = actorHeaders(context);
    const reviewAction = consoleReviewActionToReviewAction(action);
    const notes = consoleReviewActionNotes(action);

    if (reviewAction === ReviewAction.APPROVE) {
      await approveRuntimeIssue(issueId, notes, headers);
    } else if (reviewAction === ReviewAction.REJECT) {
      await rejectRuntimeIssue(issueId, notes, headers);
    } else if (reviewAction === ReviewAction.MERGE) {
      const mergedIntoIssueCandidateId = readOptionalString(body, 'mergedIntoIssueCandidateId');
      if (!mergedIntoIssueCandidateId) {
        return NextResponse.json(
          { error: 'mergedIntoIssueCandidateId is required for merge' },
          { status: 400 }
        );
      }
      await mergeRuntimeIssue(
        issueId,
        {
          mergedIntoIssueCandidateId,
          notes
        },
        headers
      );
    } else if (reviewAction === ReviewAction.SPLIT) {
      await splitRuntimeIssue(issueId, fields ?? {}, headers);
    } else if (reviewAction === ReviewAction.EDIT && body.action === ConsoleReviewAction.DEFER) {
      await deferRuntimeIssue(issueId, notes, headers);
    } else if (reviewAction === ReviewAction.PUBLISH) {
      const publishPayload = await publishRuntimeIssue(issueId, headers);
      trackServerEvent(context.profileId, CanonicalEvents.issuePublished, {
        issueCandidateId: issueId,
        auditRunId: id,
        dryRun: publishPayload.dryRun === true
      });
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    if (fields && Object.keys(fields).length > 0 && reviewAction !== ReviewAction.SPLIT) {
      await editRuntimeIssue(issueId, fields, headers);
    }

    trackServerEvent(context.profileId, CanonicalEvents.issueReviewed, {
      auditRunId: id,
      issueId,
      action: body.action
    });

    return NextResponse.json({
      success: true,
      auditId: id,
      issueId,
      action,
      reviewAction
    });
  } catch (error) {
    return bffErrorResponse(error, 'Review action failed');
  }
}

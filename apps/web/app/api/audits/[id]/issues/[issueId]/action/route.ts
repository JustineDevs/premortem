import { NextResponse } from 'next/server';

import {
  type ConsoleReviewActionValue,
  ConsoleReviewAction,
  ReviewAction,
  consoleReviewActionNotes,
  consoleReviewActionPayload,
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
import { bffRateLimitKey, bffRateLimitResponse, checkBffRateLimit } from '@/lib/server/bff-rate-limit';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';
import { trackServerEvent } from '@/lib/server/track-server-event';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { id, issueId } = await params;
  const rateKey = `/api/audits/${id}/issues/${issueId}/action`;
  if (!checkBffRateLimit(bffRateLimitKey(request, rateKey))) {
    return bffRateLimitResponse();
  }

  const body = (await request.json()) as {
    action?: ConsoleReviewActionValue;
    mergedIntoIssueCandidateId?: string;
    fields?: {
      title?: string;
      whyItMatters?: string;
      recommendedActionSummary?: string;
    };
  };

  if (!body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  try {
    const context = await resolveRequestActorContext(request);
    const headers = actorHeaders(context);
    const reviewAction = consoleReviewActionToReviewAction(body.action);
    const notes = consoleReviewActionNotes(body.action);
    const payload = consoleReviewActionPayload(body.action, body.fields);

    if (reviewAction === ReviewAction.APPROVE) {
      await approveRuntimeIssue(issueId, notes, headers);
    } else if (reviewAction === ReviewAction.REJECT) {
      await rejectRuntimeIssue(issueId, notes, headers);
    } else if (reviewAction === ReviewAction.MERGE) {
      if (!body.mergedIntoIssueCandidateId) {
        return NextResponse.json(
          { error: 'mergedIntoIssueCandidateId is required for merge' },
          { status: 400 }
        );
      }
      await mergeRuntimeIssue(
        issueId,
        {
          mergedIntoIssueCandidateId: body.mergedIntoIssueCandidateId,
          notes
        },
        headers
      );
    } else if (reviewAction === ReviewAction.SPLIT) {
      await splitRuntimeIssue(issueId, body.fields ?? {}, headers);
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

    if (body.fields && Object.keys(body.fields).length > 0 && reviewAction !== ReviewAction.SPLIT) {
      await editRuntimeIssue(issueId, body.fields, headers);
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
      action: body.action,
      reviewAction
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review action failed';
    const status = message.includes('(422)') ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

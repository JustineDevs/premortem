import {
  EntitlementError,
  PublishNotApprovedError,
  assertCanPublish,
  assertIssueCandidateApprovedForPublish,
  recordReviewAction,
  splitIssueCandidate
} from '@premortem/db';
import { ReviewAction, ReviewStatus, allowsPublishDryRun, allowsReconcileDryRun } from '@premortem/domain';
import { publishIssueCandidate, reconcilePublishedIssues } from '@premortem/gitlab-sync';

import { resolveApiActorContext } from '../lib/request-context';

export async function handleIssueApprove(request: Request, issueCandidateId: string) {
  const body = (await request.json().catch(() => ({}))) as { notes?: string };
  const actor = await resolveApiActorContext(request);
  const action = await recordReviewAction({
    issueCandidateId,
    actorId: actor.profileId,
    actionType: ReviewAction.APPROVE,
    notes: body.notes
  });
  return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.APPROVED });
}

export async function handleIssueReject(request: Request, issueCandidateId: string) {
  const body = (await request.json().catch(() => ({}))) as { notes?: string };
  const actor = await resolveApiActorContext(request);
  const action = await recordReviewAction({
    issueCandidateId,
    actorId: actor.profileId,
    actionType: ReviewAction.REJECT,
    notes: body.notes
  });
  return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.REJECTED });
}

export async function handleIssueEdit(request: Request, issueCandidateId: string) {
  const body = (await request.json()) as {
    notes?: string;
    title?: string;
    whyItMatters?: string;
    recommendedActionSummary?: string;
    deferred?: boolean;
  };
  const actor = await resolveApiActorContext(request);
  const action = await recordReviewAction({
    issueCandidateId,
    actorId: actor.profileId,
    actionType: ReviewAction.EDIT,
    notes: body.notes,
    payload: body.deferred ? { deferred: true } : body
  });
  return Response.json({
    ok: true,
    action,
    reviewerStatus: body.deferred ? ReviewStatus.PENDING : ReviewStatus.EDITED
  });
}

export async function handleIssueMerge(request: Request, issueCandidateId: string) {
  const body = (await request.json()) as {
    mergedIntoIssueCandidateId?: string;
    notes?: string;
  };

  if (!body.mergedIntoIssueCandidateId?.trim()) {
    return Response.json(
      { error: 'mergedIntoIssueCandidateId is required', code: 'merge_target_required', field: 'mergedIntoIssueCandidateId' },
      { status: 400 }
    );
  }

  const actor = await resolveApiActorContext(request);
  const action = await recordReviewAction({
    issueCandidateId,
    actorId: actor.profileId,
    actionType: ReviewAction.MERGE,
    notes: body.notes,
    payload: { mergedIntoIssueCandidateId: body.mergedIntoIssueCandidateId }
  });
  return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.REJECTED });
}

export async function handleIssueSplit(request: Request, issueCandidateId: string) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    notes?: string;
  };

  const title = body.title?.trim();
  if (!title) {
    return Response.json(
      { error: 'title is required for split', code: 'split_title_required', field: 'title' },
      { status: 400 }
    );
  }

  const actor = await resolveApiActorContext(request);
  const result = await splitIssueCandidate({
    issueCandidateId,
    actorId: actor.profileId,
    title,
    notes: body.notes
  });

  return Response.json({
    ok: true,
    action: result.action,
    childIssueCandidate: {
      id: result.child.id,
      title: result.child.title,
      reviewerStatus: result.child.reviewerStatus
    }
  });
}

export async function handleIssuePublish(request: Request, issueCandidateId: string) {
  const actor = await resolveApiActorContext(request);

  try {
    const { prisma } = await import('@premortem/db');
    const candidate = await prisma.issueCandidate.findUniqueOrThrow({
      where: { id: issueCandidateId },
      select: { project: { select: { organizationId: true } } }
    });
    await assertIssueCandidateApprovedForPublish(issueCandidateId);
    await assertCanPublish(candidate.project.organizationId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof PublishNotApprovedError) {
      return Response.json(
        { error: error.message, code: error.code, field: error.field },
        { status: error.status }
      );
    }
    throw error;
  }

  let published;
  try {
    if (allowsPublishDryRun()) {
      published = {
        alreadyPublished: false,
        publishedIssue: {
          id: `dry-run-${issueCandidateId}`,
          url: null
        }
      };
    } else {
      published = await publishIssueCandidate(issueCandidateId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return Response.json({ error: message, code: 'publish_failed' }, { status: 502 });
  }

  const action = await recordReviewAction({
    issueCandidateId,
    actorId: actor.profileId,
    actionType: ReviewAction.PUBLISH,
    payload: {
      publishedIssueId: published.publishedIssue.id,
      url: published.publishedIssue.url,
      alreadyPublished: published.alreadyPublished
    }
  });

  return Response.json({
    ok: true,
    action,
    publishedIssue: published.publishedIssue,
    alreadyPublished: published.alreadyPublished,
    dryRun: allowsPublishDryRun()
  });
}

export async function handleIssueReconcile(request: Request) {
  const actor = await resolveApiActorContext(request);

  try {
    const result = await reconcilePublishedIssues({ organizationId: actor.organizationId });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (allowsReconcileDryRun()) {
      return Response.json({ ok: true, reconciledCount: 0, driftedCount: 0, failedCount: 0, dryRun: true });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Reconciliation failed' },
      { status: 502 }
    );
  }
}

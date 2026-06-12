import {
  AuditReadinessError,
  EntitlementError,
  PublishNotApprovedError,
  assertCanPublish,
  assertGitLabPublishReadiness,
  assertIssueCandidateApprovedForPublish,
  recordReviewAction,
  splitIssueCandidate
} from '@premortem/db';
import { ReviewAction, ReviewStatus, allowsPublishDryRun, allowsReconcileDryRun, skipsPublishEntitlementCheck } from '@premortem/domain';
import { publishIssueCandidate, reconcilePublishedIssues } from '@premortem/gitlab-sync';

import { resolveApiActorContext } from '../lib/request-context';

function isMissingIssueCandidateError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const record = error as Error & { code?: string };
  return (
    record.code === 'P2025' ||
    /issue candidate .* not found/i.test(record.message) ||
    /no issuecandidate found/i.test(record.message)
  );
}

function issueCandidateNotFoundResponse(issueCandidateId: string) {
  return Response.json({ error: `Issue candidate ${issueCandidateId} not found` }, { status: 404 });
}

export async function handleIssueApprove(request: Request, issueCandidateId: string) {
  const body = (await request.json().catch(() => ({}))) as { notes?: string };
  try {
    const actor = await resolveApiActorContext(request);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.APPROVE,
      notes: body.notes
    });
    return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.APPROVED });
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
}

export async function handleIssueReject(request: Request, issueCandidateId: string) {
  const body = (await request.json().catch(() => ({}))) as { notes?: string };
  try {
    const actor = await resolveApiActorContext(request);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.REJECT,
      notes: body.notes
    });
    return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.REJECTED });
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
}

export async function handleIssueEdit(request: Request, issueCandidateId: string) {
  const body = (await request.json()) as {
    notes?: string;
    title?: string;
    whyItMatters?: string;
    recommendedActionSummary?: string;
    deferred?: boolean;
  };
  try {
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
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
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

  try {
    const actor = await resolveApiActorContext(request);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.MERGE,
      notes: body.notes,
      payload: { mergedIntoIssueCandidateId: body.mergedIntoIssueCandidateId }
    });
    return Response.json({ ok: true, action, reviewerStatus: ReviewStatus.REJECTED });
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
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

  try {
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
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
}

export async function handleIssuePublish(request: Request, issueCandidateId: string) {
  const actor = await resolveApiActorContext(request);

  try {
    const { prisma } = await import('@premortem/db');
    const candidate = await prisma.issueCandidate.findUnique({
      where: { id: issueCandidateId },
      select: { projectId: true, project: { select: { organizationId: true } } }
    });
    if (!candidate) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    await assertIssueCandidateApprovedForPublish(issueCandidateId);
    if (!skipsPublishEntitlementCheck()) {
      await assertCanPublish(candidate.project.organizationId);
    }
    await assertGitLabPublishReadiness(candidate.projectId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AuditReadinessError) {
      return Response.json(
        { error: error.message, code: error.code, field: error.field, system: error.system },
        { status: 422 }
      );
    }
    if (error instanceof PublishNotApprovedError) {
      return Response.json(
        { error: error.message, code: error.code, field: error.field },
        { status: error.status }
      );
    }
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
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

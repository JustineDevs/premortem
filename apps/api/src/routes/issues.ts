import {
  AuditReadinessError,
  EntitlementError,
  PublishNotApprovedError,
  assertCanPublish,
  assertGitLabPublishReadiness,
  assertIssueCandidateApprovedForPublish,
  recordPublishedIssueOutcome,
  recordReviewAction,
  splitIssueCandidate
} from '@premortem/db';
import {
  ReviewAction,
  ReviewStatus,
  allowsPublishDryRun,
  allowsReconcileDryRun,
  skipsPublishEntitlementCheck
} from '@premortem/domain';
import { publishIssueCandidate, reconcilePublishedIssues } from '@premortem/gitlab-sync';

import { apiErrorResponse } from '../lib/error-response';
import { ORG_ADMIN_ROLES, ORG_WRITE_ROLES, requireApiRole } from '../lib/authorization';
import {
  readJsonRecord,
  readOptionalString,
  readRequiredString
} from '../lib/request-body';
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

function publishedIssueNotFoundResponse(publishedIssueId: string) {
  return Response.json({ error: `Published issue ${publishedIssueId} not found` }, { status: 404 });
}

function isPublishedIssueOutcomeType(value: unknown): value is 'true_positive' | 'false_positive' | 'not_applicable' | 'wont_fix' {
  return (
    value === 'true_positive' ||
    value === 'false_positive' ||
    value === 'not_applicable' ||
    value === 'wont_fix'
  );
}

async function resolveAuthorizedIssueCandidate(request: Request, issueCandidateId: string) {
  const actor = await resolveApiActorContext(request);
  const { prisma } = await import('@premortem/db');
  const candidate = await prisma.issueCandidate.findUnique({
    where: { id: issueCandidateId },
    select: { projectId: true, project: { select: { organizationId: true } } }
  });
  if (!candidate || candidate.project.organizationId !== actor.organizationId) {
    return null;
  }
  return { actor, candidate };
}

async function resolveAuthorizedPublishedIssue(request: Request, publishedIssueId: string) {
  const actor = await resolveApiActorContext(request);
  const { prisma } = await import('@premortem/db');
  const publishedIssue = await prisma.publishedIssue.findUnique({
    where: { id: publishedIssueId },
    select: { id: true, organizationId: true, projectId: true }
  });

  if (!publishedIssue || publishedIssue.organizationId !== actor.organizationId) {
    return null;
  }

  return { actor, publishedIssue };
}

export async function handleIssueApprove(request: Request, issueCandidateId: string) {
  const body = (await readJsonRecord(request)) ?? {};
  try {
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    const { actor } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.APPROVE,
      notes: readOptionalString(body, 'notes')
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
  const body = (await readJsonRecord(request)) ?? {};
  try {
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    const { actor } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.REJECT,
      notes: readOptionalString(body, 'notes')
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
  const body = (await readJsonRecord(request)) ?? {};
  try {
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    const { actor } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.EDIT,
      notes: readOptionalString(body, 'notes'),
      payload: body
    });
    return Response.json({
      ok: true,
      action,
      reviewerStatus: body.deferred === true ? ReviewStatus.PENDING : ReviewStatus.EDITED
    });
  } catch (error) {
    if (isMissingIssueCandidateError(error)) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    throw error;
  }
}

export async function handleIssueMerge(request: Request, issueCandidateId: string) {
  const body = (await readJsonRecord(request)) ?? {};

  const mergedIntoIssueCandidateId = readRequiredString(body, 'mergedIntoIssueCandidateId');
  if (!mergedIntoIssueCandidateId) {
    return Response.json(
      { error: 'mergedIntoIssueCandidateId is required', code: 'merge_target_required', field: 'mergedIntoIssueCandidateId' },
      { status: 400 }
    );
  }

  try {
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    const { actor } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);
    const action = await recordReviewAction({
      issueCandidateId,
      actorId: actor.profileId,
      actionType: ReviewAction.MERGE,
      notes: readOptionalString(body, 'notes'),
      payload: { mergedIntoIssueCandidateId }
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
  const body = (await readJsonRecord(request)) ?? {};

  const title = readRequiredString(body, 'title');
  if (!title) {
    return Response.json(
      { error: 'title is required for split', code: 'split_title_required', field: 'title' },
      { status: 400 }
    );
  }

  try {
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    const { actor } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);
    const result = await splitIssueCandidate({
      issueCandidateId,
      actorId: actor.profileId,
      title,
      notes: readOptionalString(body, 'notes')
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
  let actor: Awaited<ReturnType<typeof resolveApiActorContext>> | null = null;
  try {
    const { prisma } = await import('@premortem/db');
    const authorized = await resolveAuthorizedIssueCandidate(request, issueCandidateId);
    if (!authorized) {
      return issueCandidateNotFoundResponse(issueCandidateId);
    }
    actor = authorized.actor;
    requireApiRole(actor, ORG_ADMIN_ROLES);
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
      return Response.json(
        { error: 'Plan limit reached.', code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof AuditReadinessError) {
      return Response.json(
        { error: 'Publish target is not ready.', code: error.code, field: error.field, system: error.system },
        { status: 422 }
      );
    }
    if (error instanceof PublishNotApprovedError) {
      return Response.json(
        { error: 'Issue must be approved before publish.', code: error.code, field: error.field },
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
    return apiErrorResponse(error, 'Publish failed', {
      fallbackStatus: 502,
      code: 'publish_failed'
    });
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
  requireApiRole(actor, ORG_WRITE_ROLES);

  try {
    const result = await reconcilePublishedIssues({ organizationId: actor.organizationId });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (allowsReconcileDryRun()) {
      return Response.json({ ok: true, reconciledCount: 0, driftedCount: 0, failedCount: 0, dryRun: true });
    }
    return apiErrorResponse(error, 'Reconciliation failed', { fallbackStatus: 502 });
  }
}

export async function handleIssueOutcome(request: Request, publishedIssueId: string) {
  const body = (await readJsonRecord(request)) ?? {};
  const outcomeType = readOptionalString(body, 'outcomeType');

  if (!isPublishedIssueOutcomeType(outcomeType)) {
    return Response.json(
      {
        error: 'outcomeType must be one of true_positive, false_positive, not_applicable, wont_fix',
        code: 'invalid_outcome_type'
      },
      { status: 400 }
    );
  }

  try {
    const authorized = await resolveAuthorizedPublishedIssue(request, publishedIssueId);
    if (!authorized) {
      return publishedIssueNotFoundResponse(publishedIssueId);
    }

    const { actor, publishedIssue } = authorized;
    requireApiRole(actor, ORG_WRITE_ROLES);

    const updated = await recordPublishedIssueOutcome({
      organizationId: actor.organizationId,
      projectId: publishedIssue.projectId,
      publishedIssueId,
      outcomeType,
      outcomeNotes: readOptionalString(body, 'outcomeNotes') ?? null
    });

    if (!updated) {
      return publishedIssueNotFoundResponse(publishedIssueId);
    }

    return Response.json({
      ok: true,
      publishedIssue: {
        id: updated.id,
        outcomeType: updated.outcomeType,
        outcomeNotes: updated.outcomeNotes,
        outcomeAt: updated.outcomeAt
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (/not found/i.test(message)) {
      return publishedIssueNotFoundResponse(publishedIssueId);
    }
    throw error;
  }
}

import { prisma, recordActivityEvent } from '@premortem/db';
import { handleGitLabIssueWebhook } from '@premortem/gitlab-sync';
import { verifySharedSecretToken } from '@premortem/security';

import { apiErrorResponse } from '../lib/error-response';
import type { AppEnv } from '../lib/types';

export interface GitLabPushWebhookPayload {
  object_kind?: 'push';
  ref?: string;
  after?: string;
  checkout_sha?: string;
  user_username?: string;
  project?: {
    path_with_namespace?: string;
    id?: number;
    web_url?: string;
  };
}

function normalizeBranchRef(ref?: string) {
  if (!ref) return null;
  return ref.replace(/^refs\/heads\//, '').trim() || null;
}

function isValidWebhookToken(provided: string | null, expected: string) {
  return verifySharedSecretToken(provided, expected);
}

async function handleGitLabPushWebhookPost(payload: GitLabPushWebhookPayload, env: AppEnv) {
  const externalProjectId = payload.project?.path_with_namespace?.trim();
  if (!externalProjectId) {
    return Response.json({ ok: false, skipped: true, reason: 'missing_project' }, { status: 200 });
  }

  const project = await prisma.project.findFirst({
    where: {
      provider: 'gitlab',
      externalProjectId,
      status: 'active'
    },
    include: {
      projectSettings: true
    }
  });

  if (!project) {
    return Response.json({ ok: true, skipped: true, reason: 'project_not_registered' }, { status: 200 });
  }

  const autoRunOnPush = project.projectSettings?.autoRunOnPush === true;
  if (!autoRunOnPush) {
    await recordActivityEvent({
      organizationId: project.organizationId,
      projectId: project.id,
      eventType: 'webhook.gitlab.push.ignored',
      objectType: 'gitlab_push',
      objectId: payload.after ?? payload.checkout_sha ?? externalProjectId,
      summary: `GitLab push ignored because autoRunOnPush is disabled for ${project.id}`
    });
    return Response.json({ ok: true, skipped: true, reason: 'auto_run_disabled' }, { status: 200 });
  }

  const branch = normalizeBranchRef(payload.ref) ?? project.defaultBranch ?? 'main';
  if (project.projectSettings?.auditDefaultBranchOnly !== false) {
    const defaultBranch = project.defaultBranch ?? 'main';
    if (branch !== defaultBranch) {
      await recordActivityEvent({
        organizationId: project.organizationId,
        projectId: project.id,
        eventType: 'webhook.gitlab.push.ignored',
        objectType: 'gitlab_push',
        objectId: payload.after ?? payload.checkout_sha ?? externalProjectId,
        summary: `GitLab push ignored for non-default branch ${branch}`
      });
      return Response.json({ ok: true, skipped: true, reason: 'non_default_branch' }, { status: 200 });
    }
  }

  const { submitAudit } = await import('@premortem/orchestrator');
  const submission = await submitAudit({
    organizationId: project.organizationId,
    projectId: project.id,
    branch,
    commitSha: payload.after ?? payload.checkout_sha ?? undefined,
    triggeredById: undefined,
    triggerSource: 'webhook'
  });

  if (env.AUDIT_QUEUE && !submission.reusedActiveRun) {
    await env.AUDIT_QUEUE.send(submission.job);
  }

  await recordActivityEvent({
    organizationId: project.organizationId,
    projectId: project.id,
    eventType: 'webhook.gitlab.push.received',
    objectType: 'gitlab_push',
    objectId: submission.auditRunId,
    summary: `GitLab push scheduled audit on ${branch}${submission.reusedActiveRun ? ' using existing run' : ''}`
  });

  return Response.json({
    ok: true,
    skipped: false,
    auditRunId: submission.auditRunId,
    runStatus: submission.runStatus,
    reusedActiveRun: submission.reusedActiveRun
  });
}

export async function handleGitLabIssueWebhookPost(request: Request, env: AppEnv = {}) {
  const secret = process.env.GITLAB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: 'GitLab webhook is not configured' }, { status: 503 });
  }

  const token = request.headers.get('x-gitlab-token');
  if (!isValidWebhookToken(token, secret)) {
    return Response.json({ error: 'Invalid GitLab webhook token' }, { status: 401 });
  }

  let payload: Parameters<typeof handleGitLabIssueWebhook>[0];
  try {
    payload = (await request.json()) as Parameters<typeof handleGitLabIssueWebhook>[0];
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    if (payload && typeof payload === 'object' && (payload as GitLabPushWebhookPayload).object_kind === 'push') {
      return await handleGitLabPushWebhookPost(payload as GitLabPushWebhookPayload, env);
    }

    const result = await handleGitLabIssueWebhook(payload);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, 'GitLab webhook handling failed', { fallbackStatus: 502 });
  }
}

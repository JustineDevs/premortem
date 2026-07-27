import { prisma, recordActivityEvent } from '@premortem/db';
import { handleGitLabIssueWebhook } from '@premortem/gitlab-sync';
import { verifySharedSecretToken } from '@premortem/security';
import { z } from 'zod';

import { apiErrorResponse } from '../lib/error-response.js';
import type { AppEnv } from '../lib/types.js';

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

export interface GitLabMergeRequestWebhookPayload {
  object_kind?: 'merge_request';
  project?: {
    path_with_namespace?: string;
    id?: number;
    web_url?: string;
  };
  object_attributes?: {
    iid?: number;
    action?: string;
    state?: string;
    title?: string;
    source_branch?: string;
    target_branch?: string;
    url?: string;
    sha?: string;
    last_commit?: {
      id?: string;
    };
  };
}

const GitLabIssueWebhookSchema = z
  .object({
    object_kind: z.string().optional(),
    project: z
      .object({
        path_with_namespace: z.string().optional(),
        id: z.number().optional(),
        web_url: z.string().optional()
      })
      .passthrough()
      .optional(),
    object_attributes: z
      .object({
        iid: z.number().optional(),
        state: z.string().optional(),
        action: z.string().optional(),
        title: z.string().optional(),
        source_branch: z.string().optional(),
        target_branch: z.string().optional(),
        url: z.string().optional(),
        sha: z.string().optional(),
        last_commit: z
          .object({
            id: z.string().optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

function normalizeBranchRef(ref?: string) {
  if (!ref) return null;
  return ref.replace(/^refs\/heads\//, '').trim() || null;
}

function isValidWebhookToken(provided: string | null, expected: string) {
  return verifySharedSecretToken(provided, expected);
}

async function handleGitLabMergeRequestWebhookPost(
  payload: GitLabMergeRequestWebhookPayload,
  env: AppEnv
) {
  const externalProjectId = payload.project?.path_with_namespace?.trim();
  const action = payload.object_attributes?.action?.trim().toLowerCase();
  const mergeRequestState = payload.object_attributes?.state?.trim().toLowerCase();

  if (!externalProjectId) {
    return Response.json({ ok: false, skipped: true, reason: 'missing_project' }, { status: 200 });
  }

  const project = await prisma.project.findFirst({
    where: {
      provider: 'gitlab',
      externalProjectId,
      status: 'active'
    }
  });

  if (!project) {
    return Response.json({ ok: true, skipped: true, reason: 'project_not_registered' }, { status: 200 });
  }

  if (!['open', 'update', 'reopen'].includes(action ?? '')) {
    await recordActivityEvent({
      organizationId: project.organizationId,
      projectId: project.id,
      eventType: 'webhook.gitlab.merge_request.ignored',
      objectType: 'gitlab_merge_request',
      objectId: String(payload.object_attributes?.iid ?? payload.object_attributes?.sha ?? externalProjectId),
      summary: `GitLab merge request ignored because action ${action ?? 'unknown'} is not review-triggering`
    });
    return Response.json({ ok: true, skipped: true, reason: 'non_trigger_action' }, { status: 200 });
  }

  if (mergeRequestState && !['opened', 'reopened'].includes(mergeRequestState) && action !== 'update') {
    await recordActivityEvent({
      organizationId: project.organizationId,
      projectId: project.id,
      eventType: 'webhook.gitlab.merge_request.ignored',
      objectType: 'gitlab_merge_request',
      objectId: String(payload.object_attributes?.iid ?? payload.object_attributes?.sha ?? externalProjectId),
      summary: `GitLab merge request ignored because state ${mergeRequestState} is not open`
    });
    return Response.json({ ok: true, skipped: true, reason: 'non_open_state' }, { status: 200 });
  }

  const mergeRequestIid = payload.object_attributes?.iid;
  if (typeof mergeRequestIid !== 'number') {
    return Response.json({ ok: false, skipped: true, reason: 'missing_merge_request_iid' }, { status: 200 });
  }

  const { submitAudit } = await import('@premortem/orchestrator');
  const sourceBranch = payload.object_attributes?.source_branch?.trim() || project.defaultBranch || 'main';
  const commitSha = payload.object_attributes?.last_commit?.id ?? payload.object_attributes?.sha ?? undefined;
  const submission = await submitAudit({
    organizationId: project.organizationId,
    projectId: project.id,
    branch: sourceBranch,
    commitSha,
    triggerSource: 'webhook',
    mergeRequest: {
      iid: mergeRequestIid,
      title: payload.object_attributes?.title?.trim() || undefined,
      sourceBranch,
      targetBranch: payload.object_attributes?.target_branch?.trim() || undefined,
      sha: commitSha,
      webUrl: payload.object_attributes?.url ?? payload.project?.web_url,
      action: action ?? undefined
    }
  });

  if (env.AUDIT_QUEUE && !submission.reusedActiveRun) {
    await env.AUDIT_QUEUE.send(submission.job);
  }

  await recordActivityEvent({
    organizationId: project.organizationId,
    projectId: project.id,
    eventType: 'webhook.gitlab.merge_request.received',
    objectType: 'gitlab_merge_request',
    objectId: submission.auditRunId,
    summary: `GitLab merge request !${mergeRequestIid} scheduled PR diff review on ${sourceBranch}${submission.reusedActiveRun ? ' using existing run' : ''}`
  });

  return Response.json({
    ok: true,
    skipped: false,
    auditRunId: submission.auditRunId,
    runStatus: submission.runStatus,
    reusedActiveRun: submission.reusedActiveRun
  });
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
    payload = GitLabIssueWebhookSchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    if (payload && typeof payload === 'object' && (payload as GitLabPushWebhookPayload).object_kind === 'push') {
      return await handleGitLabPushWebhookPost(payload as GitLabPushWebhookPayload, env);
    }

    if (
      payload &&
      typeof payload === 'object' &&
      (payload as GitLabMergeRequestWebhookPayload).object_kind === 'merge_request'
    ) {
      return await handleGitLabMergeRequestWebhookPost(payload as GitLabMergeRequestWebhookPayload, env);
    }

    const result = await handleGitLabIssueWebhook(payload);
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error, 'GitLab webhook handling failed', { fallbackStatus: 502 });
  }
}

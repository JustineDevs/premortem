import { captureServerException } from '@premortem/observability/server';

import {
  handleAuditCancel,
  handleAuditCreate,
  handleAuditGraphRead,
  handleAuditList,
  handleAuditPause,
  handleAuditRead,
  handleAuditResume,
  handleAuditSemanticGraphRead
} from '../routes/audits';
import {
  handleIssueApprove,
  handleIssueEdit,
  handleIssueMerge,
  handleIssueOutcome,
  handleIssuePublish,
  handleIssueReconcile,
  handleIssueReject,
  handleIssueSplit
} from '../routes/issues';
import {
  handleWorkspaceBillingPatch,
  handleWorkspaceActivityExport,
  handleWorkspaceApiKeyDelete,
  handleWorkspaceApiKeysPost,
  handleWorkspaceGet,
  handleWorkspaceMembersInvitePost,
  handleWorkspaceNangoConnectSessionPost,
  handleWorkspaceIntegrationSync,
  handleWorkspaceIntegrationsPost,
  handleWorkspaceLlmPatch,
  handleWorkspaceNotificationsPatch,
  handleWorkspaceNotificationsGet,
  handleWorkspaceNotificationsRead,
  handleWorkspaceOrganizationPatch,
  handleWorkspacePoliciesPatch,
  handleWorkspaceProfilePatch,
  handleWorkspaceRuntimePatch,
  handleWorkspaceRuntimeStopAll,
  handleWorkspaceWorkItemAttributesPatch
} from '../routes/workspace';
import { handleSlackPremortemCommandPost } from '../routes/slack';
import {
  handleProjectCreate,
  handleProjectAccuracy,
  handleProjectList,
  handleProjectSettingsPatch,
  handlePublicProjectCreate
} from '../routes/projects';
import {
  handleIntegrationRepositoriesDisable,
  handleIntegrationRepositoriesEnable,
  handleIntegrationRepositoriesList
} from '../routes/repositories';
import { handleReconciliationList } from '../routes/reconciliation';
import {
  handleInvitationAccept,
  handleInvitationRead
} from '../routes/invitations';
import { handleGitLabIssueWebhookPost } from '../routes/webhooks';
import type { AppEnv, ExecutionContextLike } from './types';
import { withCorsRouter } from './cors';
import { ApiForbiddenError } from './authorization';
import { ApiUnauthorizedError } from './request-context';
import {
  attachRequestId,
  checkRateLimit,
  rateLimitKey,
  resolveRequestId
} from './request-guard';

async function routeRequest(request: Request, env: AppEnv = {}, _ctx?: ExecutionContextLike) {
  const requestId = resolveRequestId(request);
  const url = new URL(request.url);

  if (env.APP_ENV === 'production' && !env.RATE_LIMITER) {
    throw new Error('Missing RATE_LIMITER binding in production');
  }

  if (url.pathname !== '/health' && !(await checkRateLimit(rateLimitKey(request, url.pathname), env))) {
    return attachRequestId(
      Response.json({ error: 'Rate limit exceeded. Retry shortly.', code: 'rate_limited', requestId }, { status: 429 }),
      requestId
    );
  }

  try {
    const response = await dispatchRoute(request, env, _ctx);
    return attachRequestId(response, requestId);
  } catch (error) {
    if (error instanceof ApiUnauthorizedError) {
      return attachRequestId(
        Response.json({ error: 'Unauthorized', requestId }, { status: 401 }),
        requestId
      );
    }
    if (error instanceof ApiForbiddenError) {
      return attachRequestId(
        Response.json({ error: 'Forbidden', requestId }, { status: 403 }),
        requestId
      );
    }
    captureServerException(error, {
      route: url.pathname,
      method: request.method,
      requestId
    });
    throw error;
  }
}

async function dispatchRoute(request: Request, env: AppEnv = {}, _ctx?: ExecutionContextLike) {
  const url = new URL(request.url);

  if (url.pathname === '/api/workspace' && request.method === 'GET') {
    return handleWorkspaceGet(request);
  }

  if (url.pathname === '/api/workspace/profile' && request.method === 'PATCH') {
    return handleWorkspaceProfilePatch(request);
  }

  if (url.pathname === '/api/workspace/organization' && request.method === 'PATCH') {
    return handleWorkspaceOrganizationPatch(request);
  }

  if (url.pathname === '/api/workspace/policies' && request.method === 'PATCH') {
    return handleWorkspacePoliciesPatch(request);
  }

  if (url.pathname === '/api/workspace/runtime' && request.method === 'PATCH') {
    return handleWorkspaceRuntimePatch(request);
  }

  if (url.pathname === '/api/workspace/runtime/stop-all' && request.method === 'POST') {
    return handleWorkspaceRuntimeStopAll(request);
  }

  if (url.pathname === '/api/workspace/work-item-attributes' && request.method === 'PATCH') {
    return handleWorkspaceWorkItemAttributesPatch(request);
  }

  if (url.pathname === '/api/workspace/notifications' && request.method === 'PATCH') {
    return handleWorkspaceNotificationsPatch(request);
  }

  if (url.pathname === '/api/workspace/notifications' && request.method === 'GET') {
    return handleWorkspaceNotificationsGet(request);
  }

  if (url.pathname === '/api/workspace/notifications/read' && request.method === 'POST') {
    return handleWorkspaceNotificationsRead(request);
  }

  if (url.pathname === '/api/workspace/llm' && request.method === 'PATCH') {
    return handleWorkspaceLlmPatch(request);
  }

  if (url.pathname === '/api/workspace/integrations' && request.method === 'POST') {
    return handleWorkspaceIntegrationsPost(request);
  }

  if (url.pathname === '/api/workspace/members/invite' && request.method === 'POST') {
    return handleWorkspaceMembersInvitePost(request);
  }

  if (url.pathname === '/api/workspace/integrations/nango-session' && request.method === 'POST') {
    return handleWorkspaceNangoConnectSessionPost(request);
  }

  const integrationSyncMatch = url.pathname.match(/^\/api\/workspace\/integrations\/([^/]+)\/sync$/);
  if (integrationSyncMatch && request.method === 'POST') {
    return handleWorkspaceIntegrationSync(request, integrationSyncMatch[1]!);
  }

  const integrationRepositoriesMatch = url.pathname.match(
    /^\/api\/workspace\/integrations\/([^/]+)\/repositories$/
  );
  if (integrationRepositoriesMatch && request.method === 'GET') {
    return handleIntegrationRepositoriesList(request, integrationRepositoriesMatch[1]!);
  }

  const integrationRepositoriesEnableMatch = url.pathname.match(
    /^\/api\/workspace\/integrations\/([^/]+)\/repositories\/enable$/
  );
  if (integrationRepositoriesEnableMatch && request.method === 'POST') {
    return handleIntegrationRepositoriesEnable(request, integrationRepositoriesEnableMatch[1]!);
  }

  const integrationRepositoriesDisableMatch = url.pathname.match(
    /^\/api\/workspace\/integrations\/([^/]+)\/repositories\/disable$/
  );
  if (integrationRepositoriesDisableMatch && request.method === 'POST') {
    return handleIntegrationRepositoriesDisable(request, integrationRepositoriesDisableMatch[1]!);
  }

  if (url.pathname === '/api/projects/public' && request.method === 'POST') {
    return handlePublicProjectCreate(request);
  }

  if (url.pathname === '/api/workspace/billing' && request.method === 'PATCH') {
    return handleWorkspaceBillingPatch(request);
  }

  if (url.pathname === '/api/workspace/api-keys' && request.method === 'POST') {
    return handleWorkspaceApiKeysPost(request);
  }

  const workspaceApiKeyMatch = url.pathname.match(/^\/api\/workspace\/api-keys\/([^/]+)$/);
  if (workspaceApiKeyMatch && request.method === 'DELETE') {
    return handleWorkspaceApiKeyDelete(request, workspaceApiKeyMatch[1]!);
  }

  if (url.pathname === '/api/workspace/activity/export' && request.method === 'GET') {
    return handleWorkspaceActivityExport(request);
  }

  if (url.pathname === '/api/projects' && request.method === 'GET') {
    return handleProjectList(request);
  }

  if (url.pathname === '/api/projects' && request.method === 'POST') {
    return handleProjectCreate(request);
  }

  const projectSettingsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/settings$/);
  if (projectSettingsMatch && request.method === 'PATCH') {
    return handleProjectSettingsPatch(request, projectSettingsMatch[1]!);
  }

  if (url.pathname === '/api/audits' && request.method === 'POST') {
    return handleAuditCreate(request, env);
  }

  if (url.pathname === '/api/audits' && request.method === 'GET') {
    return handleAuditList(request);
  }

  const invitationMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)$/);
  if (invitationMatch && request.method === 'GET') {
    return handleInvitationRead(request, invitationMatch[1]!);
  }

  const invitationAcceptMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/accept$/);
  if (invitationAcceptMatch && request.method === 'POST') {
    return handleInvitationAccept(request, invitationAcceptMatch[1]!);
  }

  const auditMatch = url.pathname.match(/^\/api\/audits\/([^/]+)$/);
  if (auditMatch && request.method === 'GET') {
    return handleAuditRead(request, auditMatch[1]!);
  }

  const auditGraphMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/graph$/);
  if (auditGraphMatch && request.method === 'GET') {
    return handleAuditGraphRead(request, auditGraphMatch[1]!);
  }

  const auditSemanticGraphMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/semantic-graph$/);
  if (auditSemanticGraphMatch && request.method === 'GET') {
    return handleAuditSemanticGraphRead(request, auditSemanticGraphMatch[1]!);
  }

  const auditCancelMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/cancel$/);
  if (auditCancelMatch && request.method === 'POST') {
    return handleAuditCancel(request, auditCancelMatch[1]!);
  }

  const auditPauseMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/pause$/);
  if (auditPauseMatch && request.method === 'POST') {
    return handleAuditPause(request, auditPauseMatch[1]!);
  }

  const auditResumeMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/resume$/);
  if (auditResumeMatch && request.method === 'POST') {
    return handleAuditResume(request, auditResumeMatch[1]!, env);
  }

  if (url.pathname === '/api/reconciliation' && request.method === 'GET') {
    return handleReconciliationList(request);
  }

  const issueApproveMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/approve$/);
  if (issueApproveMatch && request.method === 'POST') {
    return handleIssueApprove(request, issueApproveMatch[1]!);
  }

  const issueRejectMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/reject$/);
  if (issueRejectMatch && request.method === 'POST') {
    return handleIssueReject(request, issueRejectMatch[1]!);
  }

  const issueEditMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/edit$/);
  if (issueEditMatch && request.method === 'POST') {
    return handleIssueEdit(request, issueEditMatch[1]!);
  }

  const issueMergeMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/merge$/);
  if (issueMergeMatch && request.method === 'POST') {
    return handleIssueMerge(request, issueMergeMatch[1]!);
  }

  const issueSplitMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/split$/);
  if (issueSplitMatch && request.method === 'POST') {
    return handleIssueSplit(request, issueSplitMatch[1]!);
  }

  const issuePublishMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/publish$/);
  if (issuePublishMatch && request.method === 'POST') {
    return handleIssuePublish(request, issuePublishMatch[1]!);
  }

  const issueOutcomeMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/outcome$/);
  if (issueOutcomeMatch && request.method === 'POST') {
    return handleIssueOutcome(request, issueOutcomeMatch[1]!);
  }

  if (url.pathname === '/api/issues/reconcile' && request.method === 'POST') {
    return handleIssueReconcile(request);
  }

  const projectAccuracyMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/accuracy$/);
  if (projectAccuracyMatch && request.method === 'GET') {
    return handleProjectAccuracy(request, projectAccuracyMatch[1]!);
  }

  if (url.pathname === '/api/webhooks/gitlab' && request.method === 'POST') {
    return handleGitLabIssueWebhookPost(request, env);
  }

  if (url.pathname === '/api/slack/premortem' && request.method === 'POST') {
    return handleSlackPremortemCommandPost(request, env);
  }

  if (url.pathname === '/health') {
    return Response.json({ ok: true, service: 'premortem-api' });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function appRouter(request: Request, env: AppEnv = {}, ctx?: ExecutionContextLike) {
  return withCorsRouter(request, (req) => routeRequest(req, env, ctx));
}

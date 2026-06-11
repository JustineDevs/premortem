import { captureServerException } from '@premortem/observability';

import { handleAuditCancel, handleAuditCreate, handleAuditList, handleAuditPause, handleAuditRead, handleAuditResume } from '../routes/audits';
import {
  handleIssueApprove,
  handleIssueEdit,
  handleIssueMerge,
  handleIssuePublish,
  handleIssueReconcile,
  handleIssueReject,
  handleIssueSplit
} from '../routes/issues';
import {
  handleWorkspaceBillingPatch,
  handleWorkspaceGet,
  handleWorkspaceIntegrationSync,
  handleWorkspaceIntegrationsPost,
  handleWorkspaceLlmPatch,
  handleWorkspaceNotificationsPatch,
  handleWorkspaceOrganizationPatch,
  handleWorkspacePoliciesPatch,
  handleWorkspaceProfilePatch,
  handleWorkspaceRuntimePatch,
  handleWorkspaceRuntimeStopAll,
  handleWorkspaceWorkItemAttributesPatch
} from '../routes/workspace';
import { handleProjectCreate, handleProjectList, handlePublicProjectCreate } from '../routes/projects';
import {
  handleIntegrationRepositoriesDisable,
  handleIntegrationRepositoriesEnable,
  handleIntegrationRepositoriesList
} from '../routes/repositories';
import { handleReconciliationList } from '../routes/reconciliation';
import type { AppEnv, ExecutionContextLike } from './types';
import { withCorsRouter } from './cors';
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

  if (url.pathname !== '/health' && !checkRateLimit(rateLimitKey(request, url.pathname))) {
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
      return attachRequestId(Response.json({ error: error.message, requestId }, { status: 401 }), requestId);
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

  if (url.pathname === '/api/workspace/llm' && request.method === 'PATCH') {
    return handleWorkspaceLlmPatch(request);
  }

  if (url.pathname === '/api/workspace/integrations' && request.method === 'POST') {
    return handleWorkspaceIntegrationsPost(request);
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

  if (url.pathname === '/api/projects' && request.method === 'GET') {
    return handleProjectList(request);
  }

  if (url.pathname === '/api/projects' && request.method === 'POST') {
    return handleProjectCreate(request);
  }

  if (url.pathname === '/api/audits' && request.method === 'POST') {
    return handleAuditCreate(request, env);
  }

  if (url.pathname === '/api/audits' && request.method === 'GET') {
    return handleAuditList(request);
  }

  const auditMatch = url.pathname.match(/^\/api\/audits\/([^/]+)$/);
  if (auditMatch && request.method === 'GET') {
    return handleAuditRead(auditMatch[1]!);
  }

  const auditCancelMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/cancel$/);
  if (auditCancelMatch && request.method === 'POST') {
    return handleAuditCancel(auditCancelMatch[1]!);
  }

  const auditPauseMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/pause$/);
  if (auditPauseMatch && request.method === 'POST') {
    return handleAuditPause(auditPauseMatch[1]!);
  }

  const auditResumeMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/resume$/);
  if (auditResumeMatch && request.method === 'POST') {
    return handleAuditResume(auditResumeMatch[1]!, env);
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

  if (url.pathname === '/api/issues/reconcile' && request.method === 'POST') {
    return handleIssueReconcile(request);
  }

  if (url.pathname === '/health') {
    return Response.json({ ok: true, service: 'premortem-api' });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function appRouter(request: Request, env: AppEnv = {}, ctx?: ExecutionContextLike) {
  return withCorsRouter(request, (req) => routeRequest(req, env, ctx));
}

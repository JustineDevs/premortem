import { Hono } from 'hono';

import { captureServerException } from '@premortem/observability/server';

import {
  handleAuditCancel,
  handleAuditCreate,
  handleAuditGraphRead,
  handleAuditList,
  handleAuditPause,
  handleAuditRead,
  handleAuditResume,
  handleAuditSemanticGraphRead,
  handleAuditSarifRead
} from '../routes/audits.js';
import { handleSandboxAuditCreate } from '../routes/audits-sandbox.js';
import { handleBillingSubscriptionPost } from '../routes/billing-subscription.js';
import { handleBillingCheckoutPost, handleBillingPortalPost } from '../routes/billing.js';
import { handleStripeWebhookPost } from '../routes/stripe-webhook.js';
import {
  handleIssueApprove,
  handleIssueAction,
  handleIssueEdit,
  handleIssueMerge,
  handleIssueOutcome,
  handleIssuePublish,
  handleIssueReconcile,
  handleIssueReject,
  handleIssueSplit
} from '../routes/issues.js';
import {
  handleWorkspaceBillingPatch,
  handleWorkspaceActivityExport,
  handleWorkspaceApiKeyDelete,
  handleWorkspaceApiKeysPost,
  handleWorkspaceGet,
  handleWorkspaceMembersInvitePost,
  handleWorkspaceNangoConnectSessionPost,
  handleWorkspaceIntegrationSync,
  handleWorkspaceSlackNotificationSyncPost,
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
} from '../routes/workspace.js';
import { handleWorkspaceSkillsInstall as handleWorkspaceSkillsInstallRoute } from '../routes/skills.js';
import { handleSlackEventsPost, handleSlackPremortemCommandPost } from '../routes/slack.js';
import {
  handleProjectCreate,
  handleProjectAccuracy,
  handleProjectList,
  handleProjectSettingsPatch,
  handlePublicProjectCreate
} from '../routes/projects.js';
import {
  handleIntegrationRepositoriesDisable,
  handleIntegrationRepositoriesEnable,
  handleIntegrationRepositoriesList
} from '../routes/repositories.js';
import { handleReconciliationList } from '../routes/reconciliation.js';
import {
  handleInvitationAccept,
  handleInvitationRead
} from '../routes/invitations.js';
import { handleGitLabIssueWebhookPost } from '../routes/webhooks.js';
import { handleMcpRequest } from '../routes/mcp.js';
import type { AppEnv, ExecutionContextLike } from './types.js';
import { ApiForbiddenError } from './authorization.js';
import { ApiUnauthorizedError } from './request-context.js';
import {
  attachRequestId,
  checkRateLimit,
  rateLimitKey,
  resolveRequestId
} from './request-guard.js';

const app = new Hono<{ Bindings: AppEnv; Variables: { requestId: string } }>();
const HEALTH_PATHS = new Set(['/', '/health', '/healthz', '/api/mcp/healthz']);

function createHealthResponse(service: string) {
  return Response.json({ ok: true, service });
}

app.use('*', async (c, next) => {
  const requestId = resolveRequestId(c.req.raw);
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  const pathname = new URL(c.req.url).pathname;
  if (!HEALTH_PATHS.has(pathname) && !(await checkRateLimit(rateLimitKey(c.req.raw, pathname), c.env))) {
    return attachRequestId(
      Response.json({ error: 'Rate limit exceeded. Retry shortly.', code: 'rate_limited', requestId }, { status: 429 }),
      requestId
    );
  }

  await next();
});

app.onError((error, c) => {
  const requestId = c.get('requestId');
  const pathname = new URL(c.req.url).pathname;

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
    route: pathname,
    method: c.req.method,
    requestId
  });
  return attachRequestId(
    Response.json({ error: 'Internal Server Error', requestId }, { status: 500 }),
    requestId
  );
});

app.get('/api/workspace', (c) => handleWorkspaceGet(c.req.raw));
app.patch('/api/workspace/profile', (c) => handleWorkspaceProfilePatch(c.req.raw));
app.patch('/api/workspace/organization', (c) => handleWorkspaceOrganizationPatch(c.req.raw));
app.patch('/api/workspace/policies', (c) => handleWorkspacePoliciesPatch(c.req.raw));
app.patch('/api/workspace/runtime', (c) => handleWorkspaceRuntimePatch(c.req.raw));
app.post('/api/workspace/runtime/stop-all', (c) => handleWorkspaceRuntimeStopAll(c.req.raw));
app.patch('/api/workspace/work-item-attributes', (c) => handleWorkspaceWorkItemAttributesPatch(c.req.raw));
app.patch('/api/workspace/notifications', (c) => handleWorkspaceNotificationsPatch(c.req.raw));
app.get('/api/workspace/notifications', (c) => handleWorkspaceNotificationsGet(c.req.raw));
app.post('/api/workspace/notifications/read', (c) => handleWorkspaceNotificationsRead(c.req.raw));
app.patch('/api/workspace/llm', (c) => handleWorkspaceLlmPatch(c.req.raw));
app.post('/api/workspace/integrations', (c) => handleWorkspaceIntegrationsPost(c.req.raw));
app.post('/api/workspace/members/invite', (c) => handleWorkspaceMembersInvitePost(c.req.raw));
app.post('/api/workspace/integrations/nango-session', (c) => handleWorkspaceNangoConnectSessionPost(c.req.raw));
app.post('/api/workspace/notifications/slack/sync', (c) =>
  handleWorkspaceSlackNotificationSyncPost(c.req.raw)
);
app.post('/api/workspace/skills/install', (c) => handleWorkspaceSkillsInstallRoute(c.req.raw));
app.post('/api/workspace/integrations/:integrationId/sync', (c) =>
  handleWorkspaceIntegrationSync(c.req.raw, c.req.param('integrationId'))
);
app.get('/api/workspace/integrations/:integrationId/repositories', (c) =>
  handleIntegrationRepositoriesList(c.req.raw, c.req.param('integrationId'))
);
app.post('/api/workspace/integrations/:integrationId/repositories/enable', (c) =>
  handleIntegrationRepositoriesEnable(c.req.raw, c.req.param('integrationId'))
);
app.post('/api/workspace/integrations/:integrationId/repositories/disable', (c) =>
  handleIntegrationRepositoriesDisable(c.req.raw, c.req.param('integrationId'))
);
app.post('/api/projects/public', (c) => handlePublicProjectCreate(c.req.raw));
app.patch('/api/workspace/billing', (c) => handleWorkspaceBillingPatch(c.req.raw));
app.post('/api/workspace/api-keys', (c) => handleWorkspaceApiKeysPost(c.req.raw));
app.delete('/api/workspace/api-keys/:apiKeyId', (c) =>
  handleWorkspaceApiKeyDelete(c.req.raw, c.req.param('apiKeyId'))
);
app.get('/api/workspace/activity/export', (c) => handleWorkspaceActivityExport(c.req.raw));
app.get('/api/projects', (c) => handleProjectList(c.req.raw));
app.post('/api/projects', (c) => handleProjectCreate(c.req.raw));
app.patch('/api/projects/:projectId/settings', (c) =>
  handleProjectSettingsPatch(c.req.raw, c.req.param('projectId'))
);
app.post('/api/audits', (c) => handleAuditCreate(c.req.raw, c.env));
app.post('/api/audits/sandbox', (c) => handleSandboxAuditCreate(c.req.raw));
app.post('/api/billing/checkout', (c) => handleBillingCheckoutPost(c.req.raw));
app.post('/api/billing/portal', (c) => handleBillingPortalPost(c.req.raw));
app.post('/api/billing/subscription', (c) => handleBillingSubscriptionPost(c.req.raw));
app.post('/api/stripe/webhook', (c) => handleStripeWebhookPost(c.req.raw));
app.get('/api/audits', (c) => handleAuditList(c.req.raw));
app.get('/api/invitations/:invitationId', (c) => handleInvitationRead(c.req.raw, c.req.param('invitationId')));
app.post('/api/invitations/:invitationId/accept', (c) =>
  handleInvitationAccept(c.req.raw, c.req.param('invitationId'))
);
app.get('/api/audits/:auditRunId', (c) => handleAuditRead(c.req.raw, c.req.param('auditRunId')));
app.get('/api/audits/:auditRunId/graph', (c) =>
  handleAuditGraphRead(c.req.raw, c.req.param('auditRunId'))
);
app.get('/api/audits/:auditRunId/semantic-graph', (c) =>
  handleAuditSemanticGraphRead(c.req.raw, c.req.param('auditRunId'))
);
app.get('/api/audits/:auditRunId/sarif', (c) =>
  handleAuditSarifRead(c.req.raw, c.req.param('auditRunId'))
);
app.post('/api/audits/:auditRunId/cancel', (c) => handleAuditCancel(c.req.raw, c.req.param('auditRunId')));
app.post('/api/audits/:auditRunId/pause', (c) => handleAuditPause(c.req.raw, c.req.param('auditRunId')));
app.post('/api/audits/:auditRunId/resume', (c) =>
  handleAuditResume(c.req.raw, c.req.param('auditRunId'), c.env)
);
app.get('/api/reconciliation', (c) => handleReconciliationList(c.req.raw));
app.post('/api/issues/:issueId/approve', (c) => handleIssueApprove(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/reject', (c) => handleIssueReject(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/edit', (c) => handleIssueEdit(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/merge', (c) => handleIssueMerge(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/split', (c) => handleIssueSplit(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/publish', (c) => handleIssuePublish(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/:issueId/outcome', (c) => handleIssueOutcome(c.req.raw, c.req.param('issueId')));
app.post('/api/issues/reconcile', (c) => handleIssueReconcile(c.req.raw));
app.get('/api/projects/:projectId/accuracy', (c) => handleProjectAccuracy(c.req.raw, c.req.param('projectId')));
app.post('/api/webhooks/gitlab', (c) => handleGitLabIssueWebhookPost(c.req.raw, c.env));
app.post('/api/slack/premortem', (c) => handleSlackPremortemCommandPost(c.req.raw, c.env));
app.post('/api/slack/events', (c) =>
  handleSlackEventsPost(c.req.raw, c.env, c.executionCtx as unknown as ExecutionContextLike)
);
app.all('/api/mcp', (c) => handleMcpRequest(c.req.raw, c.env));
app.get('/api/mcp/healthz', () => createHealthResponse('premortem-mcp'));
app.get('/', () => createHealthResponse('premortem-api'));
app.get('/health', () => Response.json({ ok: true, service: 'premortem-api' }));
app.get('/healthz', () => Response.json({ ok: true, service: 'premortem-api' }));
app.notFound(() => Response.json({ error: 'Not found' }, { status: 404 }));

async function routeRequest(request: Request, env: AppEnv = {}, _ctx?: ExecutionContextLike) {
  const requestId = resolveRequestId(request);
  const url = new URL(request.url);

  if (env.APP_ENV === 'production' && !env.RATE_LIMITER) {
    throw new Error('Missing RATE_LIMITER binding in production');
  }

  if (!HEALTH_PATHS.has(url.pathname) && !(await checkRateLimit(rateLimitKey(request, url.pathname), env))) {
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

  if (url.pathname === '/api/workspace/notifications/slack/sync' && request.method === 'POST') {
    return handleWorkspaceSlackNotificationSyncPost(request);
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

  if (url.pathname === '/api/audits/sandbox' && request.method === 'POST') {
    return handleSandboxAuditCreate(request);
  }

  if (url.pathname === '/api/billing/subscription' && request.method === 'POST') {
    return handleBillingSubscriptionPost(request);
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

  const auditSarifMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/sarif$/);
  if (auditSarifMatch && request.method === 'GET') {
    return handleAuditSarifRead(request, auditSarifMatch[1]!);
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

  const nestedAuditIssueActionMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/issues\/([^/]+)\/action$/);
  if (nestedAuditIssueActionMatch && request.method === 'POST') {
    return handleIssueAction(request, nestedAuditIssueActionMatch[2]!);
  }

  const nestedAuditIssueEditMatch = url.pathname.match(/^\/api\/audits\/([^/]+)\/issues\/([^/]+)\/edit$/);
  if (nestedAuditIssueEditMatch && request.method === 'POST') {
    return handleIssueEdit(request, nestedAuditIssueEditMatch[2]!);
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

  if (url.pathname === '/api/slack/events' && request.method === 'POST') {
    return handleSlackEventsPost(request, env, _ctx);
  }

  if (url.pathname === '/health') {
    return Response.json({ ok: true, service: 'premortem-api' });
  }

  if (url.pathname === '/' || url.pathname === '/healthz') {
    return Response.json({ ok: true, service: 'premortem-api' });
  }

  if (url.pathname === '/api/mcp/healthz') {
    return Response.json({ ok: true, service: 'premortem-mcp' });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function appRouter(request: Request, env: AppEnv = {}, ctx?: ExecutionContextLike) {
  return app.fetch(request, env, ctx as any);
}

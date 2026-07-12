import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { getRecentAuditRuns, getAuditRunSnapshot } from '@premortem/orchestrator/read-model';
import { getWorkspaceBundle, listOrganizationProjects, getOrganizationEntitlements } from '@premortem/db';
import { submitAudit } from '@premortem/orchestrator';
import { BILLING_ROLES, ORG_ADMIN_ROLES, ORG_WRITE_ROLES } from './authorization';
import { resolveApiActorContext } from './request-context';
import type { AppEnv } from './types';

type ActorRole = 'owner' | 'admin' | 'member' | 'viewer' | 'billing';

interface McpActorContext {
  profileId: string;
  organizationId: string;
  role: ActorRole;
  email?: string | null;
  source: 'supabase' | 'api-key';
}

type PremortemMcpState = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

const PROJECT_PAGE_SIZE_MAX = 100;
const AUDIT_LIMIT_MAX = 50;

type McpRequestExtra = {
  authInfo?: {
    extra?: Record<string, unknown>;
  };
};

const ProjectsListInput = z.object({
  take: z.number().int().min(1).max(PROJECT_PAGE_SIZE_MAX).optional(),
  cursor: z.string().min(1).optional()
});

const AuditsListInput = z.object({
  limit: z.number().int().min(1).max(AUDIT_LIMIT_MAX).optional()
});

const AuditGetInput = z.object({
  auditRunId: z.string().min(1),
  includeGraphPayload: z.boolean().optional(),
  includeEvidenceSnippets: z.boolean().optional()
});

const BillingStatusInput = z.object({});

const AuditSubmitInput = z.object({
  projectId: z.string().min(1),
  branch: z.string().min(1),
  commitSha: z.string().min(1).optional(),
  scanCodeSnippet: z.string().min(1).optional()
});

let mcpStatePromise: Promise<PremortemMcpState> | null = null;

function toolTextResult(payload: unknown, options?: { isError?: boolean }) {
  return {
    ...(options?.isError ? { isError: true } : {}),
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function getAuthScopes(role: ActorRole) {
  const scopes = ['workspace:read', 'projects:read', 'audits:read'];
  if (role === 'owner' || role === 'admin' || role === 'member') {
    scopes.push('audits:write');
  }
  if (BILLING_ROLES.includes(role)) {
    scopes.push('billing:read');
  }
  if (ORG_ADMIN_ROLES.includes(role)) {
    scopes.push('workspace:write');
  }
  return scopes;
}

function getActorFromAuthInfo(extra: { authInfo?: { extra?: Record<string, unknown> } } | undefined) {
  const actor = extra?.authInfo?.extra?.actor;
  if (!actor || typeof actor !== 'object') {
    throw new Error('Missing MCP actor context.');
  }

  const row = actor as Record<string, unknown>;
  const profileId = typeof row.profileId === 'string' ? row.profileId : '';
  const organizationId = typeof row.organizationId === 'string' ? row.organizationId : '';
  const role = row.role;
  if (!profileId || !organizationId || typeof role !== 'string') {
    throw new Error('Invalid MCP actor context.');
  }

  return {
    profileId,
    organizationId,
    role: role as ActorRole,
    email: typeof row.email === 'string' ? row.email : null,
    source: row.source === 'api-key' ? 'api-key' : 'supabase'
  } satisfies McpActorContext;
}

function sanitizeWorkspaceBundle(workspace: Awaited<ReturnType<typeof getWorkspaceBundle>>) {
  return {
    profile: workspace.profile,
    organization: workspace.organization,
    integrations: workspace.integrations,
    policies: workspace.policies,
    notifications: {
      isSlackConnected: workspace.notifications.isSlackConnected,
      alertSeverity: workspace.notifications.alertSeverity,
      slackChannel: workspace.notifications.slackChannel ? '[configured]' : '',
      alertEmails: workspace.notifications.alertEmails ? '[configured]' : ''
    },
    skills: workspace.skills,
    llm: {
      selectedGeminiModel: workspace.llm.selectedGeminiModel,
      maxTokens: workspace.llm.maxTokens,
      temperature: workspace.llm.temperature,
      customProviders: workspace.llm.customProviders,
      vendorRouting: workspace.llm.vendorRouting
    },
    workItemAttributes: workspace.workItemAttributes,
    billing: {
      plan: workspace.billing.plan,
      billingStatus: workspace.billing.billingStatus,
      seats: workspace.billing.seats,
      auditQuotaMonthly: workspace.billing.auditQuotaMonthly,
      auditsUsedMonth: workspace.billing.auditsUsedMonth,
      publishQuotaMonthly: workspace.billing.publishQuotaMonthly,
      publishesUsedMonth: workspace.billing.publishesUsedMonth,
      canPublish: workspace.billing.canPublish,
      maxRepos: workspace.billing.maxRepos,
      historyRetentionDays: workspace.billing.historyRetentionDays,
      supportLevel: workspace.billing.supportLevel,
      sarifExportEnabled: workspace.billing.sarifExportEnabled,
      webhooksEnabled: workspace.billing.webhooksEnabled,
      graphitiMemoryEnabled: workspace.billing.graphitiMemoryEnabled,
      skillMarketplaceEnabled: workspace.billing.skillMarketplaceEnabled,
      stripeConfigured: workspace.billing.stripeConfigured,
      stripeTestMode: workspace.billing.stripeTestMode,
      stripeBillingConfigured: workspace.billing.stripeBillingConfigured
    },
    usage: workspace.usage,
    runtime: workspace.runtime
  };
}

function createErrorResult(message: string, details?: Record<string, unknown>) {
  return toolTextResult(
    {
      ok: false,
      error: message,
      ...(details ?? {})
    },
    { isError: true }
  );
}

function requireActorRole(actor: McpActorContext, allowedRoles: ActorRole[]) {
  if (!allowedRoles.includes(actor.role)) {
    throw new Error(`Forbidden for role ${actor.role}.`);
  }
}

function createPremortemMcpServer(env: AppEnv = {}) {
  const server = new McpServer(
    { name: 'premortem-mcp', version: '0.1.0' },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        'Premortem MCP exposes authenticated workspace, audit, and billing tools. All tools are org-scoped and role-gated.'
    }
  );

  server.registerTool(
    'premortem_whoami',
    {
      title: 'Who am I',
      description: 'Return the authenticated actor, effective workspace role, and available MCP scopes.'
    },
    async (extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      const entitlements = await getOrganizationEntitlements(actor.organizationId);
      return toolTextResult({
        actor: {
          profileId: actor.profileId,
          organizationId: actor.organizationId,
          role: actor.role,
          email: actor.email,
          source: actor.source
        },
        scopes: getAuthScopes(actor.role),
        plan: {
          plan: entitlements.plan,
          label: entitlements.limits.label,
          canPublish: entitlements.canPublish,
          maxRepos: entitlements.limits.maxRepos,
          auditsPerMonth: entitlements.auditLimit,
          publishesPerMonth: entitlements.publishLimit,
          historyRetentionDays: entitlements.limits.historyRetentionDays,
          supportLevel: entitlements.limits.supportLevel
        }
      });
    }
  );

  server.registerTool(
    'premortem_workspace_summary',
    {
      title: 'Workspace summary',
      description: 'Return a safe, org-scoped summary of workspace settings, runtime, and billing state.'
    },
    async (extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      const workspace = await getWorkspaceBundle({
        organizationId: actor.organizationId,
        profileId: actor.profileId
      });
      return toolTextResult(sanitizeWorkspaceBundle(workspace));
    }
  );

  server.registerTool(
    'premortem_projects_list',
    {
      title: 'Projects list',
      description: 'List connected projects for the current organization with cursor pagination.',
      inputSchema: ProjectsListInput
    },
    async (args: z.infer<typeof ProjectsListInput>, extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      const take = args.take ?? 25;
      const result = await listOrganizationProjects(actor.organizationId, {
        take,
        cursor: args.cursor
      });
      return toolTextResult({
        organizationId: actor.organizationId,
        take,
        ...result
      });
    }
  );

  server.registerTool(
    'premortem_audits_list',
    {
      title: 'Recent audits',
      description: 'List the most recent audit runs for the current organization.',
      inputSchema: AuditsListInput
    },
    async (args: z.infer<typeof AuditsListInput>, extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      const limit = args.limit ?? 12;
      const auditRuns = await getRecentAuditRuns(actor.organizationId, limit);
      return toolTextResult({ organizationId: actor.organizationId, limit, auditRuns });
    }
  );

  server.registerTool(
    'premortem_audit_get',
    {
      title: 'Audit details',
      description: 'Return a detailed audit snapshot including findings, events, graph metadata, and evidence.',
      inputSchema: AuditGetInput
    },
    async (args: z.infer<typeof AuditGetInput>, extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      const snapshot = await getAuditRunSnapshot(args.auditRunId, {
        includeGraphPayload: args.includeGraphPayload ?? true,
        includeEvidenceSnippets: args.includeEvidenceSnippets ?? true
      });
      if (!snapshot || snapshot.organizationId !== actor.organizationId) {
        return createErrorResult('Audit run not found.');
      }
      return toolTextResult(snapshot);
    }
  );

  server.registerTool(
    'premortem_billing_status',
    {
      title: 'Billing status',
      description: 'Return the current billing and quota status for the organization.',
      inputSchema: BillingStatusInput
    },
    async (_args: Record<string, never>, extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      requireActorRole(actor, BILLING_ROLES);
      const workspace = await getWorkspaceBundle({
        organizationId: actor.organizationId,
        profileId: actor.profileId
      });
      return toolTextResult({
        actor: {
          profileId: actor.profileId,
          organizationId: actor.organizationId,
          role: actor.role
        },
        billing: workspace.billing,
        usage: workspace.usage,
        runtime: workspace.runtime
      });
    }
  );

  server.registerTool(
    'premortem_audit_submit',
    {
      title: 'Submit audit',
      description: 'Submit a real audit job for a project branch. Requires write privileges and quota.',
      inputSchema: AuditSubmitInput
    },
    async (args: z.infer<typeof AuditSubmitInput>, extra: McpRequestExtra) => {
      const actor = getActorFromAuthInfo(extra);
      requireActorRole(actor, ORG_WRITE_ROLES);

      if (!env.AUDIT_QUEUE) {
        return createErrorResult('AUDIT_QUEUE binding is required for MCP audit submission.');
      }

      const result = await submitAudit({
        organizationId: actor.organizationId,
        projectId: args.projectId,
        branch: args.branch,
        commitSha: args.commitSha,
        scanCodeSnippet: args.scanCodeSnippet,
        triggeredById: actor.profileId,
        triggerSource: 'api'
      });

      if (!result.reusedActiveRun) {
        await env.AUDIT_QUEUE.send(result.job);
      }

      return toolTextResult({
        ok: true,
        auditRunId: result.auditRunId,
        runStatus: result.runStatus,
        idempotencyKey: result.idempotencyKey,
        reusedActiveRun: result.reusedActiveRun ?? false
      });
    }
  );

  return server;
}

async function getPremortemMcpState(env: AppEnv = {}) {
  if (!mcpStatePromise) {
    mcpStatePromise = (async () => {
      const server = createPremortemMcpServer(env);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });
      await server.connect(transport);
      return { server, transport };
    })();
  }

  return mcpStatePromise;
}

function toMcpAuthInfo(actor: McpActorContext, token: string) {
  return {
    token,
    clientId: actor.profileId,
    scopes: getAuthScopes(actor.role),
    extra: {
      actor
    }
  };
}

export async function handlePremortemMcpRequest(request: Request, env: AppEnv = {}) {
  const actor = await resolveApiActorContext(request);
  const { transport } = await getPremortemMcpState(env);
  return transport.handleRequest(request, {
    authInfo: toMcpAuthInfo(
      {
        profileId: actor.profileId,
        organizationId: actor.organizationId,
        role: actor.role as ActorRole,
        email: actor.email ?? null,
        source: 'supabase'
      },
      `${actor.profileId}:${actor.organizationId}`
    )
  });
}

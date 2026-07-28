import { LOCAL_DEV_FIXTURE, isLocalAuthBypassEnabled } from '@premortem/domain';
import {
  resolveActorOrganization,
  getOrganizationEntitlements,
  listOrganizationProjects,
  getWorkspaceBundle,
} from '@premortem/db';
import { submitAudit, executeAuditJob } from '@premortem/orchestrator';
import { getAuditRunSnapshot, getRecentAuditRuns } from '@premortem/orchestrator/read-model';
import { BILLING_ROLES, ORG_ADMIN_ROLES, ORG_WRITE_ROLES } from './authorization.js';
import type { PremortemMcpActorContext, PremortemMcpRuntimeEnv } from './types.js';
import fs from 'node:fs';
import path from 'node:path';

export const AUDIT_LIMIT_MAX = 50;
export const PROJECT_PAGE_SIZE_MAX = 100;

export function toolTextResult(payload: unknown, options?: { isError?: boolean }) {
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

export function createErrorResult(message: string, details?: Record<string, unknown>) {
  return toolTextResult(
    {
      ok: false,
      error: message,
      ...(details ?? {})
    },
    { isError: true }
  );
}

export function requireActorRole(actor: PremortemMcpActorContext, allowedRoles: Array<PremortemMcpActorContext['role']>) {
  if (!allowedRoles.includes(actor.role)) {
    throw new Error(`Forbidden for role ${actor.role}.`);
  }
}

export function getAuthScopes(role: PremortemMcpActorContext['role']) {
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

export function sanitizeWorkspaceBundle(workspace: Awaited<ReturnType<typeof getWorkspaceBundle>>) {
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

export function resolveRepoRoot(startDir = process.cwd()) {
  let current = startDir;
  const runtimeFallback = process.env.PREMORTEM_REPO_ROOT?.trim() || startDir;

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
        if (packageJson.name === 'premortem') return current;
      } catch {
        // fall through
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return runtimeFallback;
    }

    current = parent;
  }
}

export async function resolveMcpActorFromSupabaseContext(ctx: {
  auth?: {
    user?: {
      userId?: string;
      email?: string | null;
    };
  };
  req?: {
    header(name: string): string | undefined;
  };
}): Promise<PremortemMcpActorContext> {
  if (isLocalAuthBypassEnabled()) {
    const profileId = ctx.req?.header('x-premortem-actor-id')?.trim() || LOCAL_DEV_FIXTURE.profileId;
    const organizationId = ctx.req?.header('x-premortem-organization-id')?.trim() || LOCAL_DEV_FIXTURE.organizationId;
    const email = ctx.req?.header('x-premortem-user-email') ?? LOCAL_DEV_FIXTURE.email;
    const resolved = await resolveActorOrganization(profileId, organizationId, {
      email
    });
    return {
      profileId: resolved.profileId,
      organizationId: resolved.organizationId,
      role: resolved.role,
      email,
      source: 'local'
    };
  }

  const userId = ctx.auth?.user?.userId?.trim();
  if (!userId) {
    throw new Error('Missing authenticated MCP user.');
  }

  const hintedOrganizationId = ctx.req?.header('x-premortem-organization-id')?.trim() || undefined;
  const email = ctx.auth?.user?.email ?? null;
  const resolved = await resolveActorOrganization(userId, hintedOrganizationId, {
    email
  });

  return {
    profileId: resolved.profileId,
    organizationId: resolved.organizationId,
    role: resolved.role,
    email,
    source: 'supabase'
  };
}

export async function resolveSdkActorFromAuthInfo(extra: { authInfo?: { extra?: Record<string, unknown> } } | undefined) {
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
    role: role as PremortemMcpActorContext['role'],
    email: typeof row.email === 'string' ? row.email : null,
    source: row.source === 'api-key' ? 'api-key' : 'supabase'
  } satisfies PremortemMcpActorContext;
}

export async function submitPremortemAudit(
  env: PremortemMcpRuntimeEnv,
  actor: PremortemMcpActorContext,
  input: {
    projectId: string;
    branch: string;
    commitSha?: string;
    scanCodeSnippet?: string;
  }
) {
  requireActorRole(actor, ORG_WRITE_ROLES);

  const result = await submitAudit({
    organizationId: actor.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha,
    scanCodeSnippet: input.scanCodeSnippet,
    triggeredById: actor.profileId,
    triggerSource: 'api'
  });

  if (env.AUDIT_QUEUE && !result.reusedActiveRun) {
    await env.AUDIT_QUEUE.send(result.job);
    return {
      ok: true,
      auditRunId: result.auditRunId,
      runStatus: result.runStatus,
      idempotencyKey: result.idempotencyKey,
      reusedActiveRun: result.reusedActiveRun ?? false,
      executionMode: 'queue'
    };
  }

  if (!result.reusedActiveRun) {
    const execution = await executeAuditJob({
      job: result.job,
      rootDir: env.PREMORTEM_REPO_ROOT ?? resolveRepoRoot()
    });

    return {
      ok: true,
      auditRunId: execution.auditRunId,
      runStatus: execution.runStatus,
      idempotencyKey: result.idempotencyKey,
      reusedActiveRun: false,
      executionMode: 'inline',
      findingsCount: execution.findingsCount,
      clusterCount: execution.clusterCount,
      issueCandidateCount: execution.issueCandidateCount,
      rejectedIssueCount: execution.rejectedIssueCount
    };
  }

  return {
    ok: true,
    auditRunId: result.auditRunId,
    runStatus: result.runStatus,
    idempotencyKey: result.idempotencyKey,
    reusedActiveRun: result.reusedActiveRun ?? false,
    executionMode: env.AUDIT_QUEUE ? 'queue' : 'inline'
  };
}

export async function getPremortemWorkspaceSummary(actor: PremortemMcpActorContext) {
  const workspace = await getWorkspaceBundle({
    organizationId: actor.organizationId,
    profileId: actor.profileId
  });

  return sanitizeWorkspaceBundle(workspace);
}

export async function getPremortemBillingStatus(actor: PremortemMcpActorContext) {
  requireActorRole(actor, BILLING_ROLES);
  const workspace = await getWorkspaceBundle({
    organizationId: actor.organizationId,
    profileId: actor.profileId
  });
  return {
    actor: {
      profileId: actor.profileId,
      organizationId: actor.organizationId,
      role: actor.role
    },
    billing: workspace.billing,
    usage: workspace.usage,
    runtime: workspace.runtime
  };
}

export async function getPremortemWhoami(actor: PremortemMcpActorContext) {
  const entitlements = await getOrganizationEntitlements(actor.organizationId);
  return {
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
  };
}

export async function listPremortemProjects(actor: PremortemMcpActorContext, input: { take?: number; cursor?: string }) {
  const take = input.take ?? 25;
  const result = await listOrganizationProjects(actor.organizationId, {
    take,
    cursor: input.cursor
  });
  return {
    organizationId: actor.organizationId,
    take,
    ...result
  };
}

export async function listPremortemAudits(actor: PremortemMcpActorContext, input: { limit?: number }) {
  const limit = input.limit ?? 12;
  const auditRuns = await getRecentAuditRuns(actor.organizationId, limit);
  return { organizationId: actor.organizationId, limit, auditRuns };
}

export async function getPremortemAudit(actor: PremortemMcpActorContext, input: { auditRunId: string; includeGraphPayload?: boolean; includeEvidenceSnippets?: boolean }) {
  const snapshot = await getAuditRunSnapshot(input.auditRunId, {
    includeGraphPayload: input.includeGraphPayload ?? true,
    includeEvidenceSnippets: input.includeEvidenceSnippets ?? true
  });
  if (!snapshot || snapshot.organizationId !== actor.organizationId) {
    throw new Error('Audit run not found.');
  }
  return snapshot;
}

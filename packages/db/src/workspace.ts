import type { Prisma } from '@prisma/client';
import { DEFAULT_GEMINI_MODEL, normalizeWorkItemAttributeConfig } from '@premortem/domain';

import { auditQuotaForPlan, PLAN_LIMITS } from './entitlements';
import { prisma } from './client';
import { encodeStoredToken, ensureGitLabAccessTokenForConnection } from './provider-tokens';
import { getUsageEventTotalsForOrganization } from './usage-metering';
import { isStripeBillingConfigured, isStripeTestMode, shouldUseStripeCheckout } from './stripe-env';

export const DEFAULT_WORKSPACE_POLICIES = [
  {
    id: 'transport-ssl',
    name: 'Strict Transport Isolation (SSL)',
    description:
      'Reject raw port 80 or unencrypted plaintext transit connections during live routing.',
    active: true
  },
  {
    id: 'env-fallback-literals',
    name: 'Reject environment fallback literals',
    description:
      'Flag hardcoded access ids or keys fallback properties on module dependencies configuration.',
    active: true
  },
  {
    id: 'sql-parameterization',
    name: 'Strict parameters SQL verification',
    description:
      'Prevent raw queries string concatenations on database router configurations.',
    active: true
  },
  {
    id: 'mask-sensitive-logs',
    name: 'Mask sensitive prints logs targets',
    description:
      'Inhibit standard console print buffers output on critical credentials transaction requests.',
    active: false
  }
] as const;

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function formatScope(accessScope: Prisma.JsonValue | null | undefined): string {
  const scope = asObject(accessScope);
  if (typeof scope.summary === 'string') return scope.summary;
  const values = Object.values(scope).filter((entry) => typeof entry === 'string');
  return values.length > 0 ? values.join(', ') : 'read_user';
}

function connectionStatusLabel(status: string): 'connected' | 'active_check' | 'disconnected' {
  if (status === 'active') return 'connected';
  if (status === 'pending') return 'active_check';
  return 'disconnected';
}

/** Active provider OAuth connection with a stored access token (repo/API scope). */
export async function hasActiveProviderConnection(
  organizationId: string,
  provider: 'gitlab' | 'github'
): Promise<boolean> {
  const connection = await prisma.providerConnection.findFirst({
    where: {
      organizationId,
      provider,
      status: 'active',
      encryptedAccessToken: { not: null }
    },
    select: { id: true }
  });
  return Boolean(connection);
}

function readPolicies(metadata: Prisma.JsonValue) {
  const policies = asObject(metadata).policies;
  if (!Array.isArray(policies) || policies.length === 0) {
    return DEFAULT_WORKSPACE_POLICIES.map((policy) => ({ ...policy }));
  }
  return policies as Array<{ id: string; name: string; description: string; active: boolean }>;
}

function readNotifications(metadata: Prisma.JsonValue) {
  const notifications = asObject(metadata).notifications;
  const row = asObject(notifications as Prisma.JsonValue);
  return {
    slackWebhook: typeof row.slackWebhook === 'string' ? row.slackWebhook : '',
    slackChannel: typeof row.slackChannel === 'string' ? row.slackChannel : '',
    isSlackConnected: Boolean(row.isSlackConnected),
    alertEmails: typeof row.alertEmails === 'string' ? row.alertEmails : '',
    alertSeverity: typeof row.alertSeverity === 'string' ? row.alertSeverity : 'HIGH'
  };
}

function readRuntime(metadata: Prisma.JsonValue) {
  const runtime = asObject(asObject(metadata).runtime as Prisma.JsonValue);
  return {
    continuousAuditEnabled: runtime.continuousAuditEnabled === true
  };
}

function readWorkItemAttributes(metadata: Prisma.JsonValue) {
  return normalizeWorkItemAttributeConfig(asObject(metadata).workItemAttributes);
}

function readLlm(metadata: Prisma.JsonValue) {
  const llm = asObject(metadata).llm;
  const row = asObject(llm as Prisma.JsonValue);
  const customProviders = Array.isArray(row.customProviders) ? row.customProviders : [];
  const providerNames = (customProviders as Array<{ name?: string }>)
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === 'string');

  return {
    selectedGeminiModel:
      typeof row.selectedGeminiModel === 'string'
        ? row.selectedGeminiModel
        : process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL,
    maxTokens: typeof row.maxTokens === 'number' ? row.maxTokens : 8192,
    temperature: typeof row.temperature === 'number' ? row.temperature : 0.2,
    customProviders: customProviders as Array<{
      name: string;
      host: string;
      model: string;
      active: boolean;
    }>,
    vendorRouting: readVendorRouting(row.vendorRouting, providerNames)
  };
}

const DEFAULT_VENDOR_ROUTING = [
  {
    id: 'boost',
    label: 'Boost Tier',
    description: 'Low-latency custom endpoint for fast specialist passes.',
    kind: 'custom' as const,
    providerRef: '',
    enabled: false
  },
  {
    id: 'primary',
    label: 'Primary Tier',
    description: 'Managed Gemini models for synthesis and deep reasoning.',
    kind: 'managed' as const,
    providerRef: 'gemini',
    enabled: true
  },
  {
    id: 'fallback',
    label: 'Auto-Discover',
    description: 'Probe local Ollama, LM Studio, and compatible OpenAI proxies.',
    kind: 'auto_discover' as const,
    providerRef: 'local',
    enabled: true
  }
];

function readVendorRouting(value: unknown, providerNames: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier }));
  }

  return value.map((entry, index) => {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const fallback = DEFAULT_VENDOR_ROUTING[index] ?? DEFAULT_VENDOR_ROUTING[DEFAULT_VENDOR_ROUTING.length - 1]!;
    const kind =
      row.kind === 'managed' || row.kind === 'custom' || row.kind === 'auto_discover'
        ? row.kind
        : fallback.kind;
    let providerRef =
      typeof row.providerRef === 'string' ? row.providerRef : fallback.providerRef;
    if (kind === 'custom' && providerRef && !providerNames.includes(providerRef)) {
      providerRef = providerNames[0] ?? '';
    }
    return {
      id: typeof row.id === 'string' ? row.id : fallback.id,
      label: typeof row.label === 'string' ? row.label : fallback.label,
      description: typeof row.description === 'string' ? row.description : fallback.description,
      kind,
      providerRef,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled
    };
  });
}

export type OrganizationLlmSettings = ReturnType<typeof readLlm>;

export async function getOrganizationLlmSettings(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId }
  });
  return readLlm(organization.metadata);
}

export interface ProfileProvisionHints {
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
}

export async function createPersonalWorkspaceForProfile(
  profileId: string,
  hints?: ProfileProvisionHints
) {
  // First login: the Supabase user may not have a Profile row yet. Provision it
  // before building the workspace so onboarding never depends on manual seeding.
  const profile = await prisma.profile.upsert({
    where: { id: profileId },
    update: {
      email: hints?.email ?? undefined,
      fullName: hints?.fullName ?? undefined,
      username: hints?.username ?? undefined
    },
    create: {
      id: profileId,
      email: hints?.email ?? undefined,
      fullName: hints?.fullName ?? undefined,
      username: hints?.username ?? undefined
    }
  });
  const baseSlug =
    (profile.username ?? profile.email?.split('@')[0] ?? 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'workspace';

  let slug = baseSlug;
  let suffix = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const organization = await prisma.organization.create({
    data: {
      name: profile.fullName ? `${profile.fullName}'s Workspace` : 'My Workspace',
      slug,
      createdById: profileId,
      metadata: {
        runtime: { continuousAuditEnabled: false }
      } as Prisma.JsonObject
    }
  });

  await ensureOrganizationDefaults(organization.id);
  await ensureProfileMembership({
    profileId,
    email: profile.email,
    fullName: profile.fullName,
    username: profile.username,
    organizationId: organization.id
  });

  return organization.id;
}

export async function ensureProfileMembership(input: {
  profileId: string;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
  organizationId: string;
}) {
  await prisma.profile.upsert({
    where: { id: input.profileId },
    update: {
      email: input.email ?? undefined,
      fullName: input.fullName ?? undefined,
      username: input.username ?? undefined,
      defaultOrgId: input.organizationId
    },
    create: {
      id: input.profileId,
      email: input.email ?? undefined,
      fullName: input.fullName ?? undefined,
      username: input.username ?? undefined,
      defaultOrgId: input.organizationId
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.profileId
      }
    },
    update: {},
    create: {
      organizationId: input.organizationId,
      userId: input.profileId,
      role: 'member'
    }
  });
}

export async function ensureOrganizationDefaults(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId }
  });
  const metadata = asObject(organization.metadata);
  const nextMetadata = { ...metadata };

  if (!Array.isArray(metadata.policies) || metadata.policies.length === 0) {
    nextMetadata.policies = DEFAULT_WORKSPACE_POLICIES.map((policy) => ({ ...policy }));
  }
  if (!metadata.notifications) {
    nextMetadata.notifications = {
      slackWebhook: '',
      slackChannel: '',
      isSlackConnected: false,
      alertEmails: organization.billingEmail ?? '',
      alertSeverity: 'HIGH'
    };
  }
  if (!metadata.llm) {
    nextMetadata.llm = {
      selectedGeminiModel: process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL,
      maxTokens: 8192,
      temperature: 0.2,
      customProviders: [],
      vendorRouting: DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier }))
    };
  }
  if (!metadata.workItemAttributes) {
    nextMetadata.workItemAttributes = normalizeWorkItemAttributeConfig(null);
  }
  if (!metadata.runtime) {
    nextMetadata.runtime = { continuousAuditEnabled: false };
  }

  if (JSON.stringify(nextMetadata) !== JSON.stringify(metadata)) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { metadata: nextMetadata as Prisma.JsonObject }
    });
  }

  await prisma.organizationBillingAccount.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      plan: organization.plan,
      auditQuotaMonthly: auditQuotaForPlan(organization.plan)
    }
  });
}

export async function getWorkspaceBundle(input: {
  organizationId: string;
  profileId: string;
}) {
  await ensureOrganizationDefaults(input.organizationId);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    organization,
    profile,
    membership,
    memberships,
    connections,
    projects,
    billing,
    apiKeys,
    auditsThisMonth,
    publishedIssues,
    usageTotals,
    activityEvents,
    runningAudits
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      include: { billingAccount: true }
    }),
    prisma.profile.findUniqueOrThrow({ where: { id: input.profileId } }),
    prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.profileId
        }
      }
    }),
    prisma.organizationMembership.count({ where: { organizationId: input.organizationId } }),
    prisma.providerConnection.findMany({
      where: { organizationId: input.organizationId },
      include: { projects: true },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.project.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.organizationBillingAccount.findUnique({
      where: { organizationId: input.organizationId }
    }),
    prisma.organizationApiKey.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.auditRun.count({
      where: {
        organizationId: input.organizationId,
        createdAt: { gte: monthStart }
      }
    }),
    prisma.publishedIssue.count({
      where: { organizationId: input.organizationId }
    }),
    getUsageEventTotalsForOrganization(input.organizationId, monthStart),
    prisma.activityEvent.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { actor: true }
    }),
    prisma.auditRun.count({
      where: {
        organizationId: input.organizationId,
        runStatus: { in: ['queued', 'running', 'paused'] }
      }
    })
  ]);

  const integrationsFromConnections = connections.map((connection) => ({
    id: connection.id,
    name: connection.externalAccountName ?? `${connection.provider} connection`,
    provider: connection.provider,
    status: connectionStatusLabel(connection.status),
    scope: formatScope(connection.accessScope),
    lastSync: connection.lastSyncedAt
      ? connection.lastSyncedAt.toISOString()
      : null,
    vcsOwner: connection.externalAccountName ?? connection.externalAccountId ?? connection.provider,
    projectCount: connection.projects.length
  }));

  const integrationsFromProjects = projects
    .filter((project) => !project.connectionId)
    .map((project) => ({
      id: project.id,
      name: project.name,
      provider: project.provider,
      status: project.status === 'active' ? 'connected' : 'disconnected',
      scope: `${project.provider} repository`,
      lastSync: project.updatedAt.toISOString(),
      vcsOwner: project.repoUrl ?? project.externalProjectId,
      projectCount: 1
    }));

  const integrations = [...integrationsFromConnections, ...integrationsFromProjects];

  const auditQuota = billing?.auditQuotaMonthly ?? 50;
  const metadata = organization.metadata;

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
      role: membership?.role ?? 'member'
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      billingEmail: organization.billingEmail,
      websiteUrl: organization.websiteUrl,
      memberCount: memberships,
      projectCount: projects.length
    },
    integrations,
    policies: readPolicies(metadata),
    notifications: readNotifications(metadata),
    llm: readLlm(metadata),
    workItemAttributes: readWorkItemAttributes(metadata),
    billing: {
      plan: billing?.plan ?? organization.plan,
      billingStatus: billing?.billingStatus ?? 'active',
      seats: billing?.seats ?? memberships,
      auditQuotaMonthly: auditQuota,
      auditsUsedMonth: billing?.auditsUsedMonth ?? auditsThisMonth,
      stripeConfigured: shouldUseStripeCheckout() && Boolean(billing?.stripeCustomerId),
      stripeTestMode: isStripeTestMode(),
      stripeBillingConfigured: isStripeBillingConfigured(),
      canPublish: PLAN_LIMITS[billing?.plan ?? organization.plan].canPublish,
      maxRepos: PLAN_LIMITS[billing?.plan ?? organization.plan].maxRepos,
      invoices: []
    },
    apiKeys: apiKeys.map((key) => ({
      id: key.id,
      label: key.label,
      keyPrefix: key.keyPrefix,
      lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
      createdAt: key.createdAt.toISOString()
    })),
    usage: {
      scans: { used: auditsThisMonth, limit: auditQuota },
      repos: { used: projects.length, limit: PLAN_LIMITS[billing?.plan ?? organization.plan].maxRepos },
      tokens: { used: usageTotals.tokensUsed, limit: 50 },
      patches: { used: publishedIssues, limit: Math.max(publishedIssues, 50) }
    },
    activity: activityEvents.map((event) => ({
      id: event.id,
      summary: event.summary ?? event.eventType,
      actor: event.actor?.email ?? event.actor?.fullName ?? 'system',
      createdAt: event.createdAt.toISOString()
    })),
    runtime: {
      runningAudits,
      ...readRuntime(metadata)
    }
  };
}

export async function updateWorkspaceProfile(input: {
  profileId: string;
  fullName?: string;
  username?: string;
  timezone?: string;
  bio?: string;
}) {
  return prisma.profile.update({
    where: { id: input.profileId },
    data: {
      fullName: input.fullName,
      username: input.username,
      timezone: input.timezone,
      bio: input.bio
    }
  });
}

export async function updateWorkspaceOrganization(input: {
  organizationId: string;
  name?: string;
  billingEmail?: string;
  websiteUrl?: string;
}) {
  return prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      name: input.name,
      billingEmail: input.billingEmail,
      websiteUrl: input.websiteUrl
    }
  });
}

async function patchOrganizationMetadata(
  organizationId: string,
  patch: Record<string, unknown>
) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId }
  });
  const metadata = { ...asObject(organization.metadata), ...patch };
  return prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: metadata as Prisma.JsonObject }
  });
}

export async function updateWorkspacePolicies(input: {
  organizationId: string;
  policies: Array<{ id: string; name: string; description: string; active: boolean }>;
}) {
  return patchOrganizationMetadata(input.organizationId, { policies: input.policies });
}

export async function updateWorkspaceWorkItemAttributes(input: {
  organizationId: string;
  workItemAttributes: ReturnType<typeof normalizeWorkItemAttributeConfig>;
}) {
  return patchOrganizationMetadata(input.organizationId, {
    workItemAttributes: normalizeWorkItemAttributeConfig(input.workItemAttributes)
  });
}

export async function updateWorkspaceRuntime(input: {
  organizationId: string;
  continuousAuditEnabled: boolean;
}) {
  await patchOrganizationMetadata(input.organizationId, {
    runtime: { continuousAuditEnabled: input.continuousAuditEnabled }
  });

  const projects = await prisma.project.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, settings: true }
  });

  if (projects.length === 0) {
    return { updatedProjects: 0 };
  }

  await prisma.$transaction([
    ...projects.map((project) => {
      const settings = {
        ...asObject(project.settings),
        autoRunOnPush: input.continuousAuditEnabled
      };
      return prisma.project.update({
        where: { id: project.id },
        data: { settings: settings as Prisma.JsonObject }
      });
    }),
    ...projects.map((project) =>
      prisma.projectSetting.upsert({
        where: { projectId: project.id },
        update: { autoRunOnPush: input.continuousAuditEnabled },
        create: {
          projectId: project.id,
          autoRunOnPush: input.continuousAuditEnabled
        }
      })
    )
  ]);

  return { updatedProjects: projects.length };
}

export async function stopAllAuditRuntime(
  organizationId: string,
  reason = 'Runtime stopped by operator'
) {
  const runtimeResult = await updateWorkspaceRuntime({
    organizationId,
    continuousAuditEnabled: false
  });

  const { cancelAuditRun } = await import('./audit-lifecycle');

  const activeRuns = await prisma.auditRun.findMany({
    where: {
      organizationId,
      runStatus: { in: ['queued', 'running', 'paused'] }
    },
    select: { id: true, runStatus: true }
  });

  let cancelledCount = 0;
  for (const run of activeRuns) {
    try {
      await cancelAuditRun(run.id, reason);
      cancelledCount += 1;
    } catch {
      // Skip runs that finished between query and cancel.
    }
  }

  return {
    continuousAuditEnabled: false,
    cancelledCount,
    updatedProjects: runtimeResult.updatedProjects ?? 0
  };
}

export async function updateWorkspaceNotifications(input: {
  organizationId: string;
  notifications: {
    slackWebhook?: string;
    slackChannel?: string;
    isSlackConnected?: boolean;
    alertEmails?: string;
    alertSeverity?: string;
  };
}) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId }
  });
  const current = readNotifications(organization.metadata);
  return patchOrganizationMetadata(input.organizationId, {
    notifications: { ...current, ...input.notifications }
  });
}

export async function updateWorkspaceLlm(input: {
  organizationId: string;
  llm: {
    selectedGeminiModel?: string;
    maxTokens?: number;
    temperature?: number;
    customProviders?: Array<{ name: string; host: string; model: string; active: boolean }>;
    vendorRouting?: Array<{
      id: string;
      label: string;
      description: string;
      kind: 'managed' | 'custom' | 'auto_discover';
      providerRef: string;
      enabled: boolean;
    }>;
  };
}) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId }
  });
  const current = readLlm(organization.metadata);
  return patchOrganizationMetadata(input.organizationId, {
    llm: { ...current, ...input.llm }
  });
}

export async function createProviderConnection(input: {
  organizationId: string;
  createdById: string;
  provider: 'gitlab' | 'github';
  externalAccountName: string;
  externalAccountId?: string;
  accessScope?: Record<string, unknown>;
  accessToken?: string;
}) {
  const connection = await prisma.providerConnection.create({
    data: {
      organizationId: input.organizationId,
      provider: input.provider,
      externalAccountName: input.externalAccountName,
      externalAccountId: input.externalAccountId ?? input.externalAccountName,
      accessScope: (input.accessScope ?? { summary: 'read_user' }) as Prisma.JsonObject,
      status: input.accessToken ? 'active' : 'pending',
      createdById: input.createdById,
      encryptedAccessToken: input.accessToken ? encodeStoredToken(input.accessToken) : undefined,
      lastSyncedAt: input.accessToken ? new Date() : undefined
    }
  });
  return connection;
}

export async function upsertProviderConnectionFromOAuth(input: {
  organizationId: string;
  createdById: string;
  provider: 'gitlab' | 'github';
  externalAccountId: string;
  externalAccountName: string;
  accessToken: string;
  refreshToken?: string;
  accessScope?: Record<string, unknown>;
  expiresInSeconds?: number;
}) {
  const tokenExpiresAt =
    typeof input.expiresInSeconds === 'number' && input.expiresInSeconds > 0
      ? new Date(Date.now() + input.expiresInSeconds * 1000)
      : undefined;

  return prisma.providerConnection.upsert({
    where: {
      organizationId_provider_externalAccountId: {
        organizationId: input.organizationId,
        provider: input.provider,
        externalAccountId: input.externalAccountId
      }
    },
    update: {
      externalAccountName: input.externalAccountName,
      encryptedAccessToken: encodeStoredToken(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? encodeStoredToken(input.refreshToken) : undefined,
      accessScope: (input.accessScope ?? { summary: 'read_user, api, read_repository' }) as Prisma.JsonObject,
      status: 'active',
      lastSyncedAt: new Date(),
      tokenExpiresAt
    },
    create: {
      organizationId: input.organizationId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      externalAccountName: input.externalAccountName,
      encryptedAccessToken: encodeStoredToken(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? encodeStoredToken(input.refreshToken) : undefined,
      accessScope: (input.accessScope ?? { summary: 'read_user, api, read_repository' }) as Prisma.JsonObject,
      status: 'active',
      createdById: input.createdById,
      lastSyncedAt: new Date(),
      tokenExpiresAt
    }
  });
}

export async function syncProviderConnection(connectionId: string) {
  const connection = await prisma.providerConnection.findUniqueOrThrow({
    where: { id: connectionId }
  });

  if (connection.provider === 'gitlab' && connection.encryptedAccessToken) {
    try {
      await ensureGitLabAccessTokenForConnection(connection.id);
    } catch {
      return prisma.providerConnection.update({
        where: { id: connectionId },
        data: {
          status: 'failed',
          lastSyncedAt: new Date()
        }
      });
    }
  }

  return prisma.providerConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncedAt: new Date(),
      status: 'active'
    }
  });
}

export async function updateBillingPlan(input: {
  organizationId: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
}) {
  const billing = await prisma.organizationBillingAccount.findUnique({
    where: { organizationId: input.organizationId }
  });
  const checkoutRequired =
    shouldUseStripeCheckout() && Boolean(billing?.stripeCustomerId);

  if (checkoutRequired && (input.plan === 'pro' || input.plan === 'team')) {
    throw new Error('Paid plan changes must go through Stripe checkout.');
  }

  await prisma.organization.update({
    where: { id: input.organizationId },
    data: { plan: input.plan }
  });
  return prisma.organizationBillingAccount.upsert({
    where: { organizationId: input.organizationId },
    update: { plan: input.plan },
    create: {
      organizationId: input.organizationId,
      plan: input.plan,
      auditQuotaMonthly: auditQuotaForPlan(input.plan)
    }
  });
}

export async function recordActivityEvent(input: {
  organizationId: string;
  actorId?: string;
  eventType: string;
  objectType: string;
  summary: string;
  projectId?: string;
  objectId?: string;
}) {
  return prisma.activityEvent.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: input.eventType,
      objectType: input.objectType,
      summary: input.summary,
      projectId: input.projectId,
      objectId: input.objectId
    }
  });
}

export async function getOrganizationActivityEvents(organizationId: string, limit = 250) {
  const events = await prisma.activityEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: true }
  });

  return events.map((event) => ({
    id: event.id,
    organizationId: event.organizationId,
    projectId: event.projectId,
    actorId: event.actorId,
    actorEmail: event.actor?.email ?? null,
    actorName: event.actor?.fullName ?? event.actor?.username ?? null,
    eventType: event.eventType,
    objectType: event.objectType,
    objectId: event.objectId,
    summary: event.summary,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString()
  }));
}

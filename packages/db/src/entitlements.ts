/**
 * Organization entitlement helpers for plan limits, quota enforcement, and
 * monthly usage resets.
 */
import type { OrgPlan } from '@prisma/client';

import { prisma } from './client';
import { getUsageEventTotalsForOrganization } from './usage-metering';

/** Business-model tier limits used across audit, publish, and workspace gating. */
export const PLAN_LIMITS: Record<
  OrgPlan,
  {
    maxRepos: number;
    auditsPerMonth: number;
    publishesPerMonth: number | null;
    canPublish: boolean;
    label: string;
    historyRetentionDays: number;
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
    sarifExport: boolean;
    webhooks: boolean;
    graphitiMemory: boolean;
    skillMarketplace: boolean;
  }
> = {
  free: {
    maxRepos: 1,
    auditsPerMonth: 10,
    publishesPerMonth: 3,
    canPublish: true,
    label: 'Free',
    historyRetentionDays: 30,
    supportLevel: 'community',
    sarifExport: false,
    webhooks: false,
    graphitiMemory: false,
    skillMarketplace: false
  },
  pro: {
    maxRepos: 10,
    auditsPerMonth: 100,
    publishesPerMonth: null,
    canPublish: true,
    label: 'Starter',
    historyRetentionDays: 90,
    supportLevel: 'email',
    sarifExport: true,
    webhooks: true,
    graphitiMemory: false,
    skillMarketplace: false
  },
  team: {
    maxRepos: 30,
    auditsPerMonth: 300,
    publishesPerMonth: null,
    canPublish: true,
    label: 'Growth',
    historyRetentionDays: 365,
    supportLevel: 'priority',
    sarifExport: true,
    webhooks: true,
    graphitiMemory: true,
    skillMarketplace: false
  },
  scale: {
    maxRepos: 100,
    auditsPerMonth: 1000,
    publishesPerMonth: null,
    canPublish: true,
    label: 'Scale',
    historyRetentionDays: 365,
    supportLevel: 'priority',
    sarifExport: true,
    webhooks: true,
    graphitiMemory: true,
    skillMarketplace: true
  },
  enterprise: {
    maxRepos: 9999,
    auditsPerMonth: 10_000,
    publishesPerMonth: null,
    canPublish: true,
    label: 'Enterprise',
    historyRetentionDays: 3650,
    supportLevel: 'dedicated',
    sarifExport: true,
    webhooks: true,
    graphitiMemory: true,
    skillMarketplace: true
  }
};

export class EntitlementError extends Error {
  /** Stable machine-readable entitlement failure code. */
  readonly code: 'quota_exceeded' | 'feature_locked' | 'repo_limit';
  /** HTTP status returned by callers when entitlement checks fail. */
  readonly status: number;

  constructor(code: EntitlementError['code'], message: string, status = 403) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
    this.status = status;
  }
}

export function auditQuotaForPlan(plan: OrgPlan): number {
  return PLAN_LIMITS[plan].auditsPerMonth;
}

/**
 * Count only connected repositories that still consume plan quota.
 *
 * Archived and disconnected rows remain part of history, but they no longer
 * consume tier capacity.
 */
export function countConnectedProjects(projects: Array<{ status?: string | null }>) {
  return projects.reduce(
    (total, project) => total + (project.status === 'active' ? 1 : 0),
    0
  );
}

/**
 * Read the current entitlement state for an organization.
 *
 * @param organizationId - Organization to inspect.
 * @returns Current plan, project count, and monthly audit usage.
 */
export async function getOrganizationEntitlements(organizationId: string) {
  const [organization, billing, projectCount, auditsThisMonth, usageTotals] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.organizationBillingAccount.findUnique({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId, status: 'active' } }),
    prisma.auditRun.count({
      where: {
        organizationId,
        createdAt: { gte: startOfUtcMonth() }
      }
    }),
    getUsageEventTotalsForOrganization(organizationId, startOfUtcMonth())
  ]);

  const plan = billing?.plan ?? organization.plan;
  const limits = PLAN_LIMITS[plan];
  const auditLimit = billing?.auditQuotaMonthly ?? limits.auditsPerMonth;
  const auditsUsed = billing?.auditsUsedMonth ?? auditsThisMonth;
  const publishLimit = limits.publishesPerMonth;
  const publishesUsed = usageTotals.publishes;
  const canPublish = publishLimit === null || publishesUsed < publishLimit;

  return {
    plan,
    limits,
    projectCount,
    auditsUsed,
    auditLimit,
    publishesUsed,
    publishLimit,
    canPublish
  };
}

function startOfUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Block repository registration when the organization already reached plan capacity.
 *
 * @param organizationId - Organization that wants to connect another repository.
 * @throws EntitlementError when the plan quota is exhausted.
 */
export async function assertCanRegisterProject(organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (entitlements.projectCount >= entitlements.limits.maxRepos) {
    throw new EntitlementError(
      'repo_limit',
      `${entitlements.limits.label} plan allows up to ${entitlements.limits.maxRepos} connected repositories. Upgrade to add more.`
    );
  }
}

/**
 * Block audit submission when the organization has exhausted its monthly quota.
 *
 * @param organizationId - Organization that wants to run an audit.
 * @throws EntitlementError when the monthly audit limit is exhausted.
 */
export async function assertCanRunAudit(organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (entitlements.auditsUsed >= entitlements.auditLimit) {
    throw new EntitlementError(
      'quota_exceeded',
      `${entitlements.limits.label} plan allows ${entitlements.auditLimit} audits per month. Upgrade or wait for the next billing cycle.`,
      402
    );
  }
}

/**
 * Block GitLab publish when the organization is on a plan that does not permit publishing.
 *
 * @param organizationId - Organization that wants to publish approved issues.
 * @throws EntitlementError when the plan does not allow publish access.
 */
export async function assertCanPublish(organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (entitlements.publishLimit !== null && entitlements.publishesUsed >= entitlements.publishLimit) {
    const label = entitlements.limits.label;
    const limit = entitlements.publishLimit;
    throw new EntitlementError(
      'feature_locked',
      limit === 3
        ? `${label} plan allows ${limit} publishes per month. Upgrade to Starter for unlimited publish.`
        : `${label} plan allows ${limit} publishes per month. Upgrade to remove publish limits.`
    );
  }
}

/**
 * Increment monthly audit usage after a submission is accepted.
 *
 * @param organizationId - Organization that submitted the audit.
 */
export async function recordAuditSubmitted(organizationId: string) {
  await prisma.organizationBillingAccount.upsert({
    where: { organizationId },
    update: { auditsUsedMonth: { increment: 1 } },
    create: {
      organizationId,
      plan: 'free',
      auditQuotaMonthly: PLAN_LIMITS.free.auditsPerMonth,
      auditsUsedMonth: 1
    }
  });

  await prisma.usageEvent.create({
    data: {
      organizationId,
      eventType: 'audit.submitted',
      quantity: 1,
      metadata: { source: 'submitAudit' }
    }
  });
}

/**
 * Reset monthly audit counters so the next billing period starts from zero.
 *
 * @returns The Prisma bulk-update result for all organizations that had non-zero usage.
 */
export async function resetMonthlyAuditUsage() {
  return prisma.organizationBillingAccount.updateMany({
    where: { auditsUsedMonth: { gt: 0 } },
    data: { auditsUsedMonth: 0 }
  });
}

/**
 * Find the most recent active audit run for a project branch.
 *
 * @param input - Organization, project, and branch scope for the lookup.
 * @returns The most recent active audit run or null when no active run exists.
 */
export async function findActiveAuditRun(input: {
  organizationId: string;
  projectId: string;
  branch: string;
}) {
  const freshQueuedSince = new Date(Date.now() - 90 * 1000);
  return prisma.auditRun.findFirst({
    where: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      branch: input.branch,
      OR: [
        {
          runStatus: 'queued',
          createdAt: { gte: freshQueuedSince }
        },
        {
          runStatus: { in: ['running', 'paused'] },
          leaseExpiresAt: { gt: new Date() }
        }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
}

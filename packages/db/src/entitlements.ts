import type { OrgPlan } from '@prisma/client';

import { prisma } from './client';

/** Business-model tier limits (ADR v0.1.0 + Business_model.md). */
export const PLAN_LIMITS: Record<
  OrgPlan,
  { maxRepos: number; auditsPerMonth: number; canPublish: boolean; label: string }
> = {
  free: { maxRepos: 1, auditsPerMonth: 10, canPublish: false, label: 'Free' },
  pro: { maxRepos: 10, auditsPerMonth: 100, canPublish: true, label: 'Starter' },
  team: { maxRepos: 50, auditsPerMonth: 500, canPublish: true, label: 'Growth' },
  enterprise: { maxRepos: 9999, auditsPerMonth: 10_000, canPublish: true, label: 'Enterprise' }
};

export class EntitlementError extends Error {
  readonly code: 'quota_exceeded' | 'feature_locked' | 'repo_limit';
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

export async function getOrganizationEntitlements(organizationId: string) {
  const [organization, billing, projectCount, auditsThisMonth] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.organizationBillingAccount.findUnique({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId } }),
    prisma.auditRun.count({
      where: {
        organizationId,
        createdAt: { gte: startOfUtcMonth() }
      }
    })
  ]);

  const plan = billing?.plan ?? organization.plan;
  const limits = PLAN_LIMITS[plan];
  const auditLimit = billing?.auditQuotaMonthly ?? limits.auditsPerMonth;
  const auditsUsed = billing?.auditsUsedMonth ?? auditsThisMonth;

  return {
    plan,
    limits,
    projectCount,
    auditsUsed,
    auditLimit,
    canPublish: limits.canPublish
  };
}

function startOfUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function assertCanRegisterProject(organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (entitlements.projectCount >= entitlements.limits.maxRepos) {
    throw new EntitlementError(
      'repo_limit',
      `${entitlements.limits.label} plan allows up to ${entitlements.limits.maxRepos} connected repositories. Upgrade to add more.`
    );
  }
}

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

export async function assertCanPublish(organizationId: string) {
  const entitlements = await getOrganizationEntitlements(organizationId);
  if (!entitlements.canPublish) {
    throw new EntitlementError(
      'feature_locked',
      'GitLab publish is available on Starter plans and above. Upgrade from Free to publish approved issues.'
    );
  }
}

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

export async function findActiveAuditRun(input: {
  organizationId: string;
  projectId: string;
  branch: string;
}) {
  return prisma.auditRun.findFirst({
    where: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      branch: input.branch,
      runStatus: { in: ['queued', 'running', 'paused'] }
    },
    orderBy: { createdAt: 'desc' }
  });
}

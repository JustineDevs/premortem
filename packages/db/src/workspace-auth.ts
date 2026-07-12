import type { Prisma } from '@prisma/client';
import type { AppRole } from '@prisma/client';

import { normalizeWorkItemAttributeConfig } from '@premortem/domain';

import { auditQuotaForPlan } from './entitlements';
import { prisma } from './client';

export interface ProfileProvisionHints {
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
}

export const DEFAULT_WORKSPACE_POLICIES = [
  {
    id: 'release_safety',
    name: 'Release safety',
    description:
      'Require safe rollbacks, deploy gates, and checkpoint coverage before production release.',
    active: true
  },
  {
    id: 'dependency_supply_chain',
    name: 'Dependency supply chain',
    description:
      'Flag unsafe dependency upgrades, unpinned packages, and transitive risk concentration.',
    active: true
  },
  {
    id: 'api_security',
    name: 'API security',
    description:
      'Require request validation, ownership checks, and safe API surface defaults.',
    active: true
  },
  {
    id: 'secret_exposure',
    name: 'Secret exposure',
    description:
      'Prevent credentials from being logged, committed, or returned through unsafe debug paths.',
    active: false
  }
] as const;

export function resolveEffectiveWorkspaceRole(input: {
  organization: { plan: string; createdById: string; memberCount?: number };
  billingPlan?: string | null;
  membershipRole: string | null | undefined;
  profileId: string;
}): AppRole {
  const normalizedMembershipRole = (input.membershipRole ?? 'member') as AppRole;
  const plan = input.billingPlan ?? input.organization.plan;
  const isPaidPlan = plan === 'pro' || plan === 'team' || plan === 'scale' || plan === 'enterprise';
  if (
    isPaidPlan &&
    (normalizedMembershipRole === 'member' || normalizedMembershipRole === 'billing')
  ) {
    return 'admin';
  }

  return normalizedMembershipRole;
}

export async function hasActiveProviderConnection(
  organizationId: string,
  provider: 'gitlab' | 'github'
): Promise<boolean> {
  const connection = await prisma.providerConnection.findFirst({
    where: {
      organizationId,
      provider,
      status: 'active',
      OR: [{ encryptedAccessToken: { not: null } }, { nangoConnectionId: { not: null } }]
    },
    select: { id: true }
  });
  return Boolean(connection);
}

export async function ensureProfileMembership(input: {
  profileId: string;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
  organizationId: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
}) {
  const existingProfile = await prisma.profile.findUnique({
    where: { id: input.profileId },
    select: { id: true, email: true, fullName: true, username: true, defaultOrgId: true }
  });

  if (!existingProfile) {
    await prisma.profile.create({
      data: {
        id: input.profileId,
        email: input.email ?? undefined,
        fullName: input.fullName ?? undefined,
        username: input.username ?? undefined,
        defaultOrgId: input.organizationId
      }
    });
  } else if (
    existingProfile.email !== (input.email ?? null) ||
    existingProfile.fullName !== (input.fullName ?? null) ||
    existingProfile.username !== (input.username ?? null) ||
    existingProfile.defaultOrgId !== input.organizationId
  ) {
    await prisma.profile.update({
      where: { id: input.profileId },
      data: {
        email: input.email ?? undefined,
        fullName: input.fullName ?? undefined,
        username: input.username ?? undefined,
        defaultOrgId: input.organizationId
      }
    });
  }

  const existingMembership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.profileId
      }
    },
    select: { role: true }
  });

  if (!existingMembership) {
    await prisma.organizationMembership.create({
      data: {
        organizationId: input.organizationId,
        userId: input.profileId,
        role: input.role ?? 'member'
      }
    });
    return;
  }

  if (input.role && existingMembership.role !== input.role) {
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.profileId
        }
      },
      data: { role: input.role }
    });
  }
}

export async function markProfileOnboardingCompleted(profileId: string) {
  return prisma.profile.update({
    where: { id: profileId },
    data: { onboardingCompleted: true }
  });
}

export async function createPersonalWorkspaceForProfile(
  profileId: string,
  hints?: ProfileProvisionHints
) {
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
        policies: DEFAULT_WORKSPACE_POLICIES.map((policy) => ({ ...policy })),
        notifications: {
          slackWebhook: '',
          slackChannel: '',
          isSlackConnected: false,
          alertEmails: profile.email ?? '',
          alertSeverity: 'HIGH',
          slackNangoConnectionId: '',
          slackNangoProviderKey: ''
        },
        workItemAttributes: normalizeWorkItemAttributeConfig(null),
        runtime: { continuousAuditEnabled: false }
      } as unknown as Prisma.JsonObject
    }
  });

  await prisma.organizationBillingAccount.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      plan: organization.plan,
      auditQuotaMonthly: auditQuotaForPlan(organization.plan)
    }
  });

  await ensureProfileMembership({
    profileId,
    email: profile.email,
    fullName: profile.fullName,
    username: profile.username,
    organizationId: organization.id,
    role: 'member'
  });

  return organization.id;
}

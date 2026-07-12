import type { AppRole } from '@prisma/client';

import { getOrganizationMembershipRole } from './organization-memberships';
import { prisma } from './client';
import {
  createPersonalWorkspaceForProfile,
  ensureProfileMembership,
  resolveEffectiveWorkspaceRole,
  type ProfileProvisionHints
} from './workspace-auth';

const ACTOR_ORG_CACHE_TTL_MS = 120_000;
const actorOrganizationCache = new Map<
  string,
  { expiresAt: number; value: { organizationId: string; profileId: string; role: AppRole } }
>();

export async function resolveActorOrganization(
  profileId: string,
  hintedOrganizationId?: string,
  profileHints?: ProfileProvisionHints
): Promise<{ organizationId: string; profileId: string; role: AppRole }> {
  const cacheKey = `${profileId}:${hintedOrganizationId ?? ''}`;
  const cached = actorOrganizationCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  async function organizationExists(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        plan: true,
        createdById: true,
        billingAccount: { select: { plan: true } }
      }
    });
  }

  if (hintedOrganizationId) {
    const membershipRole = await getOrganizationMembershipRole({
      userId: profileId,
      organizationId: hintedOrganizationId
    });
    const organization = await organizationExists(hintedOrganizationId);
    if (membershipRole && organization) {
      const resolved = {
        profileId,
        organizationId: hintedOrganizationId,
        role: resolveEffectiveWorkspaceRole({
          organization,
          billingPlan: organization.billingAccount?.plan ?? organization.plan,
          membershipRole,
          profileId
        })
      };
      actorOrganizationCache.set(cacheKey, {
        expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
        value: resolved
      });
      return resolved;
    }
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (profile?.defaultOrgId) {
    const membershipRole = await getOrganizationMembershipRole({
      userId: profileId,
      organizationId: profile.defaultOrgId
    });
    const organization = await organizationExists(profile.defaultOrgId);
    if (membershipRole && organization) {
      const resolved = {
        profileId,
        organizationId: profile.defaultOrgId,
        role: resolveEffectiveWorkspaceRole({
          organization,
          billingPlan: organization.billingAccount?.plan ?? organization.plan,
          membershipRole,
          profileId
        })
      };
      actorOrganizationCache.set(cacheKey, {
        expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
        value: resolved
      });
      return resolved;
    }
  }

  const firstMembership = await prisma.organizationMembership.findFirst({
    where: { userId: profileId },
    select: { organizationId: true, role: true },
    orderBy: { createdAt: 'asc' }
  });
  const firstOrganization = firstMembership
    ? await organizationExists(firstMembership.organizationId)
    : null;
  if (firstMembership && firstOrganization) {
    const resolved = {
      profileId,
      organizationId: firstMembership.organizationId,
      role: resolveEffectiveWorkspaceRole({
        organization: firstOrganization,
        billingPlan: firstOrganization.billingAccount?.plan ?? firstOrganization.plan,
        membershipRole: firstMembership.role,
        profileId
      })
    };
    actorOrganizationCache.set(cacheKey, {
      expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
      value: resolved
    });
    return resolved;
  }

  const organizationId = await createPersonalWorkspaceForProfile(profileId, profileHints);
  const resolved = { profileId, organizationId, role: 'member' as const };
  actorOrganizationCache.set(cacheKey, {
    expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
    value: resolved
  });
  return resolved;
}

import type { AppRole } from '@prisma/client';

import { getOrganizationMembershipRole } from './organization-memberships';
import { prisma } from './client';
import {
  createPersonalWorkspaceForProfile,
  ensureProfileMembership,
  type ProfileProvisionHints
} from './workspace';

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
    return Boolean(await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }));
  }

  if (hintedOrganizationId) {
    const role = await getOrganizationMembershipRole({
      userId: profileId,
      organizationId: hintedOrganizationId
    });
    if (role && (await organizationExists(hintedOrganizationId))) {
      const resolved = { profileId, organizationId: hintedOrganizationId, role };
      actorOrganizationCache.set(cacheKey, {
        expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
        value: resolved
      });
      return resolved;
    }
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (profile?.defaultOrgId) {
    const role = await getOrganizationMembershipRole({
      userId: profileId,
      organizationId: profile.defaultOrgId
    });
    if (role && (await organizationExists(profile.defaultOrgId))) {
      const resolved = { profileId, organizationId: profile.defaultOrgId, role };
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
  if (firstMembership && (await organizationExists(firstMembership.organizationId))) {
    const resolved = {
      profileId,
      organizationId: firstMembership.organizationId,
      role: firstMembership.role
    };
    actorOrganizationCache.set(cacheKey, {
      expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
      value: resolved
    });
    return resolved;
  }

  const organizationId = await createPersonalWorkspaceForProfile(profileId, profileHints);
  const resolved = { profileId, organizationId, role: 'owner' as const };
  actorOrganizationCache.set(cacheKey, {
    expiresAt: now + ACTOR_ORG_CACHE_TTL_MS,
    value: resolved
  });
  return resolved;
}

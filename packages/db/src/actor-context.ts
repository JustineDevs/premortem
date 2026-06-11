import { prisma } from './client';
import {
  createPersonalWorkspaceForProfile,
  ensureProfileMembership,
  type ProfileProvisionHints
} from './workspace';

export async function resolveActorOrganization(
  profileId: string,
  hintedOrganizationId?: string,
  profileHints?: ProfileProvisionHints
): Promise<{ organizationId: string; profileId: string }> {
  if (hintedOrganizationId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: profileId, organizationId: hintedOrganizationId }
    });
    if (membership) {
      return { profileId, organizationId: hintedOrganizationId };
    }
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (profile?.defaultOrgId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: profileId, organizationId: profile.defaultOrgId }
    });
    if (membership) {
      return { profileId, organizationId: profile.defaultOrgId };
    }
  }

  const firstMembership = await prisma.organizationMembership.findFirst({
    where: { userId: profileId },
    orderBy: { createdAt: 'asc' }
  });
  if (firstMembership) {
    return { profileId, organizationId: firstMembership.organizationId };
  }

  const organizationId = await createPersonalWorkspaceForProfile(profileId, profileHints);
  return { profileId, organizationId };
}

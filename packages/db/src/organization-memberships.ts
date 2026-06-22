import type { AppRole } from '@prisma/client';

import { EntitlementError } from './entitlements';
import { prisma } from './client';

export async function getOrganizationMembershipRole(input: {
  organizationId: string;
  userId: string;
}): Promise<AppRole | null> {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId
      }
    },
    select: { role: true }
  });

  return membership?.role ?? null;
}

export async function assertOrganizationSeatAvailability(input: {
  organizationId: string;
  userId?: string;
}) {
  const [billing, membershipCount, existingMembership] = await Promise.all([
    prisma.organizationBillingAccount.findUnique({
      where: { organizationId: input.organizationId },
      select: { seats: true }
    }),
    prisma.organizationMembership.count({
      where: { organizationId: input.organizationId }
    }),
    input.userId
      ? prisma.organizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId
            }
          },
          select: { userId: true }
        })
      : Promise.resolve(null)
  ]);

  if (!billing || existingMembership) {
    return {
      seats: billing?.seats ?? membershipCount,
      membershipCount,
      available: true
    };
  }

  if (membershipCount >= billing.seats) {
    throw new EntitlementError(
      'feature_locked',
      `This workspace plan allows up to ${billing.seats} members. Upgrade to invite more teammates.`
    );
  }

  return {
    seats: billing.seats,
    membershipCount,
    available: true
  };
}

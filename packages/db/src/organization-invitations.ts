import { randomBytes } from 'node:crypto';

import type { AppRole, InvitationStatus, OrganizationInvitation } from '@prisma/client';

import { prisma } from './client';
import { assertOrganizationSeatAvailability } from './organization-memberships';
import { ensureProfileMembership } from './workspace';

export interface OrganizationInvitationSummary {
  id: string;
  organizationId: string;
  email: string;
  role: AppRole;
  token: string;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildInvitationToken() {
  return `pminv_${randomBytes(24).toString('hex')}`;
}

function summarizeInvitation(invitation: OrganizationInvitation): OrganizationInvitationSummary {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    status: invitation.status,
    invitedById: invitation.invitedById,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedById: invitation.acceptedById,
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString()
  };
}

export async function createOrganizationInvitation(input: {
  organizationId: string;
  invitedById: string;
  email: string;
  role?: AppRole;
  expiresInDays?: number;
}) {
  await assertOrganizationSeatAvailability({
    organizationId: input.organizationId
  });

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + (input.expiresInDays ?? 14));

  const existing = await prisma.organizationInvitation.findFirst({
    where: {
      organizationId: input.organizationId,
      email: input.email,
      status: 'pending'
    },
    orderBy: { createdAt: 'desc' }
  });

  const invitation = existing
    ? await prisma.organizationInvitation.update({
        where: { id: existing.id },
        data: {
          role: input.role ?? existing.role,
          invitedById: input.invitedById,
          status: 'pending',
          expiresAt,
          acceptedById: null,
          acceptedAt: null,
          token: buildInvitationToken()
        }
      })
    : await prisma.organizationInvitation.create({
        data: {
          organizationId: input.organizationId,
          invitedById: input.invitedById,
          email: input.email,
          role: input.role ?? 'member',
          token: buildInvitationToken(),
          expiresAt
        }
      });

  return {
    invitation: summarizeInvitation(invitation)
  };
}

export async function getOrganizationInvitationByToken(token: string) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: {
      organization: {
        select: { id: true, name: true, slug: true }
      },
      invitedBy: {
        select: { id: true, email: true, fullName: true, username: true }
      },
      acceptedBy: {
        select: { id: true, email: true, fullName: true, username: true }
      }
    }
  });

  return invitation
    ? {
        invitation: summarizeInvitation(invitation),
        organization: invitation.organization,
        invitedBy: invitation.invitedBy,
        acceptedBy: invitation.acceptedBy
      }
    : null;
}

export async function acceptOrganizationInvitation(input: {
  token: string;
  acceptedById: string;
  acceptedByEmail?: string | null;
}) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: input.token },
    include: {
      organization: { select: { id: true } }
    }
  });

  if (!invitation) {
    return null;
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation is not pending');
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'expired' }
    });
    throw new Error('Invitation has expired');
  }

  if (input.acceptedByEmail && invitation.email.toLowerCase() !== input.acceptedByEmail.toLowerCase()) {
    throw new Error('Invitation email does not match the signed-in user');
  }

  await assertOrganizationSeatAvailability({
    organizationId: invitation.organizationId,
    userId: input.acceptedById
  });

  await prisma.$transaction([
    prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedById: input.acceptedById,
        acceptedAt: new Date()
      }
    }),
    prisma.profile.update({
      where: { id: input.acceptedById },
      data: { defaultOrgId: invitation.organizationId }
    }),
    prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: input.acceptedById
        }
      },
      update: {
        role: invitation.role
      },
      create: {
        organizationId: invitation.organizationId,
        userId: input.acceptedById,
        role: invitation.role
      }
    })
  ]);

  await ensureProfileMembership({
    profileId: input.acceptedById,
    organizationId: invitation.organizationId
  });

  return {
    invitation: summarizeInvitation(
      (await prisma.organizationInvitation.findUniqueOrThrow({
        where: { id: invitation.id }
      })) as OrganizationInvitation
    )
  };
}

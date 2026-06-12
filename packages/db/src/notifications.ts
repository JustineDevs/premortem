import type { Prisma } from '@prisma/client';

import { prisma } from './client';

export type NotificationKind =
  | 'audit_completed'
  | 'audit_failed'
  | 'issues_ready'
  | 'issue_published'
  | 'member_invited'
  | 'billing_notice';

export async function listOrganizationMemberIds(organizationId: string): Promise<string[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId },
    select: { userId: true }
  });
  return [...new Set(memberships.map((membership) => membership.userId))];
}

export async function createOrganizationNotifications(input: {
  organizationId: string;
  projectId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const memberIds = await listOrganizationMemberIds(input.organizationId);
  if (memberIds.length === 0) return { createdCount: 0 };

  await prisma.notification.createMany({
    data: memberIds.map((userId) => ({
      userId,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      metadata: (input.metadata ?? {}) as Prisma.JsonObject
    }))
  });

  return { createdCount: memberIds.length };
}

export async function listUserNotifications(input: {
  userId: string;
  organizationId?: string;
  limit?: number;
}) {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: input.userId,
      ...(input.organizationId ? { organizationId: input.organizationId } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 25
  });

  return notifications.map((notification) => ({
    id: notification.id,
    organizationId: notification.organizationId,
    projectId: notification.projectId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    metadata: notification.metadata,
    createdAt: notification.createdAt.toISOString()
  }));
}

export async function markUserNotificationsRead(input: {
  userId: string;
  notificationIds?: string[];
  organizationId?: string;
}) {
  const where: Parameters<typeof prisma.notification.updateMany>[0]['where'] = {
    userId: input.userId,
    readAt: null,
    ...(input.organizationId ? { organizationId: input.organizationId } : {})
  };
  if (input.notificationIds && input.notificationIds.length > 0) {
    where.id = { in: input.notificationIds };
  }

  return prisma.notification.updateMany({
    where,
    data: { readAt: new Date() }
  });
}

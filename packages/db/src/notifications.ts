import type { Prisma } from '@prisma/client';
import { captureServerException } from '@premortem/observability/server';
import {
  sendSlackNotification,
  type SlackNotificationKind
} from '@premortem/notifications';

import { prisma } from './client';
import { readNotifications } from './workspace';

export type NotificationKind =
  | 'audit_completed'
  | 'audit_failed'
  | 'issues_ready'
  | 'issue_published'
  | 'critical_finding'
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
  const [memberIds, organization] = await Promise.all([
    listOrganizationMemberIds(input.organizationId),
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { metadata: true }
    })
  ]);

  if (memberIds.length > 0) {
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
  }

  const notificationSettings = organization ? readNotifications(organization.metadata) : null;
  if (notificationSettings) {
    const kind: SlackNotificationKind = input.kind;
    void sendSlackNotification(
      {
        organizationId: input.organizationId,
        kind,
        title: input.title,
        body: input.body ?? null,
        url: input.url ?? null,
        severity:
          kind === 'critical_finding'
            ? 'CRITICAL'
            : kind === 'audit_failed'
              ? 'HIGH'
              : kind === 'issues_ready' || kind === 'issue_published'
                ? 'MEDIUM'
                : 'LOW',
        metadata: input.metadata
      },
      {
        organizationId: input.organizationId,
        webhookUrl: notificationSettings.slackWebhook,
        channel: notificationSettings.slackChannel,
        isSlackConnected: notificationSettings.isSlackConnected,
        alertSeverity: notificationSettings.alertSeverity,
        nangoConnectionId: notificationSettings.slackNangoConnectionId,
        nangoProviderKey: notificationSettings.slackNangoProviderKey
      }
    ).catch((error: unknown) => {
      captureServerException(error, {
        surface: 'notifications.slack-fanout',
        organizationId: input.organizationId,
        projectId: input.projectId,
        kind: input.kind
      });
    });
  }

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

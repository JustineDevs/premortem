import type { Prisma } from '@prisma/client';

import { prisma } from './client';

export interface UsageMeterEvent {
  organizationId: string;
  auditRunId?: string;
  projectId?: string;
  eventType: 'audit_run' | 'tokens_in' | 'tokens_out' | 'graph_write' | 'publish';
  quantity: number;
  unit: string;
  metadata?: Record<string, unknown> | null;
}

export async function recordUsageEvent(input: UsageMeterEvent) {
  return prisma.usageEvent.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      auditRunId: input.auditRunId,
      eventType: input.eventType,
      quantity: input.quantity,
      unit: input.unit,
      metadata: (input.metadata ?? {}) as Prisma.JsonObject
    }
  });
}

function asNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  if (value == null) return 0;
  return Number.parseFloat(value.toString());
}

export async function getUsageEventTotalsForOrganization(
  organizationId: string,
  since: Date
): Promise<{
  auditRuns: number;
  tokensUsed: number;
  graphWrites: number;
  publishes: number;
}> {
  const events = await prisma.usageEvent.findMany({
    where: {
      organizationId,
      createdAt: { gte: since }
    },
    select: {
      eventType: true,
      quantity: true
    }
  });

  return events.reduce(
    (acc, event) => {
      const quantity = asNumber(event.quantity);
      if (event.eventType === 'audit_run') acc.auditRuns += quantity;
      if (event.eventType === 'tokens_in' || event.eventType === 'tokens_out') {
        acc.tokensUsed += quantity;
      }
      if (event.eventType === 'graph_write') acc.graphWrites += quantity;
      if (event.eventType === 'publish') acc.publishes += quantity;
      return acc;
    },
    { auditRuns: 0, tokensUsed: 0, graphWrites: 0, publishes: 0 }
  );
}

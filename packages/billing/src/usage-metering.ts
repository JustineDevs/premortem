export interface UsageMeterEvent {
  organizationId: string;
  auditRunId?: string;
  projectId?: string;
  eventType: 'audit_run' | 'tokens_in' | 'tokens_out' | 'graph_write' | 'publish';
  quantity: number;
  unit: string;
  metadata?: Record<string, unknown> | null;
}

export interface UsageEventRow {
  eventType: UsageMeterEvent['eventType'];
  quantity: { toString(): string } | number | string;
}

export interface UsageEventClient {
  usageEvent: {
    create(args: { data: UsageMeterEvent & { metadata: Record<string, unknown> } }): Promise<unknown>;
    findMany(args: {
      where: { organizationId: string; createdAt: { gte: Date } };
      select: { eventType: true; quantity: true };
    }): Promise<UsageEventRow[]>;
  };
}

export async function recordUsageEvent(client: UsageEventClient, input: UsageMeterEvent) {
  return client.usageEvent.create({
    data: {
      ...input,
      metadata: input.metadata ?? {}
    }
  });
}

function asNumber(value: UsageEventRow['quantity']): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  return Number.parseFloat(value.toString());
}

export async function getUsageEventTotalsForOrganization(
  client: UsageEventClient,
  organizationId: string,
  since: Date
): Promise<{
  auditRuns: number;
  tokensUsed: number;
  graphWrites: number;
  publishes: number;
}> {
  const events = await client.usageEvent.findMany({
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

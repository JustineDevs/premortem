import type { Prisma } from '@prisma/client';
export interface UsageMeterEvent {
    organizationId: string;
    auditRunId?: string;
    projectId?: string;
    eventType: 'audit_run' | 'tokens_in' | 'tokens_out' | 'graph_write' | 'publish';
    quantity: number;
    unit: string;
    metadata?: Record<string, unknown> | null;
}
export declare function recordUsageEvent(input: UsageMeterEvent): Promise<{
    projectId: string | null;
    id: string;
    createdAt: Date;
    auditRunId: string | null;
    organizationId: string;
    metadata: Prisma.JsonValue;
    eventType: string;
    quantity: Prisma.Decimal;
    unit: string;
}>;
export declare function getUsageEventTotalsForOrganization(organizationId: string, since: Date): Promise<{
    auditRuns: number;
    tokensUsed: number;
    graphWrites: number;
    publishes: number;
}>;
//# sourceMappingURL=usage-metering.d.ts.map
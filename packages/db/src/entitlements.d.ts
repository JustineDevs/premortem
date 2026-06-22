import type { OrgPlan } from '@prisma/client';
/** Business-model tier limits (ADR v0.1.0 + Business_model.md). */
export declare const PLAN_LIMITS: Record<OrgPlan, {
    maxRepos: number;
    auditsPerMonth: number;
    canPublish: boolean;
    label: string;
}>;
export declare class EntitlementError extends Error {
    readonly code: 'quota_exceeded' | 'feature_locked' | 'repo_limit';
    readonly status: number;
    constructor(code: EntitlementError['code'], message: string, status?: number);
}
export declare function auditQuotaForPlan(plan: OrgPlan): number;
export declare function getOrganizationEntitlements(organizationId: string): Promise<{
    plan: import("@prisma/client").$Enums.OrgPlan;
    limits: {
        maxRepos: number;
        auditsPerMonth: number;
        canPublish: boolean;
        label: string;
    };
    projectCount: number;
    auditsUsed: number;
    auditLimit: number;
    canPublish: boolean;
}>;
export declare function assertCanRegisterProject(organizationId: string): Promise<void>;
export declare function assertCanRunAudit(organizationId: string): Promise<void>;
export declare function assertCanPublish(organizationId: string): Promise<void>;
export declare function recordAuditSubmitted(organizationId: string): Promise<void>;
export declare function resetMonthlyAuditUsage(): Promise<import("@prisma/client").Prisma.BatchPayload>;
export declare function findActiveAuditRun(input: {
    organizationId: string;
    projectId: string;
    branch: string;
}): Promise<{
    projectId: string;
    branch: string;
    summary: import("@prisma/client/runtime/library").JsonValue;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    commitSha: string | null;
    triggerSource: import("@prisma/client").$Enums.AuditTriggerSource;
    triggeredById: string | null;
    runStatus: import("@prisma/client").$Enums.RunStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    leaseExpiresAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    durationMs: bigint | null;
    graphSnapshotId: string | null;
    errorMessage: string | null;
} | null>;
//# sourceMappingURL=entitlements.d.ts.map
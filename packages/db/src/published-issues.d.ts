import type { Prisma } from '@prisma/client';
export type PublishedIssueOutcomeType = 'true_positive' | 'false_positive' | 'not_applicable' | 'wont_fix';
export interface PublishedIssueAccuracySummary {
    totalPublishedIssues: number;
    classifiedPublishedIssues: number;
    truePositives: number;
    falsePositives: number;
    notApplicable: number;
    wontFix: number;
    precision: number | null;
    coverage: number | null;
}
/** Persist reviewer outcome feedback for a published issue. */
export declare function recordPublishedIssueOutcome(input: {
    organizationId: string;
    projectId: string;
    publishedIssueId: string;
    outcomeType: PublishedIssueOutcomeType;
    outcomeNotes?: string | null;
}): Promise<{
    projectId: string;
    labels: Prisma.JsonValue;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    url: string | null;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    lastSyncedAt: Date | null;
    issueCandidateId: string;
    externalIssueId: string | null;
    externalIssueIid: string | null;
    syncStatus: import("@prisma/client").$Enums.PublishSyncStatus;
    publishedTitle: string;
    publishedBodyMd: string;
    publishedAt: Date | null;
    closedAt: Date | null;
    outcomeType: string | null;
    outcomeNotes: string | null;
    outcomeAt: Date | null;
} | null>;
/** Summarize reviewer outcomes for a project so enterprise accuracy can be displayed. */
export declare function getPublishedIssueAccuracyForProject(input: {
    organizationId: string;
    projectId: string;
}): Promise<PublishedIssueAccuracySummary>;
//# sourceMappingURL=published-issues.d.ts.map
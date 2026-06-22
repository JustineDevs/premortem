/** Persisted audit run states: mirrors Prisma `RunStatus`. */
export const RunStatus = {
    QUEUED: 'queued',
    RUNNING: 'running',
    PARTIAL: 'partial',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    SKIPPED: 'skipped'
};
/** Console audit run badge states (subset of run lifecycle). */
export const ConsoleRunStatus = {
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};
export function runStatusToConsoleRunStatus(runStatus) {
    if (runStatus === RunStatus.COMPLETED)
        return ConsoleRunStatus.COMPLETED;
    if (runStatus === RunStatus.FAILED)
        return ConsoleRunStatus.FAILED;
    if (runStatus === RunStatus.PAUSED || runStatus === RunStatus.PARTIAL) {
        return ConsoleRunStatus.PAUSED;
    }
    return ConsoleRunStatus.RUNNING;
}
/** Persisted project connection states: mirrors Prisma `ProjectStatus`. */
export const ProjectConnectionStatus = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DISCONNECTED: 'disconnected'
};
/** Console project health badge (derived from latest audit, not stored on Project). */
export const ConsoleComplianceStatus = {
    COMPLIANT: 'COMPLIANT',
    WARNING: 'WARNING',
    FAILED: 'FAILED',
    SCANNING: 'SCANNING'
};
export function deriveConsoleCompliance(counts) {
    if (counts.critical > 0 || counts.high > 0) {
        return ConsoleComplianceStatus.FAILED;
    }
    if (counts.medium > 0) {
        return ConsoleComplianceStatus.WARNING;
    }
    return ConsoleComplianceStatus.COMPLIANT;
}
export function scoreFromSeverityCounts(counts) {
    const penalty = counts.critical * 18 + counts.high * 10 + counts.medium * 5 + counts.low * 2;
    return Math.max(12, 100 - penalty);
}
export function scoreFromReviewQueueCounts(reviewableIssueCount, rejectedIssueCount) {
    const penalty = rejectedIssueCount * 8 + reviewableIssueCount * 4;
    return Math.max(20, 100 - penalty);
}

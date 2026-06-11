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
} as const;

export type RunStatusValue = (typeof RunStatus)[keyof typeof RunStatus];

/** Console audit run badge states (subset of run lifecycle). */
export const ConsoleRunStatus = {
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
} as const;

export type ConsoleRunStatusValue =
  (typeof ConsoleRunStatus)[keyof typeof ConsoleRunStatus];

export function runStatusToConsoleRunStatus(runStatus: string): ConsoleRunStatusValue {
  if (runStatus === RunStatus.COMPLETED) return ConsoleRunStatus.COMPLETED;
  if (runStatus === RunStatus.FAILED) return ConsoleRunStatus.FAILED;
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
} as const;

/** Console project health badge (derived from latest audit, not stored on Project). */
export const ConsoleComplianceStatus = {
  COMPLIANT: 'COMPLIANT',
  WARNING: 'WARNING',
  FAILED: 'FAILED',
  SCANNING: 'SCANNING'
} as const;

export type ConsoleComplianceStatusValue =
  (typeof ConsoleComplianceStatus)[keyof typeof ConsoleComplianceStatus];

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function deriveConsoleCompliance(counts: SeverityCounts): ConsoleComplianceStatusValue {
  if (counts.critical > 0 || counts.high > 0) {
    return ConsoleComplianceStatus.FAILED;
  }
  if (counts.medium > 0) {
    return ConsoleComplianceStatus.WARNING;
  }
  return ConsoleComplianceStatus.COMPLIANT;
}

export function scoreFromSeverityCounts(counts: SeverityCounts): number {
  const penalty = counts.critical * 18 + counts.high * 10 + counts.medium * 5 + counts.low * 2;
  return Math.max(12, 100 - penalty);
}

export function scoreFromReviewQueueCounts(reviewableIssueCount: number, rejectedIssueCount: number): number {
  const penalty = rejectedIssueCount * 8 + reviewableIssueCount * 4;
  return Math.max(20, 100 - penalty);
}

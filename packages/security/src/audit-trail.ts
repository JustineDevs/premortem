export type AuditTrailStatus = 'started' | 'passed' | 'blocked' | 'error';

export interface AuditTrailStep {
  runId: string;
  step: string;
  userId: string;
  status: AuditTrailStatus;
  detail?: string;
  timestamp: string;
}

const auditLog: AuditTrailStep[] = [];

export function recordAuditStep(
  runId: string,
  step: string,
  userId: string,
  status: AuditTrailStatus,
  detail?: string
): AuditTrailStep {
  const entry: AuditTrailStep = {
    runId,
    step,
    userId,
    status,
    detail,
    timestamp: new Date().toISOString()
  };
  auditLog.push(entry);
  return entry;
}

export function listAuditSteps(runId: string): AuditTrailStep[] {
  return auditLog.filter((entry) => entry.runId === runId);
}

export function clearAuditStepsForTests(): void {
  auditLog.length = 0;
}

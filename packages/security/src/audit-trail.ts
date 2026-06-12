export type AuditTrailStatus = 'started' | 'passed' | 'blocked' | 'error';

export interface AuditTrailStep {
  runId: string;
  step: string;
  userId: string;
  status: AuditTrailStatus;
  detail?: string;
  timestamp: string;
}

export type AuditTrailPersistFn = (entry: AuditTrailStep) => Promise<void> | void;

const auditLog: AuditTrailStep[] = [];

export async function recordAuditStep(
  runId: string,
  step: string,
  userId: string,
  status: AuditTrailStatus,
  detail?: string,
  persist?: AuditTrailPersistFn
): Promise<AuditTrailStep> {
  const entry: AuditTrailStep = {
    runId,
    step,
    userId,
    status,
    detail,
    timestamp: new Date().toISOString()
  };
  if (process.env.NODE_ENV !== 'production') {
    auditLog.push(entry);
  }
  if (persist) {
    await persist(entry);
  }
  return entry;
}

export function listAuditSteps(runId: string): AuditTrailStep[] {
  if (process.env.NODE_ENV === 'production') return [];
  return auditLog.filter((entry) => entry.runId === runId);
}

export function clearAuditStepsForTests(): void {
  if (process.env.NODE_ENV === 'production') return;
  auditLog.length = 0;
}

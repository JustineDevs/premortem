export interface AuditJob {
  id: string;
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  attempt: number;
  idempotencyKey: string;
}

export interface DeadLetterJob {
  queue: string;
  reason: string;
  payload: Record<string, unknown>;
  failedAt: string;
}

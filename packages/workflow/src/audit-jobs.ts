import type { AuditJob } from './queue-contracts';
import { makeIdempotencyKey } from './idempotency';

export interface CreateAuditJobInput {
  auditRunId: string;
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  attempt?: number;
}

export function buildAuditJob(input: CreateAuditJobInput): AuditJob {
  return {
    id: input.auditRunId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha,
    attempt: input.attempt ?? 0,
    idempotencyKey: makeIdempotencyKey([
      'audit',
      input.organizationId,
      input.projectId,
      input.branch,
      input.commitSha,
      input.auditRunId
    ])
  };
}

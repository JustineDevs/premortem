import type { AuditJob } from './queue-contracts';
import { z } from 'zod';

export const AuditJobSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  branch: z.string(),
  commitSha: z.string().optional(),
  codeSnippet: z.string().optional(),
  mergeRequest: z
    .object({
      iid: z.number(),
      title: z.string().optional(),
      sourceBranch: z.string().optional(),
      targetBranch: z.string().optional(),
      sha: z.string().optional(),
      webUrl: z.string().optional(),
      action: z.string().optional()
    })
    .optional(),
  attempt: z.number(),
  idempotencyKey: z.string()
});

export interface CreateAuditJobInput {
  auditRunId: string;
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  codeSnippet?: string;
  mergeRequest?: {
    iid: number;
    title?: string;
    sourceBranch?: string;
    targetBranch?: string;
    sha?: string;
    webUrl?: string;
    action?: string;
  };
  attempt?: number;
}

export function buildAuditJob(input: CreateAuditJobInput): AuditJob {
  return {
    id: input.auditRunId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    branch: input.branch,
    commitSha: input.commitSha,
    codeSnippet: input.codeSnippet,
    mergeRequest: input.mergeRequest,
    attempt: input.attempt ?? 0,
    idempotencyKey: [
      'audit',
      input.organizationId,
      input.projectId,
      input.branch,
      input.commitSha,
      input.codeSnippet,
      input.mergeRequest?.iid,
      input.mergeRequest?.action,
      input.auditRunId
    ]
      .filter(Boolean)
      .join(':')
  };
}

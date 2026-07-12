export interface AuditJob {
  id: string;
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
  attempt: number;
  idempotencyKey: string;
}

export type { AuditRunSnapshot as RuntimeAuditSnapshot } from '@premortem/orchestrator/read-model';

import type { AuditRunSnapshot } from '@premortem/orchestrator/read-model';
import { getApiBaseUrl } from '@/lib/runtime-config';
import type { Project } from '@/lib/premortem-os/types';

export type RuntimeApiHeaders = Record<string, string>;

export class RuntimeApiError extends Error {
  status: number;
  responseBody: string;

  constructor(path: string, status: number, responseBody: string) {
    super(`API ${path} failed (${status}): ${responseBody}`);
    this.name = 'RuntimeApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

async function apiFetch(path: string, init?: RequestInit, actorHeaders?: RuntimeApiHeaders) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
      ...(actorHeaders ?? {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new RuntimeApiError(path, response.status, text);
  }

  return response.json();
}

export async function fetchRuntimeProjects(actorHeaders?: RuntimeApiHeaders) {
  const payload = await apiFetch('/api/projects', undefined, actorHeaders);
  if (Array.isArray(payload)) return payload as Project[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { projects?: unknown }).projects)) {
    return (payload as { projects: Project[] }).projects;
  }
  return [];
}

export async function fetchRuntimeAudits(limit = 12, actorHeaders?: RuntimeApiHeaders) {
  const payload = (await apiFetch(`/api/audits?limit=${limit}`, undefined, actorHeaders)) as {
    auditRuns: Array<{
      auditRunId: string;
      projectId: string;
      projectName: string;
      branch: string;
      runStatus: string;
      createdAt: string;
      reviewableIssueCount: number;
      rejectedIssueCount: number;
      latestEventType?: string;
    }>;
  };
  return payload.auditRuns;
}

export async function fetchRuntimeAuditSnapshot(
  auditRunId: string,
  actorHeaders?: RuntimeApiHeaders,
  options?: { hydrate?: boolean }
): Promise<AuditRunSnapshot> {
  const hydrateQuery = options?.hydrate === false ? '?hydrate=0' : '';
  const payload = (await apiFetch(`/api/audits/${auditRunId}${hydrateQuery}`, undefined, actorHeaders)) as {
    snapshot?: AuditRunSnapshot;
    auditRun?: AuditRunSnapshot;
  };
  const snapshot = payload.snapshot ?? payload.auditRun;
  if (!snapshot) {
    throw new Error(`Audit ${auditRunId} snapshot payload was empty`);
  }
  return snapshot;
}

export async function submitRuntimeAudit(input: {
  organizationId: string;
  projectId: string;
  branch: string;
  commitSha?: string;
  triggeredById?: string;
  headers?: Record<string, string>;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/audits`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(input.headers ?? {})
    },
    body: JSON.stringify(input),
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Audit submit failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<{ auditRunId: string; runStatus: string }>;
}

export async function approveRuntimeIssue(
  issueCandidateId: string,
  notes?: string,
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/approve`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes })
    },
    actorHeaders
  );
}

export async function rejectRuntimeIssue(
  issueCandidateId: string,
  notes?: string,
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/reject`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes })
    },
    actorHeaders
  );
}

export async function editRuntimeIssue(
  issueCandidateId: string,
  fields: {
    notes?: string;
    title?: string;
    whyItMatters?: string;
    recommendedActionSummary?: string;
    deferred?: boolean;
  },
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/edit`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields)
    },
    actorHeaders
  );
}

export async function publishRuntimeIssue(issueCandidateId: string, actorHeaders?: RuntimeApiHeaders) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/publish`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    },
    actorHeaders
  ) as Promise<{
    ok?: boolean;
    publishedIssue?: { id: string; url?: string | null };
    dryRun?: boolean;
  }>;
}

export async function recordPublishedIssueOutcome(
  publishedIssueId: string,
  input: {
    outcomeType: 'true_positive' | 'false_positive' | 'not_applicable' | 'wont_fix';
    outcomeNotes?: string;
  },
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${publishedIssueId}/outcome`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    },
    actorHeaders
  );
}

export async function fetchProjectAccuracy(projectId: string, actorHeaders?: RuntimeApiHeaders) {
  return apiFetch(`/api/projects/${projectId}/accuracy`, undefined, actorHeaders) as Promise<{
    ok: true;
    accuracy: {
      totalPublishedIssues: number;
      classifiedPublishedIssues: number;
      truePositives: number;
      falsePositives: number;
      notApplicable: number;
      wontFix: number;
      precision: number | null;
      coverage: number | null;
    };
  }>;
}

export async function mergeRuntimeIssue(
  issueCandidateId: string,
  input: { mergedIntoIssueCandidateId: string; notes?: string },
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/merge`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    },
    actorHeaders
  );
}

export async function splitRuntimeIssue(
  issueCandidateId: string,
  fields: { title?: string; notes?: string },
  actorHeaders?: RuntimeApiHeaders
) {
  return apiFetch(
    `/api/issues/${issueCandidateId}/split`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields)
    },
    actorHeaders
  );
}

export async function deferRuntimeIssue(
  issueCandidateId: string,
  notes?: string,
  actorHeaders?: RuntimeApiHeaders
) {
  return editRuntimeIssue(issueCandidateId, { deferred: true, notes }, actorHeaders);
}

export async function pollRuntimeAuditUntilComplete(
  auditRunId: string,
  timeoutMs = 120000,
  actorHeaders?: RuntimeApiHeaders
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await fetchRuntimeAuditSnapshot(auditRunId, actorHeaders, { hydrate: false });
    if (snapshot.runStatus === 'completed') return snapshot;
    if (snapshot.runStatus === 'failed') {
      throw new Error(`Audit ${auditRunId} failed`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for audit ${auditRunId}`);
}

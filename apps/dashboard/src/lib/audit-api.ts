import type { AuditRunListItem, AuditRunSnapshot } from '@premortem/orchestrator';

export interface AuditApiClientOptions {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
}

export async function loadAuditRunSnapshot(
  auditRunId: string,
  options: AuditApiClientOptions = {}
): Promise<AuditRunSnapshot> {
  const baseUrl = options.apiBaseUrl ?? 'http://127.0.0.1:18787';
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/audits/${auditRunId}`, {
    method: 'GET',
    headers: { accept: 'application/json', ...(options.headers ?? {}) },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to load audit ${auditRunId}: ${response.status}`);
  }

  const payload = (await response.json()) as { auditRun: AuditRunSnapshot };
  return payload.auditRun;
}

export async function loadRecentAuditRuns(
  options: AuditApiClientOptions & { limit?: number } = {}
): Promise<AuditRunListItem[]> {
  const baseUrl = options.apiBaseUrl ?? 'http://127.0.0.1:18787';
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 12;
  const response = await fetchImpl(`${baseUrl}/api/audits?limit=${limit}`, {
    method: 'GET',
    headers: { accept: 'application/json', ...(options.headers ?? {}) },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to load recent audits: ${response.status}`);
  }

  const payload = (await response.json()) as { auditRuns: AuditRunListItem[] };
  return payload.auditRuns;
}

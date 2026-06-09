import { getAuditRunSnapshot, getRecentAuditRuns, submitAudit } from '@premortem/orchestrator';
import type { AppEnv } from '../lib/types';

export async function handleAuditCreate(request: Request, env: AppEnv = {}) {
  if (!env.AUDIT_QUEUE) {
    return Response.json(
      { error: 'AUDIT_QUEUE binding is required for queued audit delivery.' },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    organizationId: string;
    projectId: string;
    branch: string;
    commitSha?: string;
    triggeredById?: string;
  };

  const result = await submitAudit({
    organizationId: body.organizationId,
    projectId: body.projectId,
    branch: body.branch,
    commitSha: body.commitSha,
    triggeredById: body.triggeredById
  });

  await env.AUDIT_QUEUE.send(result.job);

  return Response.json(result, { status: 202 });
}

export async function handleAuditRead(auditRunId: string) {
  const auditRun = await getAuditRunSnapshot(auditRunId);
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  return Response.json({ auditRun });
}

export async function handleAuditList(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 12;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 12;
  const auditRuns = await getRecentAuditRuns(limit);
  return Response.json({ auditRuns });
}

import { EntitlementError, AuditReadinessError, cancelAuditRun, pauseAuditRun } from '@premortem/db';
import { getAuditRunSnapshot, getRecentAuditRuns, resumeAudit, submitAudit } from '@premortem/orchestrator';

import { resolveApiActorContext } from '../lib/request-context';
import type { AppEnv } from '../lib/types';

export async function handleAuditCreate(request: Request, env: AppEnv = {}) {
  if (!env.AUDIT_QUEUE) {
    return Response.json(
      { error: 'AUDIT_QUEUE binding is required for queued audit delivery.' },
      { status: 500 }
    );
  }

  const actor = await resolveApiActorContext(request);
  const body = (await request.json()) as {
    organizationId?: string;
    projectId: string;
    branch: string;
    commitSha?: string;
    triggeredById?: string;
  };

  const organizationId = body.organizationId ?? actor.organizationId;

  try {
    const result = await submitAudit({
      organizationId,
      projectId: body.projectId,
      branch: body.branch,
      commitSha: body.commitSha,
      triggeredById: body.triggeredById ?? actor.profileId
    });

    if (!result.reusedActiveRun) {
      await env.AUDIT_QUEUE.send(result.job);
    }

    return Response.json(result, { status: result.reusedActiveRun ? 200 : 202 });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AuditReadinessError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          field: error.field,
          system: error.system
        },
        { status: 422 }
      );
    }
    throw error;
  }
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

export async function handleAuditCancel(auditRunId: string) {
  try {
    const auditRun = await cancelAuditRun(auditRunId);
    return Response.json({ ok: true, auditRun });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel audit run' },
      { status: 400 }
    );
  }
}

export async function handleAuditPause(auditRunId: string) {
  try {
    const auditRun = await pauseAuditRun(auditRunId);
    return Response.json({ ok: true, auditRun });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to pause audit run' },
      { status: 400 }
    );
  }
}

export async function handleAuditResume(auditRunId: string, env: AppEnv = {}) {
  if (!env.AUDIT_QUEUE) {
    return Response.json(
      { error: 'AUDIT_QUEUE binding is required for queued audit delivery.' },
      { status: 500 }
    );
  }

  try {
    const { auditRun, job } = await resumeAudit(auditRunId);
    await env.AUDIT_QUEUE.send(job);
    return Response.json({ ok: true, auditRun, job }, { status: 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to resume audit run' },
      { status: 400 }
    );
  }
}

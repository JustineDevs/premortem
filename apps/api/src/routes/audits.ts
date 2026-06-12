import {
  AuditReadinessError,
  EntitlementError,
  cancelAuditRun,
  pauseAuditRun,
  recordActivityEvent
} from '@premortem/db';
import { recordUsageEvent } from '@premortem/db';
import { fetchPhoenixSemanticGraphForAudit } from '@premortem/observability';
import { downloadArtifact } from '@premortem/storage';
import {
  getAuditRunSnapshot,
  getRecentAuditRuns,
  resolveGraphSnapshotPayload,
  resumeAudit,
  submitAudit
} from '@premortem/orchestrator';

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

  if (body.organizationId && body.organizationId !== actor.organizationId) {
    return Response.json({ error: 'organizationId is not allowed for this session.' }, { status: 403 });
  }
  const organizationId = actor.organizationId;

  try {
    const result = await submitAudit({
      organizationId,
      projectId: body.projectId,
      branch: body.branch,
      commitSha: body.commitSha,
      triggeredById: body.triggeredById ?? actor.profileId,
      triggerSource: 'api'
    });

    if (!result.reusedActiveRun) {
      await env.AUDIT_QUEUE.send(result.job);
    }

    await recordActivityEvent({
      organizationId,
      actorId: actor.profileId,
      eventType: 'audit.submitted',
      objectType: 'audit_run',
      objectId: result.auditRunId,
      projectId: body.projectId,
      summary: `Queued audit for branch ${body.branch} on project ${body.projectId}`
    });
    await recordUsageEvent({
      organizationId,
      projectId: body.projectId,
      auditRunId: result.auditRunId,
      eventType: 'audit_run',
      quantity: 1,
      unit: 'run',
      metadata: { triggerSource: 'api', branch: body.branch }
    });

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

async function resolveAuthorizedAuditRun(request: Request, auditRunId: string) {
  const actor = await resolveApiActorContext(request);
  const auditRun = await getAuditRunSnapshot(auditRunId);
  if (!auditRun || auditRun.organizationId !== actor.organizationId) {
    return null;
  }
  return auditRun;
}

export async function handleAuditRead(request: Request, auditRunId: string) {
  const auditRun = await resolveAuthorizedAuditRun(request, auditRunId);
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  return Response.json({
    auditRun,
    snapshot: auditRun
  });
}

export async function handleAuditGraphRead(request: Request, auditRunId: string) {
  const auditRun = await resolveAuthorizedAuditRun(request, auditRunId);
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  if (!auditRun.graphSnapshot) {
    return Response.json({ error: 'Graph snapshot not found for this audit run' }, { status: 404 });
  }

  const graphSnapshot = auditRun.graphSnapshot;
  const payload = await resolveGraphSnapshotPayload({
    auditRunId,
    projectId: auditRun.projectId,
    storageRef: graphSnapshot.storageRef,
    metadata: graphSnapshot.metadata as Record<string, unknown>,
    payload: graphSnapshot.payload,
    download: downloadArtifact
  });

  if (!payload) {
    return Response.json(
      { error: 'Graph artifact payload unavailable for this audit run' },
      { status: 404 }
    );
  }

  return Response.json({
    auditRunId,
    storageRef: graphSnapshot.storageRef,
    nodeCount: graphSnapshot.nodeCount,
    edgeCount: graphSnapshot.edgeCount,
    payload,
    source: graphSnapshot.storageRef?.startsWith('neo4j://')
      ? 'neo4j'
      : graphSnapshot.storageRef?.startsWith('supabase://')
        ? 'storage'
        : 'inline-or-metadata'
  });
}

export async function handleAuditSemanticGraphRead(request: Request, auditRunId: string) {
  const auditRun = await resolveAuthorizedAuditRun(request, auditRunId);
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  const eventTimes = auditRun.events.map((event) => event.createdAt).filter(Boolean);
  const agentStartTimes = auditRun.agentRuns
    .map((run) => run.startedAt)
    .filter((value): value is string => Boolean(value));
  const agentEndTimes = auditRun.agentRuns
    .map((run) => run.completedAt)
    .filter((value): value is string => Boolean(value));

  const startedAt = agentStartTimes[0] ?? eventTimes[0] ?? null;
  const completedAt = agentEndTimes.sort().at(-1) ?? eventTimes.sort().at(-1) ?? null;

  const payload = await fetchPhoenixSemanticGraphForAudit({
    auditRunId,
    startedAt,
    completedAt
  });

  return Response.json(payload);
}

export async function handleAuditList(request: Request) {
  const actor = await resolveApiActorContext(request);
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 12;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 12;
  const auditRuns = await getRecentAuditRuns(actor.organizationId, limit);
  return Response.json({ auditRuns });
}

export async function handleAuditCancel(request: Request, auditRunId: string) {
  try {
    const actor = await resolveApiActorContext(request);
    const auditRun = await cancelAuditRun(auditRunId);
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'audit.cancelled',
      objectType: 'audit_run',
      objectId: auditRunId,
      projectId: auditRun.projectId,
      summary: `Cancelled audit ${auditRunId}`
    });
    return Response.json({ ok: true, auditRun });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel audit run' },
      { status: 400 }
    );
  }
}

export async function handleAuditPause(request: Request, auditRunId: string) {
  try {
    const actor = await resolveApiActorContext(request);
    const auditRun = await pauseAuditRun(auditRunId);
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'audit.paused',
      objectType: 'audit_run',
      objectId: auditRunId,
      projectId: auditRun.projectId,
      summary: `Paused audit ${auditRunId}`
    });
    return Response.json({ ok: true, auditRun });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to pause audit run' },
      { status: 400 }
    );
  }
}

export async function handleAuditResume(request: Request, auditRunId: string, env: AppEnv = {}) {
  if (!env.AUDIT_QUEUE) {
    return Response.json(
      { error: 'AUDIT_QUEUE binding is required for queued audit delivery.' },
      { status: 500 }
    );
  }

  try {
    const actor = await resolveApiActorContext(request);
    const { auditRun, job } = await resumeAudit(auditRunId);
    await env.AUDIT_QUEUE.send(job);
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'audit.resumed',
      objectType: 'audit_run',
      objectId: auditRunId,
      projectId: auditRun.projectId,
      summary: `Resumed audit ${auditRunId}`
    });
    return Response.json({ ok: true, auditRun, job }, { status: 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to resume audit run' },
      { status: 400 }
    );
  }
}

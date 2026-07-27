import {
  AuditReadinessError,
  EntitlementError,
  cancelAuditRun,
  prisma,
  pauseAuditRun,
  recordActivityEvent
} from '@premortem/db';
import { canonicalFindingsToSarifLog } from '@premortem/agent-kit';
import { recordUsageEvent } from '@premortem/db';
import { fetchPhoenixSemanticGraphForAudit } from '@premortem/observability/phoenix-semantic-graph';
import { captureServerException } from '@premortem/observability';
import { getAuditRunSnapshot, getRecentAuditRuns, resolveGraphSnapshotPayload } from '@premortem/orchestrator/read-model';

import { apiErrorResponse } from '../lib/error-response.js';
import { ORG_WRITE_ROLES, requireApiRole } from '../lib/authorization.js';
import { readJsonRecord, readOptionalString, readRequiredString } from '../lib/request-body.js';
import { resolveApiActorContext } from '../lib/request-context.js';
import type { AppEnv } from '../lib/types.js';

export async function handleAuditCreate(request: Request, env: AppEnv = {}) {
  if (!env.AUDIT_QUEUE) {
    return Response.json(
      { error: 'AUDIT_QUEUE binding is required for queued audit delivery.' },
      { status: 500 }
    );
  }

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_WRITE_ROLES);
  const body = (await readJsonRecord(request)) ?? {};
  const projectId = readRequiredString(body, 'projectId');
  const branch = readRequiredString(body, 'branch');
  const commitSha = readOptionalString(body, 'commitSha');
  const scanCodeSnippet = readOptionalString(body, 'scanCodeSnippet');
  const triggeredById = readOptionalString(body, 'triggeredById');

  if (!projectId) {
    return Response.json({ error: 'projectId is required' }, { status: 400 });
  }

  if (!branch) {
    return Response.json({ error: 'branch is required' }, { status: 400 });
  }

  const resolvedOrganizationId = actor.organizationId;

  try {
    const { submitAudit } = await import('@premortem/orchestrator');
    const result = await submitAudit({
      organizationId: resolvedOrganizationId,
      projectId,
      branch,
      commitSha: commitSha ?? undefined,
      scanCodeSnippet: scanCodeSnippet ?? undefined,
      triggeredById: triggeredById ?? actor.profileId,
      triggerSource: 'api'
    });

    if (!result.reusedActiveRun) {
      await env.AUDIT_QUEUE.send(result.job);
    }

    await recordActivityEvent({
      organizationId: resolvedOrganizationId,
      actorId: actor.profileId,
      eventType: 'audit.submitted',
      objectType: 'audit_run',
      objectId: result.auditRunId,
      projectId,
      summary: `Queued audit for branch ${branch} on project ${projectId}`
    });
    await recordUsageEvent({
      organizationId: resolvedOrganizationId,
      projectId,
      auditRunId: result.auditRunId,
      eventType: 'audit_run',
      quantity: 1,
      unit: 'run',
      metadata: { triggerSource: 'api', branch }
    });

    return Response.json(result, { status: result.reusedActiveRun ? 200 : 202 });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        { error: 'Monthly audit quota reached.', code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof AuditReadinessError) {
      return Response.json(
        {
          error: 'Audit target is not ready.',
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

async function resolveAuthorizedAuditRun(
  request: Request,
  auditRunId: string,
  options?: {
    includeEvidenceSnippets?: boolean;
    includeGraphPayload?: boolean;
  }
) {
  const actor = await resolveApiActorContext(request);
  if (
    typeof auditRunId !== 'string' ||
    auditRunId.length === 0 ||
    auditRunId === 'null' ||
    auditRunId === 'undefined'
  ) {
    return null;
  }
  const access = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { organizationId: true }
  });

  if (!access || access.organizationId !== actor.organizationId) {
    return null;
  }

  const auditRun = await getAuditRunSnapshot(auditRunId, options);
  if (!auditRun) {
    return null;
  }
  return auditRun;
}

export async function handleAuditRead(request: Request, auditRunId: string) {
  const url = new URL(request.url);
  const hydrate = url.searchParams.get('hydrate');
  const includeHydration = hydrate !== '0' && hydrate !== 'false';
  const auditRun = await resolveAuthorizedAuditRun(request, auditRunId, {
    includeEvidenceSnippets: includeHydration,
    includeGraphPayload: includeHydration
  });
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  return Response.json({ snapshot: auditRun });
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
    metadata: graphSnapshot.metadata as Record<string, unknown>,
    payload: graphSnapshot.payload,
    storageRef: graphSnapshot.storageRef
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
    source: graphSnapshot.storageRef?.startsWith('neo4j://') ? 'neo4j' : 'inline-or-metadata'
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

  try {
    const payload = await fetchPhoenixSemanticGraphForAudit({
      auditRunId,
      startedAt,
      completedAt
    });

    return Response.json(payload);
  } catch (error) {
    captureServerException(error, {
      surface: 'audit.semantic-graph',
      auditRunId,
      organizationId: auditRun.organizationId,
      projectId: auditRun.projectId
    });

    const fallbackNodes = [
      ...auditRun.agentRuns.map((run) => ({
        id: `agent:${run.id}`,
        label: run.agentName,
        kind: 'agent',
        spanKind: run.status ?? undefined,
        status: run.status
      })),
      ...auditRun.findings.map((finding) => ({
        id: `finding:${finding.id}`,
        label: finding.findingKey,
        kind: 'finding',
        spanKind: finding.severity,
        status: finding.severity
      })),
      ...auditRun.events.map((event, index) => ({
        id: `event:${index}`,
        label: event.eventType,
        kind: 'event',
        spanKind: event.eventType,
        status: event.eventType
      }))
    ];

    const fallbackEdges = [
      ...auditRun.agentRuns.map((run) => ({
        from: `audit:${auditRun.auditRunId}`,
        to: `agent:${run.id}`,
        type: 'runs'
      })),
      ...auditRun.findings
        .filter((finding) => finding.agentRunId)
        .map((finding) => ({
          from: `agent:${finding.agentRunId}`,
          to: `finding:${finding.id}`,
          type: 'produces'
        })),
      ...auditRun.events.map((event, index) => ({
        from: `audit:${auditRun.auditRunId}`,
        to: `event:${index}`,
        type: 'event'
      }))
    ];

    return Response.json({
      configured: false,
      auditRunId,
      traceIds: [],
      nodes: fallbackNodes,
      edges: fallbackEdges,
      source: 'unconfigured',
      warning:
        error instanceof Error ? error.message : 'Phoenix semantic graph unavailable; returned audit-derived fallback graph.'
    });
  }
}

export async function handleAuditSarifRead(request: Request, auditRunId: string) {
  const auditRun = await resolveAuthorizedAuditRun(request, auditRunId);
  if (!auditRun) {
    return Response.json({ error: 'Audit run not found' }, { status: 404 });
  }

  const agentNameByRunId = new Map(auditRun.agentRuns.map((run) => [run.id, run.agentName] as const));
  const findings = auditRun.findings.map((finding) => ({
    agent: agentNameByRunId.get(finding.agentRunId) ?? 'premortem-agent',
    finding_id: finding.findingKey,
    category: finding.category,
    finding_type: `${finding.category}_risk`,
    severity: finding.severity as 'low' | 'medium' | 'high' | 'critical',
    confidence: 0.7,
    predicted_failure: {
      summary: finding.predictedFailureSummary,
      failure_mode: finding.failureMode ?? finding.predictedFailureSummary,
      trigger_conditions: finding.triggerConditions ?? [],
      blast_radius: 'component' as const
    },
    why_it_matters: finding.whyItMatters ?? finding.predictedFailureSummary,
    affected_assets: finding.affectedAssets ?? [],
    evidence: (finding.evidence ?? []).map((entry) => ({
      kind: entry.kind,
      ref: entry.ref,
      reason: entry.reason,
      ...(entry.codeSnippet ? { codeSnippet: entry.codeSnippet } : {})
    })),
    recommended_controls: finding.recommendedControls ?? [],
    dedupe_keys: [finding.category, finding.findingKey],
    tags: []
  }));

  return Response.json(
    canonicalFindingsToSarifLog(findings, {
      toolName: 'Premortem',
      informationUri: `${new URL(request.url).origin}/app?tab=audits&audit=${auditRunId}`
    }),
    {
      headers: {
        'content-type': 'application/sarif+json; charset=utf-8'
      }
    }
  );
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
    requireApiRole(actor, ORG_WRITE_ROLES);
    const auditRun = await resolveAuthorizedAuditRun(request, auditRunId, {
      includeEvidenceSnippets: false,
      includeGraphPayload: false
    });
    if (!auditRun) {
      return Response.json({ error: 'Audit run not found' }, { status: 404 });
    }
    const cancelled = await cancelAuditRun(auditRunId);
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'audit.cancelled',
      objectType: 'audit_run',
      objectId: auditRunId,
      projectId: auditRun.projectId,
      summary: `Cancelled audit ${auditRunId}`
    });
    return Response.json({ ok: true, auditRun: cancelled });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to cancel audit run', { fallbackStatus: 400 });
  }
}

export async function handleAuditPause(request: Request, auditRunId: string) {
  try {
    const actor = await resolveApiActorContext(request);
    requireApiRole(actor, ORG_WRITE_ROLES);
    const auditRun = await resolveAuthorizedAuditRun(request, auditRunId, {
      includeEvidenceSnippets: false,
      includeGraphPayload: false
    });
    if (!auditRun) {
      return Response.json({ error: 'Audit run not found' }, { status: 404 });
    }
    const paused = await pauseAuditRun(auditRunId);
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'audit.paused',
      objectType: 'audit_run',
      objectId: auditRunId,
      projectId: paused.projectId,
      summary: `Paused audit ${auditRunId}`
    });
    return Response.json({ ok: true, auditRun: paused });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to pause audit run', { fallbackStatus: 400 });
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
    requireApiRole(actor, ORG_WRITE_ROLES);
    const auditRun = await resolveAuthorizedAuditRun(request, auditRunId, {
      includeEvidenceSnippets: false,
      includeGraphPayload: false
    });
    if (!auditRun) {
      return Response.json({ error: 'Audit run not found' }, { status: 404 });
    }
    const { resumeAudit } = await import('@premortem/orchestrator');
    const { job } = await resumeAudit(auditRunId);
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
    return apiErrorResponse(error, 'Failed to resume audit run', { fallbackStatus: 400 });
  }
}

import {
  AuditCheckpointPhase,
  AuditEvent,
  parseAuditCheckpoint,
  type AuditCheckpoint,
  type AuditCheckpointPhaseValue
} from '@premortem/domain';
import type { Prisma } from '@prisma/client';

import { prisma } from './client';
import { createAuditRunEvent, invalidateRecentAuditRunsCache } from './repositories';

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const RECONCILIATION_EVENTS_CACHE_TTL_MS = 120_000;
const reconciliationEventsCache = new Map<
  string,
  {
    expiresAt: number;
    promise?: Promise<Awaited<ReturnType<typeof prisma.reconciliationEvent.findMany>>>;
    value?: Awaited<ReturnType<typeof prisma.reconciliationEvent.findMany>>;
  }
>();

function asSummaryObject(summary: unknown): Record<string, unknown> {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return {};
  }
  return { ...(summary as Record<string, unknown>) };
}

function mergeAuditSummary(
  summary: unknown,
  patch: Record<string, unknown>
): Prisma.JsonObject {
  return { ...asSummaryObject(summary), ...patch } as Prisma.JsonObject;
}

function inferCheckpointPhase(input: {
  runStatus: string;
  agentRuns: Array<{ agentName: string; status: string }>;
  graphSnapshotId?: string | null;
  hasIngestionEvent: boolean;
  hasGraphEvent: boolean;
  clusterCount: number;
  issueCandidateCount: number;
}): AuditCheckpointPhaseValue {
  if (input.issueCandidateCount > 0) {
    return AuditCheckpointPhase.VALIDATION;
  }

  const completedSpecialists = input.agentRuns.filter((run) => run.status === 'completed');
  const synthesizerDone = completedSpecialists.some(
    (run) => run.agentName === 'finding_synthesizer_agent'
  );
  if (synthesizerDone) {
    return AuditCheckpointPhase.SYNTHESIS;
  }

  if (input.clusterCount > 0) {
    return AuditCheckpointPhase.CLUSTERING;
  }

  if (completedSpecialists.length > 0) {
    return AuditCheckpointPhase.SPECIALISTS;
  }

  if (input.hasGraphEvent || input.graphSnapshotId) {
    return AuditCheckpointPhase.GRAPH;
  }

  if (input.hasIngestionEvent) {
    return AuditCheckpointPhase.INGESTION;
  }

  if (input.runStatus === 'queued') {
    return AuditCheckpointPhase.QUEUED;
  }

  return AuditCheckpointPhase.INGESTION;
}

export async function inferCheckpointFromAuditRun(auditRunId: string): Promise<AuditCheckpoint> {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    include: {
      agentRuns: { select: { agentName: true, status: true } },
      graphSnapshot: { select: { id: true } },
      events: { select: { eventType: true } },
      _count: {
        select: {
          dedupeClusters: true,
          issueCandidates: true,
          findings: true
        }
      }
    }
  });

  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  const existing = parseAuditCheckpoint(auditRun.summary);
  const completedSpecialists = auditRun.agentRuns
    .filter((run) => run.status === 'completed')
    .map((run) => run.agentName);

  const phase =
    existing?.phase ??
    inferCheckpointPhase({
      runStatus: auditRun.runStatus,
      agentRuns: auditRun.agentRuns,
      graphSnapshotId: auditRun.graphSnapshot?.id ?? null,
      hasIngestionEvent: auditRun.events.some(
        (event) => event.eventType === AuditEvent.INGESTION_COMPLETED
      ),
      hasGraphEvent: auditRun.events.some((event) => event.eventType === AuditEvent.GRAPH_BUILT),
      clusterCount: auditRun._count.dedupeClusters,
      issueCandidateCount: auditRun._count.issueCandidates
    });

  return {
    phase,
    completedSpecialists:
      completedSpecialists.length > 0
        ? completedSpecialists
        : (existing?.completedSpecialists ?? []),
    findingCount: Math.max(existing?.findingCount ?? 0, auditRun._count.findings),
    clusterCount: Math.max(existing?.clusterCount ?? 0, auditRun._count.dedupeClusters),
    graphSnapshotId: auditRun.graphSnapshot?.id ?? existing?.graphSnapshotId ?? null,
    savedAt: new Date().toISOString()
  };
}

export async function saveAuditCheckpoint(
  auditRunId: string,
  checkpoint: AuditCheckpoint,
  reason?: string
) {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { summary: true }
  });
  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  const payload: AuditCheckpoint = {
    ...checkpoint,
    savedAt: new Date().toISOString(),
    reason: reason ?? checkpoint.reason
  };

  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      summary: mergeAuditSummary(auditRun.summary, { checkpoint: payload })
    }
  });

  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.CHECKPOINT_SAVED,
    payload: {
      phase: payload.phase,
      completedSpecialists: payload.completedSpecialists,
      findingCount: payload.findingCount,
      clusterCount: payload.clusterCount
    }
  });

  return payload;
}

export async function getAuditRunControlState(auditRunId: string) {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { runStatus: true, summary: true, cancelReason: true }
  });

  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  return {
    runStatus: auditRun.runStatus,
    summary: auditRun.summary,
    checkpoint: parseAuditCheckpoint(auditRun.summary),
    cancelReason: auditRun.cancelReason
  };
}

export async function extendAuditLease(auditRunId: string, leaseMs = DEFAULT_LEASE_MS) {
  const leaseExpiresAt = new Date(Date.now() + leaseMs);
  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { leaseExpiresAt }
  });
  return leaseExpiresAt;
}

export async function pauseAuditRun(auditRunId: string, reason = 'Paused by operator') {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { runStatus: true, summary: true }
  });

  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  if (
    auditRun.runStatus === 'completed' ||
    auditRun.runStatus === 'failed' ||
    auditRun.runStatus === 'cancelled'
  ) {
    throw new Error('Audit run has already finished');
  }

  if (auditRun.runStatus === 'paused') {
    return prisma.auditRun.findUniqueOrThrow({ where: { id: auditRunId } });
  }

  const checkpoint = await inferCheckpointFromAuditRun(auditRunId);
  checkpoint.reason = reason;

  const updated = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      runStatus: 'paused',
      summary: mergeAuditSummary(auditRun.summary, {
        checkpoint,
        pauseReason: reason,
        pausedAt: new Date().toISOString()
      })
    }
  });

  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.PAUSED,
    payload: { reason, phase: checkpoint.phase }
  });

  return updated;
}

export async function resumeAuditRun(auditRunId: string) {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { runStatus: true, summary: true }
  });

  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  if (auditRun.runStatus !== 'paused') {
    throw new Error('Audit run is not paused');
  }

  const checkpoint = parseAuditCheckpoint(auditRun.summary);
  if (!checkpoint) {
    throw new Error('Cannot resume audit run without a checkpoint');
  }

  const updated = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      runStatus: 'queued',
      summary: mergeAuditSummary(auditRun.summary, {
        pauseReason: null,
        resumedAt: new Date().toISOString()
      })
    }
  });

  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.RESUMED,
    payload: { phase: checkpoint.phase }
  });

  return updated;
}

export async function cancelAuditRun(auditRunId: string, reason = 'Cancelled by reviewer') {
  const auditRun = await prisma.auditRun.findUnique({ where: { id: auditRunId } });
  if (!auditRun) {
    throw new Error('Audit run not found');
  }

  if (auditRun.runStatus === 'completed' || auditRun.runStatus === 'failed') {
    throw new Error('Audit run has already finished');
  }

  if (auditRun.runStatus === 'cancelled') {
    return auditRun;
  }

  const updated = await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      runStatus: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason,
      completedAt: new Date()
    }
  });

  await createAuditRunEvent({
    auditRunId,
    eventType: AuditEvent.CANCELLED,
    payload: { reason }
  });

  invalidateRecentAuditRunsCache(auditRun.organizationId);

  return updated;
}

export async function isAuditLeaseExpired(auditRunId: string) {
  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: { leaseExpiresAt: true, runStatus: true }
  });

  if (!auditRun?.leaseExpiresAt) return false;
  if (
    auditRun.runStatus !== 'running' &&
    auditRun.runStatus !== 'queued' &&
    auditRun.runStatus !== 'paused'
  ) {
    return false;
  }
  return auditRun.leaseExpiresAt.getTime() < Date.now();
}

export async function createReconciliationEvent(input: {
  organizationId: string;
  publishedIssueId: string;
  status: 'matched' | 'drifted' | 'failed';
  driftFields?: string[];
  localSnapshot?: Record<string, unknown>;
  remoteSnapshot?: Record<string, unknown>;
  errorMessage?: string;
}) {
  return prisma.reconciliationEvent.create({
    data: {
      organizationId: input.organizationId,
      publishedIssueId: input.publishedIssueId,
      status: input.status,
      driftFields: input.driftFields ?? [],
      localSnapshot: (input.localSnapshot ?? {}) as Prisma.InputJsonValue,
      remoteSnapshot: (input.remoteSnapshot ?? {}) as Prisma.InputJsonValue,
      errorMessage: input.errorMessage
    }
  });
}

export async function listReconciliationEvents(organizationId: string, limit = 20) {
  const cacheKey = `${organizationId}:${limit}`;
  const cached = reconciliationEventsCache.get(cacheKey);
  const now = Date.now();
  if (cached?.value && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = prisma.reconciliationEvent
    .findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        publishedIssue: {
          select: {
            id: true,
            url: true,
            publishedTitle: true,
            syncStatus: true,
            externalIssueIid: true
          }
        }
      }
    })
    .then((events) => {
      reconciliationEventsCache.set(cacheKey, {
        expiresAt: Date.now() + RECONCILIATION_EVENTS_CACHE_TTL_MS,
        value: events
      });
      return events;
    })
    .finally(() => {
      const current = reconciliationEventsCache.get(cacheKey);
      if (current?.promise === promise) {
        delete current.promise;
      }
    });

  reconciliationEventsCache.set(cacheKey, { expiresAt: 0, promise });
  return promise;
}

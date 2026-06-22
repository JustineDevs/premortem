import { AuditCheckpointPhase, parseAuditCheckpoint, phaseRank, type AuditCheckpoint } from '@premortem/domain';

export const AUDIT_PIPELINE_STEPS = [
  'Ingest Context',
  'Specialist Swarm',
  'Graph Merge',
  'Finding Synthesis',
  'Issue Validation',
  'Publish Ready'
] as const;

const AUDIT_PIPELINE_PHASE_BY_STEP: Array<AuditCheckpoint['phase']> = [
  AuditCheckpointPhase.INGESTION,
  AuditCheckpointPhase.GRAPH,
  AuditCheckpointPhase.SPECIALISTS,
  AuditCheckpointPhase.CLUSTERING,
  AuditCheckpointPhase.SYNTHESIS,
  AuditCheckpointPhase.VALIDATION
] as const;

function resolveStepFromCheckpoint(checkpoint: AuditCheckpoint | null) {
  if (!checkpoint) return null;

  const phase = checkpoint.phase;
  if (phase === AuditCheckpointPhase.FINISHED) {
    return AUDIT_PIPELINE_STEPS.length - 1;
  }

  const mappedIndex = AUDIT_PIPELINE_PHASE_BY_STEP.findIndex((candidate) => candidate === phase);
  if (mappedIndex >= 0) {
    return mappedIndex;
  }

  return Math.min(phaseRank(phase), AUDIT_PIPELINE_STEPS.length - 1);
}

export function derivePipelineProgress(input: {
  auditStatus: string;
  agentRuns: Array<{ status: string }>;
  summary?: unknown;
}): { activeStepIndex: number; animating: boolean } {
  const checkpoint = parseAuditCheckpoint(input.summary);
  const total = input.agentRuns.length;
  const completed = input.agentRuns.filter((run) => run.status === 'completed').length;
  const failed = input.agentRuns.filter((run) => run.status === 'failed').length;
  const animating = input.auditStatus === 'RUNNING';

  if (checkpoint) {
    return {
      activeStepIndex: Math.max(0, resolveStepFromCheckpoint(checkpoint) ?? 0),
      animating: input.auditStatus === 'RUNNING' && checkpoint.phase !== AuditCheckpointPhase.FINISHED
    };
  }

  if (input.auditStatus === 'COMPLETED') {
    return { activeStepIndex: AUDIT_PIPELINE_STEPS.length - 1, animating: false };
  }

  if (input.auditStatus === 'FAILED') {
    return { activeStepIndex: Math.min(completed, AUDIT_PIPELINE_STEPS.length - 2), animating: false };
  }

  if (total === 0) {
    return {
      activeStepIndex: 0,
      animating: input.auditStatus === 'PAUSED' ? false : animating
    };
  }

  const ratio = (completed + failed) / total;
  const activeStepIndex = Math.min(
    AUDIT_PIPELINE_STEPS.length - 2,
    Math.max(1, Math.floor(ratio * (AUDIT_PIPELINE_STEPS.length - 2)))
  );

  if (input.auditStatus === 'PAUSED') {
    return { activeStepIndex, animating: false };
  }

  return { activeStepIndex, animating };
}

export function buildConsoleLogLines(input: {
  events: Array<{ eventType: string; actor: string; createdAt: string }>;
  agentRuns: Array<{ agentName: string; status: string; startedAt?: string | null }>;
  summary?: unknown;
}): Array<{ time: string; msg: string }> {
  const lines: Array<{ time: string; msg: string }> = [];
  const checkpoint = parseAuditCheckpoint(input.summary);

  if (checkpoint) {
    lines.push({
      time: checkpoint.savedAt,
      msg: `checkpoint · ${checkpoint.phase} · ${checkpoint.completedSpecialists.length} specialists · ${checkpoint.findingCount} findings`
    });

    if (typeof checkpoint.clusterCount === 'number') {
      lines.push({
        time: checkpoint.savedAt,
        msg: `clusters · ${checkpoint.clusterCount} · graph ${checkpoint.graphSnapshotId ?? 'inline'}`
      });
    }
  }

  for (const run of input.agentRuns) {
    if (run.startedAt) {
      lines.push({
        time: new Date(run.startedAt).toLocaleTimeString(),
        msg: `${run.agentName} → ${run.status}`
      });
    }
  }

  for (const event of input.events.slice(0, 16)) {
    lines.push({
      time: new Date(event.createdAt).toLocaleTimeString(),
      msg: `${event.eventType} · ${event.actor}`
    });
  }

  return lines.slice(-20);
}

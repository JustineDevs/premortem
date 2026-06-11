/** Pipeline phases where audit execution can stop and resume. */
export const AuditCheckpointPhase = {
  QUEUED: 'queued',
  INGESTION: 'ingestion',
  GRAPH: 'graph',
  SPECIALISTS: 'specialists',
  CLUSTERING: 'clustering',
  SYNTHESIS: 'synthesis',
  VALIDATION: 'validation',
  FINISHED: 'finished'
} as const;

export type AuditCheckpointPhaseValue =
  (typeof AuditCheckpointPhase)[keyof typeof AuditCheckpointPhase];

export interface AuditCheckpoint {
  phase: AuditCheckpointPhaseValue;
  completedSpecialists: string[];
  findingCount: number;
  clusterCount: number;
  graphSnapshotId?: string | null;
  savedAt: string;
  reason?: string;
}

export function parseAuditCheckpoint(summary: unknown): AuditCheckpoint | null {
  if (!summary || typeof summary !== 'object') return null;
  const checkpoint = (summary as Record<string, unknown>).checkpoint;
  if (!checkpoint || typeof checkpoint !== 'object') return null;

  const record = checkpoint as Record<string, unknown>;
  const phase = record.phase;
  if (typeof phase !== 'string') return null;

  return {
    phase: phase as AuditCheckpointPhaseValue,
    completedSpecialists: Array.isArray(record.completedSpecialists)
      ? record.completedSpecialists.filter((value): value is string => typeof value === 'string')
      : [],
    findingCount: typeof record.findingCount === 'number' ? record.findingCount : 0,
    clusterCount: typeof record.clusterCount === 'number' ? record.clusterCount : 0,
    graphSnapshotId:
      typeof record.graphSnapshotId === 'string' ? record.graphSnapshotId : null,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    reason: typeof record.reason === 'string' ? record.reason : undefined
  };
}

export function phaseRank(phase: AuditCheckpointPhaseValue): number {
  switch (phase) {
    case AuditCheckpointPhase.QUEUED:
      return 0;
    case AuditCheckpointPhase.INGESTION:
      return 1;
    case AuditCheckpointPhase.GRAPH:
      return 2;
    case AuditCheckpointPhase.SPECIALISTS:
      return 3;
    case AuditCheckpointPhase.CLUSTERING:
      return 4;
    case AuditCheckpointPhase.SYNTHESIS:
      return 5;
    case AuditCheckpointPhase.VALIDATION:
      return 6;
    case AuditCheckpointPhase.FINISHED:
      return 7;
    default:
      return 0;
  }
}

export function hasReachedPhase(
  current: AuditCheckpointPhaseValue,
  target: AuditCheckpointPhaseValue
): boolean {
  return phaseRank(current) >= phaseRank(target);
}

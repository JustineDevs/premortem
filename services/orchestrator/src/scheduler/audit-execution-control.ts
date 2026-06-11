import {
  AuditCheckpointPhase,
  AuditEvent,
  hasReachedPhase,
  parseAuditCheckpoint,
  type AuditCheckpoint
} from '@premortem/domain';
import {
  getAuditRunControlState,
  inferCheckpointFromAuditRun,
  saveAuditCheckpoint
} from '@premortem/db';

export class AuditExecutionHalted extends Error {
  readonly kind: 'paused' | 'cancelled';

  constructor(kind: 'paused' | 'cancelled', message: string) {
    super(message);
    this.name = 'AuditExecutionHalted';
    this.kind = kind;
  }
}

export async function assertAuditContinuing(auditRunId: string) {
  const control = await getAuditRunControlState(auditRunId);

  if (control.runStatus === 'cancelled') {
    throw new AuditExecutionHalted('cancelled', 'Audit run was cancelled');
  }

  if (control.runStatus === 'paused') {
    throw new AuditExecutionHalted('paused', 'Audit run was paused');
  }

  return control;
}

export async function checkpointAndPause(auditRunId: string, reason?: string) {
  const checkpoint = await inferCheckpointFromAuditRun(auditRunId);
  await saveAuditCheckpoint(auditRunId, checkpoint, reason);
  throw new AuditExecutionHalted('paused', reason ?? 'Audit run paused at checkpoint');
}

export async function persistPhaseCheckpoint(
  auditRunId: string,
  phase: AuditCheckpoint['phase'],
  partial: Partial<AuditCheckpoint> = {}
) {
  const control = await getAuditRunControlState(auditRunId);
  const existing = control.checkpoint;

  await saveAuditCheckpoint(auditRunId, {
    phase,
    completedSpecialists: partial.completedSpecialists ?? existing?.completedSpecialists ?? [],
    findingCount: partial.findingCount ?? existing?.findingCount ?? 0,
    clusterCount: partial.clusterCount ?? existing?.clusterCount ?? 0,
    graphSnapshotId: partial.graphSnapshotId ?? existing?.graphSnapshotId ?? null,
    savedAt: new Date().toISOString()
  });
}

export function shouldSkipPhase(
  checkpoint: AuditCheckpoint | null,
  phase: AuditCheckpoint['phase']
): boolean {
  if (!checkpoint) return false;
  return hasReachedPhase(checkpoint.phase, phase);
}

export function isResumeExecution(checkpoint: AuditCheckpoint | null): boolean {
  return checkpoint !== null && checkpoint.phase !== AuditCheckpointPhase.QUEUED;
}

export { AuditEvent, parseAuditCheckpoint };

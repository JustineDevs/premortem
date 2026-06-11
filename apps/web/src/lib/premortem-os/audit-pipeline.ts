export const AUDIT_PIPELINE_STEPS = [
  'Ingest Context',
  'Specialist Swarm',
  'Graph Merge',
  'Finding Synthesis',
  'Issue Validation',
  'Publish Ready'
] as const;

export function derivePipelineProgress(input: {
  auditStatus: string;
  agentRuns: Array<{ status: string }>;
}): { activeStepIndex: number; animating: boolean } {
  const total = input.agentRuns.length;
  const completed = input.agentRuns.filter((run) => run.status === 'completed').length;
  const failed = input.agentRuns.filter((run) => run.status === 'failed').length;
  const animating = input.auditStatus === 'RUNNING';

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
}): Array<{ time: string; msg: string }> {
  const lines: Array<{ time: string; msg: string }> = [];

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

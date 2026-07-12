'use client';

import { AUDIT_PARALLEL_LANES } from '@premortem/domain';

import type { WorkflowAuditSnapshot } from './workflow-canvas.types';

interface WorkflowDualLanePanelProps {
  auditSnapshot: WorkflowAuditSnapshot | null;
  selectedAgentRunId?: string | null;
  compact?: boolean;
}

function laneAgentsForSnapshot(
  laneId: 'structure' | 'runtime',
  agentRuns: WorkflowAuditSnapshot['agentRuns']
) {
  return agentRuns.filter((run) =>
    laneId === 'structure'
      ? run.agentName.includes('topology') ||
        run.agentName.includes('dependency') ||
        run.agentName.includes('artifact') ||
        run.agentName.includes('test') ||
        run.agentName.includes('integration')
      : !run.agentName.includes('topology') &&
        !run.agentName.includes('dependency') &&
        !run.agentName.includes('artifact') &&
        !run.agentName.includes('test') &&
        !run.agentName.includes('integration')
  );
}

export function WorkflowDualLanePanel({
  auditSnapshot,
  selectedAgentRunId = null,
  compact = false
}: WorkflowDualLanePanelProps) {
  const agentRuns = auditSnapshot?.agentRuns ?? [];
  const selectedAgentRun = selectedAgentRunId
    ? agentRuns.find((run) => run.id === selectedAgentRunId) ?? null
    : null;

  return (
    <div
      className={`z-20 shrink-0 border-t border-[#EAE6DF] bg-white ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
    >
      <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-wider text-[#8A958F]">
        Dual-lane parallel audit ({AUDIT_PARALLEL_LANES.length} lanes)
      </p>
      {selectedAgentRun ? (
        <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] leading-relaxed text-emerald-950">
          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-emerald-700">
            Selected agent
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-emerald-950">{selectedAgentRun.agentName}</span>
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-emerald-800">
              {selectedAgentRun.status}
            </span>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {AUDIT_PARALLEL_LANES.map((lane) => {
          const laneAgents = laneAgentsForSnapshot(lane.id, agentRuns);
          return (
            <div key={lane.id} className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-2.5">
              <p className="font-mono text-[10px] font-bold uppercase text-[#1E2522]">{lane.label}</p>
              {!compact && (
                <p className="mt-1 text-[9px] leading-relaxed text-[#717A75]">{lane.description}</p>
              )}
              <p className="mt-2 font-mono text-[9px] text-emerald-800">
                {laneAgents.length > 0
                  ? `${laneAgents.length} agents active in this lane`
                  : 'Awaiting audit run'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

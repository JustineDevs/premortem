'use client';

import React from 'react';
import { AUDIT_PARALLEL_LANES } from '@premortem/domain';

import type { WorkflowAuditSnapshot } from './workflow-canvas.types';

interface WorkflowDualLanePanelProps {
  auditSnapshot: WorkflowAuditSnapshot | null;
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

export function WorkflowDualLanePanel({ auditSnapshot, compact = false }: WorkflowDualLanePanelProps) {
  const agentRuns = auditSnapshot?.agentRuns ?? [];

  return (
    <div
      className={`z-20 shrink-0 border-t border-[#EAE6DF] bg-white ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
    >
      <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-wider text-[#8A958F]">
        Dual-lane parallel audit ({AUDIT_PARALLEL_LANES.length} lanes)
      </p>
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

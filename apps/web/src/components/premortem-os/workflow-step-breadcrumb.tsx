'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

import {
  WORKFLOW_STEP_IDS,
  WORKFLOW_STEP_LABELS,
  type CanvasNode
} from './workflow-canvas.types';

interface WorkflowStepBreadcrumbProps {
  activeNode: CanvasNode | undefined;
  activeNodeId: string | null;
  onSelectStep: (stepId: string) => void;
}

export function WorkflowStepBreadcrumb({
  activeNode,
  activeNodeId,
  onSelectStep
}: WorkflowStepBreadcrumbProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-[#EAE6DF] bg-[#FAF8F5] p-3 px-4 font-mono text-[9px] uppercase tracking-wide">
      {WORKFLOW_STEP_IDS.map((stepId, index) => {
        const active = activeNodeId === stepId;
        const activeIndex =
          activeNodeId !== null
            ? WORKFLOW_STEP_IDS.indexOf(
                activeNodeId as (typeof WORKFLOW_STEP_IDS)[number]
              )
            : -1;
        const completed = activeIndex > index;
        return (
          <React.Fragment key={stepId}>
            {index > 0 && (
              <ChevronRight size={10} className="shrink-0 text-[#CDC7BD]" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => onSelectStep(stepId)}
              className={`rounded px-1.5 py-0.5 font-bold transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-950 text-white'
                  : completed
                    ? 'text-emerald-800 hover:bg-emerald-50'
                    : 'text-[#8A958F] hover:bg-white hover:text-[#1E2522]'
              }`}
            >
              {WORKFLOW_STEP_LABELS[stepId]}
            </button>
          </React.Fragment>
        );
      })}
      {activeNode && (
        <span className="ml-auto truncate text-[8px] normal-case tracking-normal text-[#717A75]">
          {activeNode.metadata.title}
        </span>
      )}
    </div>
  );
}

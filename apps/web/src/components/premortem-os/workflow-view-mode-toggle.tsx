'use client';

import React from 'react';
import type { WorkflowCanvasViewMode } from '@premortem/domain';

interface WorkflowViewModeToggleProps {
  mode: WorkflowCanvasViewMode;
  onChange: (mode: WorkflowCanvasViewMode) => void;
}

const MODES: Array<{ id: WorkflowCanvasViewMode; label: string }> = [
  { id: 'graph', label: 'Graph' },
  { id: 'split', label: 'Split' },
  { id: 'workbench', label: 'Workbench' }
];

export function WorkflowViewModeToggle({ mode, onChange }: WorkflowViewModeToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-0.5"
      role="tablist"
      aria-label="Canvas layout mode"
    >
      {MODES.map((entry) => {
        const active = mode === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.id)}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide rounded-md transition-colors cursor-pointer ${
              active
                ? 'bg-emerald-950 text-white shadow-sm'
                : 'text-[#717A75] hover:text-[#1E2522] hover:bg-white/70'
            }`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

const PANEL_BASE =
  'h-full shrink-0 overflow-hidden transition-[opacity,transform,width] duration-200 ease-out';

export function panelClassForMode(side: 'left' | 'right', mode: WorkflowCanvasViewMode): string {
  if (mode === 'split') {
    return `${PANEL_BASE} w-1/2 opacity-100 translate-x-0`;
  }
  if (mode === 'graph') {
    return side === 'left'
      ? `${PANEL_BASE} w-full opacity-100 translate-x-0`
      : `${PANEL_BASE} w-0 opacity-0 translate-x-5 pointer-events-none`;
  }
  return side === 'right'
    ? `${PANEL_BASE} w-full opacity-100 translate-x-0`
    : `${PANEL_BASE} w-0 opacity-0 -translate-x-5 pointer-events-none`;
}

'use client';

import React from 'react';
import { Play, Workflow } from 'lucide-react';
import type { Project } from '@/lib/premortem-os/types';
import type { WorkflowCanvasViewMode } from '@premortem/domain';
import type { CanvasEdge } from './workflow-canvas.types';

import { WorkflowCanvasControls } from './workflow-canvas-board';
import { WorkflowViewModeToggle } from './workflow-view-mode-toggle';

interface WorkflowCommandBarProps {
  viewMode: WorkflowCanvasViewMode;
  onViewModeChange: (mode: WorkflowCanvasViewMode) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onResetLayout: () => void;
  onResetCamera: () => void;
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  selectedProject: Project;
  selectedEdge?: CanvasEdge | null;
  hasProjects?: boolean;
  onExecuteStream: () => void;
}

export function WorkflowCommandBar({
  viewMode,
  onViewModeChange,
  isSimulating,
  onToggleSimulation,
  onResetLayout,
  onResetCamera,
  projects,
  selectedProjectId,
  onProjectChange,
  selectedProject,
  selectedEdge = null,
  hasProjects = true,
  onExecuteStream
}: WorkflowCommandBarProps) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  return (
    <div className="z-20 flex shrink-0 flex-col items-stretch justify-between gap-4 border-b border-[#EAE6DF] bg-white p-4 sm:flex-row sm:items-center">
      <div className="space-y-0.5">
        <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-tight text-[#1E2522]">
          <Workflow size={14} className="text-emerald-900" aria-hidden />
          Open Audit Trace Canvas
        </h2>
        <p className="text-[11px] text-[#717A75]">
          Graph and Workbench views share one pipeline: graph nodes and links on the left, active step on the right.
        </p>
        {selectedEdge ? (
          <div className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-[10px] text-emerald-950">
            <span className="font-bold uppercase tracking-wider text-emerald-700">Path translator</span>
            <span className="font-semibold text-emerald-950">
              {selectedEdge.from} → {selectedEdge.to}
            </span>
            <span className="text-emerald-800/80">({selectedEdge.label})</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3.5 select-none">
        <WorkflowViewModeToggle mode={viewMode} onChange={(mode) => onViewModeChange(mode)} />

        <div className="flex items-center gap-1.5 rounded border border-[#EAE6DF] bg-[#FAF8F5] p-1 px-2.5 shadow-xs">
          <span className="mr-1 font-mono text-[9px] font-bold uppercase text-[#8A958F]">Step replay:</span>
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`flex cursor-pointer items-center gap-1 rounded py-1 px-2.5 font-mono text-[9.5px] font-bold uppercase leading-none transition-all ${
              isSimulating
                ? 'bg-amber-700 text-white hover:bg-amber-800'
                : 'bg-emerald-950 text-white hover:bg-emerald-900'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isSimulating ? 'bg-amber-300 motion-safe:animate-ping' : 'bg-emerald-300'}`}
            />
            <span>{isSimulating ? 'Stop replay' : 'Replay steps'}</span>
          </button>
        </div>

        <WorkflowCanvasControls onResetLayout={onResetLayout} onResetCamera={onResetCamera} />

        <select
          value={selectedProjectId}
          onChange={(event) => onProjectChange(event.target.value)}
          aria-label="Select project"
          className="rounded border border-[#EAE6DF] bg-white p-1 px-2.5 font-display text-xs font-bold text-[#1E2522] focus:border-emerald-950 focus:outline-none"
        >
          {safeProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onExecuteStream}
          disabled={!hasProjects || selectedProject.status === 'SCANNING'}
          className="flex cursor-pointer items-center gap-1.5 rounded bg-emerald-950 py-1 px-3 font-mono text-xs font-bold uppercase tracking-wider text-[#FAF8F5] transition-all hover:bg-emerald-900 disabled:opacity-55"
        >
          <Play size={11} strokeWidth={2.5} aria-hidden />
          <span>
            {!hasProjects
              ? 'Add project'
              : selectedProject.status === 'SCANNING'
                ? 'Running...'
                : 'Execute Stream'}
          </span>
        </button>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { ChevronRight, Info, Workflow, X } from 'lucide-react';

import type { Finding } from '@/lib/premortem-os/types';
import type { CanvasEdge, CanvasNode } from './workflow-canvas.types';
import { WorkflowDualLanePanel } from './workflow-dual-lane-panel';
import type { WorkflowAuditSnapshot } from './workflow-canvas.types';
import { WorkflowStepBreadcrumb } from './workflow-step-breadcrumb';

interface WorkflowStepWorkbenchProps {
  activeNode: CanvasNode | undefined;
  activeEdge: CanvasEdge | undefined;
  activeNodeId: string | null;
  findingsList: Finding[];
  auditSnapshot: WorkflowAuditSnapshot | null;
  isSimulating: boolean;
  simulationIndex: number;
  nodes: CanvasNode[];
  selectedFindingIdForDetail: string | null;
  onSelectFinding: (findingId: string | null) => void;
  onClearSelection: () => void;
  onSelectStep: (stepId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export function WorkflowStepWorkbench({
  activeNode,
  activeEdge,
  activeNodeId,
  findingsList,
  auditSnapshot,
  isSimulating,
  simulationIndex,
  nodes,
  selectedFindingIdForDetail,
  onSelectFinding,
  onClearSelection,
  onSelectStep,
  onNavigateTab
}: WorkflowStepWorkbenchProps) {
  const activeNodeIndex = activeNode ? nodes.findIndex((node) => node.id === activeNode.id) : -1;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
      id="canvas-inspect-panel"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#EAE6DF] bg-[#FAF8F5]/50 p-4 px-6">
        <div className="space-y-0.5">
          <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-[#8A958F]">
            Workbench
          </span>
          <h3 className="font-display text-md font-bold tracking-tight text-[#1E2522]">
            {activeNode ? activeNode.metadata.title : activeEdge ? activeEdge.label : 'Segment inspection'}
          </h3>
        </div>

        {(activeNode || activeEdge) && (
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Clear selection"
            className="cursor-pointer rounded p-1.5 text-[#8A958F] transition-all hover:bg-[#FAF8F5] hover:text-[#1E2522]"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 text-xs [scrollbar-gutter:stable]">
        {activeNode ? (
          <div className="space-y-6 pb-4">
            {activeNode.id === 'node-run-audit' && (
              <WorkflowDualLanePanel auditSnapshot={auditSnapshot} compact />
            )}

            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="flex flex-col justify-between rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3">
                <span className="mb-1 block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Run duration
                </span>
                <span className="font-mono text-[11.5px] font-bold text-emerald-950">
                  {isSimulating && simulationIndex === activeNodeIndex
                    ? 'calculating...'
                    : activeNode.metadata.duration || '310ms'}
                </span>
              </div>
              <div className="flex flex-col justify-between rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3">
                <span className="mb-1 block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Audit step status
                </span>
                <span
                  className={`block font-mono text-[10.5px] font-bold uppercase ${
                    activeNode.status === 'completed' || activeNode.status === 'published'
                      ? 'text-emerald-700'
                      : activeNode.status === 'running'
                        ? 'font-bold text-amber-600 motion-safe:animate-pulse'
                        : activeNode.status === 'failed'
                          ? 'font-bold text-rose-700'
                          : 'text-zinc-500'
                  }`}
                >
                  ● {activeNode.status}
                </span>
              </div>
            </div>

            {(activeNode.metadata.promptVersion || activeNode.metadata.agentConfig) && (
              <div className="space-y-2 rounded border border-zinc-200 bg-neutral-50 p-3">
                <span className="block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Trace orchestration context
                </span>
                <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px] leading-tight text-zinc-700">
                  {activeNode.metadata.promptVersion && (
                    <div className="flex items-center justify-between rounded border border-zinc-200 bg-white p-1.5 px-2.5">
                      <span className="text-[#8A958F]">PROMPT:</span>
                      <span className="max-w-[190px] truncate font-bold text-neutral-800">
                        {activeNode.metadata.promptVersion}
                      </span>
                    </div>
                  )}
                  {activeNode.metadata.agentConfig && (
                    <div className="flex items-center justify-between rounded border border-zinc-200 bg-white p-1.5 px-2.5">
                      <span className="text-[#8A958F]">AI CLIENT:</span>
                      <span className="max-w-[190px] truncate font-bold text-neutral-800">
                        {activeNode.metadata.agentConfig}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2.5 rounded border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="font-bold uppercase text-zinc-400">Execution metadata</span>
                <span className="font-semibold text-zinc-500">Pipeline stage</span>
              </div>
              <p className="select-text font-sans leading-relaxed text-neutral-700">{activeNode.description}</p>
              <div className="select-none pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTab(activeNode.targetLinkTab)}
                  className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-[#CDC7BD] bg-white py-1 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-800 transition-all hover:bg-neutral-50"
                >
                  <span>View in {activeNode.targetLinkTab.toUpperCase()} tab</span>
                  <ChevronRight size={12} aria-hidden />
                </button>
              </div>
            </div>

            {activeNode.metadata.linkedFindingIds && activeNode.metadata.linkedFindingIds.length > 0 && (
              <div className="space-y-2 border-t border-zinc-100 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8A958F]">
                    Linked findings ({activeNode.metadata.linkedFindingIds.length})
                  </h4>
                  <span className="font-mono text-[8px] text-zinc-400">Click to preview</span>
                </div>
                <div className="space-y-1.5">
                  {activeNode.metadata.linkedFindingIds.map((findingId) => {
                    const finding = findingsList.find((entry) => entry.id === findingId);
                    const isDetailActive = selectedFindingIdForDetail === findingId;
                    if (!finding) return null;
                    const isHighSeverity =
                      finding.severity === 'CRITICAL' || finding.severity === 'HIGH';
                    const shortId = `${findingId.slice(0, 8)}…`;
                    return (
                      <div key={findingId} className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectFinding(isDetailActive ? null : findingId)}
                          className={`grid w-full cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 rounded border p-2.5 text-left transition-all ${
                            isDetailActive
                              ? 'border-[#1E2522] bg-[#1E2522] text-white'
                              : isHighSeverity
                                ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50'
                                : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/50'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <p
                              className={`truncate text-[10px] font-semibold leading-snug ${
                                isDetailActive
                                  ? 'text-white'
                                  : isHighSeverity
                                    ? 'text-rose-900'
                                    : 'text-zinc-800'
                              }`}
                              title={finding.title}
                            >
                              {finding.title}
                            </p>
                            <p
                              className={`truncate font-mono text-[8px] tracking-wide ${
                                isDetailActive ? 'text-zinc-400' : 'text-zinc-500'
                              }`}
                              title={findingId}
                            >
                              {shortId}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 self-start rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                              isHighSeverity ? 'bg-rose-600 text-white' : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </button>

                        {isDetailActive && (
                          <div className="animate-fadeIn mt-0.5 space-y-2 rounded border border-emerald-200 bg-[#FAF8F5] p-3 font-sans text-[10px] leading-relaxed text-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between border-b pb-1 font-mono text-[8.5px]">
                              <span className="font-bold uppercase text-emerald-800">Trace evidence</span>
                              <span className="text-zinc-500">
                                File: {finding.filepath}:{finding.line}
                              </span>
                            </div>
                            <p className="text-[10.5px] font-semibold leading-tight text-zinc-900">
                              {finding.title}
                            </p>
                            <p className="text-[10px] leading-relaxed text-neutral-600">
                              {finding.description}
                            </p>
                            {finding.recommendation && (
                              <div className="rounded border bg-white p-2 font-mono text-[9.5px] text-emerald-950">
                                <span className="mb-0.5 block text-[8.5px] font-bold uppercase text-emerald-800">
                                  Remedy code action:
                                </span>
                                <span className="leading-snug">{finding.recommendation}</span>
                              </div>
                            )}
                            <div className="pt-1.5">
                              <button
                                type="button"
                                onClick={() => onNavigateTab('audits')}
                                className="flex w-full cursor-pointer items-center justify-center gap-1 rounded bg-[#1E2522] py-1 px-3 font-mono text-[9.5px] font-bold uppercase tracking-wider text-white hover:bg-emerald-950"
                              >
                                <span>Deep-dive review trace</span>
                                <ChevronRight size={11} aria-hidden />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeNode.metadata.inputs && activeNode.metadata.inputs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Input parameters
                </h4>
                <div className="space-y-1.5 font-mono text-[10.5px]">
                  {activeNode.metadata.inputs.map((input, index) => (
                    <div
                      key={index}
                      className="select-text rounded border border-[#EAE6DF] bg-[#FAF8F5] p-2 font-bold text-[#1E2522]"
                    >
                      <span className="mr-1 rounded border bg-white px-1.5 py-0.2 text-[9px] text-zinc-400">
                        {index + 1}
                      </span>
                      {input}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeNode.metadata.outputs && activeNode.metadata.outputs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Produced outcomes
                </h4>
                <div className="space-y-1.5 font-mono text-[10.5px]">
                  {activeNode.metadata.outputs.map((output, index) => (
                    <div
                      key={index}
                      className="select-text rounded border border-emerald-200/50 bg-emerald-50/25 p-2 font-medium text-emerald-950"
                    >
                      <span className="mr-2 rounded border bg-white px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                        OUT
                      </span>
                      {output}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeNode.metadata.systemNote && (
              <div className="flex gap-2 rounded border border-[#EAE6DF] bg-[#F2EFF6]/30 p-3 font-sans text-zinc-700">
                <Info className="mt-0.5 shrink-0 text-neutral-700" size={14} aria-hidden />
                <p className="text-[10.5px]">{activeNode.metadata.systemNote}</p>
              </div>
            )}

            {activeNode.metadata.logs && activeNode.metadata.logs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8A958F]">
                  Node execution trail logs
                </h4>
                <div className="space-y-1.5 rounded bg-neutral-900 p-3 font-mono text-[9px] text-[#FAF8F5] shadow-inner select-text">
                  {activeNode.metadata.logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="select-none font-bold text-zinc-500">[{index + 1}]</span>
                      <span className="leading-normal">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeEdge ? (
          <div className="space-y-4">
            <div className="space-y-1 rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider">
                Gateway transformer
              </span>
              <h4 className="font-semibold text-emerald-950">{activeEdge.label}</h4>
            </div>
            <p className="select-text leading-relaxed text-[#5C6560]">{activeEdge.transformationDetail}</p>
            <div className="select-text rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3 text-[#717A75]">
              <span className="mb-1 block font-mono text-[9px] font-bold uppercase text-neutral-800">
                Data flow pipeline
              </span>
              <p className="text-[10.5px]">
                All intermediate files parsing are stored temporarily within air-gapped memory space
                and discarded immediately upon completing the published sync routine.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center rounded border border-dashed border-[#EAE6DF] bg-[#FAF8F5] p-8 text-center font-mono text-[#717A75] select-none">
            <Workflow size={24} className="mb-2.5 animate-pulse text-zinc-400" aria-hidden />
            <span>Select any canvas node or flow edge to inspect underlying audit pipeline parameters.</span>
          </div>
        )}
      </div>

      <WorkflowStepBreadcrumb
        activeNode={activeNode}
        activeNodeId={activeNodeId}
        onSelectStep={onSelectStep}
      />
    </div>
  );
}

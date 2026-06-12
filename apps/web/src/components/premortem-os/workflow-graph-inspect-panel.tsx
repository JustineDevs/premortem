'use client';

import React, { useMemo } from 'react';
import { ArrowRight, ExternalLink, GitBranch, Network, Sparkles, X } from 'lucide-react';

import type { WorkflowAuditSnapshot } from './workflow-canvas.types';
import {
  buildGraphNodeInspectContext,
  formatGraphPropValue
} from './build-graph-node-inspect';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

interface WorkflowGraphInspectPanelProps {
  selectedNodeId: string | null;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  auditSnapshot: WorkflowAuditSnapshot | null;
  auditRunId?: string;
  onClearSelection: () => void;
  onSelectNode: (nodeId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

function sourceLabel(node: WorkflowGraphNode): string {
  if (node.source === 'phoenix') return 'Phoenix trace span';
  if (node.lane === 'semantic') return 'Semantic trace';
  if (node.lane === 'runtime') return 'Runtime graph';
  return 'Repository graph';
}

export function WorkflowGraphInspectPanel({
  selectedNodeId,
  nodes,
  edges,
  auditSnapshot,
  auditRunId,
  onClearSelection,
  onSelectNode,
  onNavigateTab
}: WorkflowGraphInspectPanelProps) {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const inspect = useMemo(() => {
    if (!selectedNode) return null;
    return buildGraphNodeInspectContext(selectedNode, nodes, edges, auditSnapshot);
  }, [selectedNode, nodes, edges, auditSnapshot]);

  if (!selectedNode || !inspect) {
    return (
      <div className="shrink-0 border-t border-[#EAE6DF] bg-[#FAF8F5]/60 px-4 py-5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#8A958F]">
          Graph inspect
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#717A75]">
          Click a repository or trace node to inspect properties, graph links, and audit runtime
          context.
        </p>
      </div>
    );
  }

  const propEntries = Object.entries({
    ...(selectedNode.props ?? {}),
    ...(selectedNode.spanKind ? { spanKind: selectedNode.spanKind } : {}),
    ...(selectedNode.status ? { status: selectedNode.status } : {})
  });

  return (
    <div className="flex max-h-[42vh] shrink-0 flex-col border-t border-[#EAE6DF] bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EAE6DF] bg-[#FAF8F5]/50 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#8A958F]">
            Graph inspect
          </span>
          <h4 className="truncate font-display text-sm font-bold tracking-tight text-[#1E2522]">
            {selectedNode.label}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded border border-[#EAE6DF] bg-white px-2 py-0.5 font-mono text-[8px] font-bold uppercase text-[#4A5550]">
              {selectedNode.type}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase text-[#8A958F]">
              {selectedNode.source === 'phoenix' ? <Sparkles size={10} /> : <Network size={10} />}
              {sourceLabel(selectedNode)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Clear graph selection"
          className="shrink-0 rounded p-1.5 text-[#8A958F] transition-colors hover:bg-[#FAF8F5] hover:text-[#1E2522]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 text-xs [scrollbar-gutter:stable]">
        <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3">
          <span className="mb-1 block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
            Node id
          </span>
          <code className="block break-all font-mono text-[10px] text-[#1E2522]">{selectedNode.id}</code>
          {auditRunId ? (
            <p className="mt-2 font-mono text-[9px] text-[#717A75]">Audit run: {auditRunId}</p>
          ) : null}
        </div>

        {propEntries.length > 0 ? (
          <div className="space-y-2">
            <span className="block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
              Properties
            </span>
            <div className="overflow-hidden rounded border border-[#EAE6DF]">
              {propEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[minmax(88px,34%)_1fr] gap-2 border-b border-[#EAE6DF] bg-white px-3 py-2 last:border-b-0"
                >
                  <span className="font-mono text-[9px] font-bold uppercase text-[#8A958F]">{key}</span>
                  <span className="whitespace-pre-wrap break-all font-mono text-[10px] text-[#1E2522]">
                    {formatGraphPropValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(inspect.incoming.length > 0 || inspect.outgoing.length > 0) && (
          <div className="space-y-2">
            <span className="block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
              Graph connections
            </span>
            <div className="space-y-1.5">
              {inspect.incoming.map(({ edge, from }) => (
                <button
                  key={`in-${edge.id}`}
                  type="button"
                  onClick={() => from && onSelectNode(from.id)}
                  disabled={!from}
                  className="flex w-full items-center gap-2 rounded border border-[#EAE6DF] bg-white px-2.5 py-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 disabled:cursor-default disabled:opacity-60"
                >
                  <span className="font-mono text-[9px] text-[#8A958F]">in</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#1E2522]">
                    {from?.label ?? edge.from}
                  </span>
                  {edge.label ? (
                    <span className="font-mono text-[8px] uppercase text-[#8A958F]">{edge.label}</span>
                  ) : null}
                </button>
              ))}
              {inspect.outgoing.map(({ edge, to }) => (
                <button
                  key={`out-${edge.id}`}
                  type="button"
                  onClick={() => to && onSelectNode(to.id)}
                  disabled={!to}
                  className="flex w-full items-center gap-2 rounded border border-[#EAE6DF] bg-white px-2.5 py-2 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 disabled:cursor-default disabled:opacity-60"
                >
                  <span className="font-mono text-[9px] text-[#8A958F]">out</span>
                  <ArrowRight size={10} className="text-[#8A958F]" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#1E2522]">
                    {to?.label ?? edge.to}
                  </span>
                  {edge.label ? (
                    <span className="font-mono text-[8px] uppercase text-[#8A958F]">{edge.label}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {inspect.relatedAgentRuns.length > 0 ? (
          <div className="space-y-2">
            <span className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
              <GitBranch size={10} />
              Audit agent trace
            </span>
            <div className="space-y-1.5">
              {inspect.relatedAgentRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded border border-[#EAE6DF] bg-[#FAF8F5] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] font-bold text-[#1E2522]">
                      {run.agentName}
                    </span>
                    <span className="font-mono text-[9px] uppercase text-emerald-800">{run.status}</span>
                  </div>
                  {run.startedAt ? (
                    <p className="mt-1 font-mono text-[9px] text-[#717A75]">Started {run.startedAt}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {inspect.relatedEvents.length > 0 ? (
          <div className="space-y-2">
            <span className="block font-mono text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
              Audit runtime events
            </span>
            <div className="space-y-1">
              {inspect.relatedEvents.map((event, index) => (
                <div
                  key={`${event.eventType}-${event.createdAt}-${index}`}
                  className="rounded border border-[#EAE6DF] bg-white px-3 py-2"
                >
                  <div className="font-mono text-[10px] font-bold text-[#1E2522]">{event.eventType}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-[#717A75]">
                    {event.actor} · {event.createdAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {inspect.webUrl ? (
            <a
              href={inspect.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded bg-emerald-950 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white hover:bg-emerald-900"
            >
              Open source
              <ExternalLink size={10} />
            </a>
          ) : null}
          {selectedNode.type === 'issue' && onNavigateTab ? (
            <button
              type="button"
              onClick={() => onNavigateTab('audits')}
              className="inline-flex items-center gap-1.5 rounded border border-[#EAE6DF] bg-white px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#1E2522] hover:border-emerald-200"
            >
              Open Audits
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

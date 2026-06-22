'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Network, Sparkles, X } from 'lucide-react';

import { buildGraphNodeInspectContext, formatGraphPropValue } from './build-graph-node-inspect';
import { WorkflowD3Graph } from './workflow-d3-graph';

import type { WorkflowAuditSnapshot } from './workflow-canvas.types';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

export type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

interface WorkflowGraphPanelProps {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  nodeCount?: number;
  edgeCount?: number;
  layoutKey?: string;
  memoryUpdating?: boolean;
  selectedGraphNodeId?: string | null;
  auditSnapshot?: WorkflowAuditSnapshot | null;
  auditRunId?: string;
  emptyMessage?: string;
  semanticIncluded?: boolean;
  phoenixConfigured?: boolean;
  onSelectGraphNode?: (id: string | null) => void;
  onNavigateTab?: (tab: string) => void;
}

function colorForType(type: string, index: number, lane?: WorkflowGraphNode['lane']): string {
  if (type === 'repo') return '#1A936F';
  if (type === 'file' || type === 'pipeline') return '#004E89';
  if (type === 'pipeline_run') return '#7B2D8E';
  if (type === 'ci_job') return '#C5283D';
  if (type === 'issue') return '#E9724C';
  if (type === 'package') return '#3498db';
  if (type === 'service') return '#27ae60';
  if (type === 'structure') return '#004E89';
  if (type === 'runtime') return '#1A936F';
  if (type === 'semantic' || lane === 'semantic') return '#6B4E9B';
  if (type === 'chain') return '#6B4E9B';
  if (type === 'llm') return '#E9724C';
  if (type === 'agent') return '#7B2D8E';
  const palette = ['#1A936F', '#004E89', '#7B2D8E', '#C5283D', '#E9724C', '#3498db', '#27ae60', '#f39c12'];
  return palette[index % palette.length] ?? '#1A936F';
}

export function WorkflowGraphPanel({
  nodes,
  edges,
  nodeCount,
  edgeCount,
  layoutKey,
  memoryUpdating = false,
  selectedGraphNodeId = null,
  auditSnapshot = null,
  auditRunId,
  emptyMessage,
  semanticIncluded = false,
  phoenixConfigured = false,
  onSelectGraphNode,
  onNavigateTab
}: WorkflowGraphPanelProps) {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedGraphNodeId) ?? null,
    [nodes, selectedGraphNodeId]
  );

  const selectedNodeContext = useMemo(() => {
    if (!selectedNode) return null;
    return buildGraphNodeInspectContext(selectedNode, nodes, edges, auditSnapshot);
  }, [auditSnapshot, edges, nodes, selectedNode]);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const legendItems = useMemo(() => {
    const counts = new Map<string, { count: number; color: string }>();
    nodes.forEach((node, index) => {
      const key = node.type || 'node';
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
        return;
      }

      counts.set(key, { count: 1, color: colorForType(node.lane ?? node.type, index, node.lane) });
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, ...value }))
      .slice(0, 8);
  }, [nodes]);

  const openNodeDetails = useCallback(
    (nodeId: string) => {
      setSelectedEdgeId(null);
      onSelectGraphNode?.(nodeId);
    },
    [onSelectGraphNode]
  );

  const clearSelection = useCallback(() => {
    setSelectedEdgeId(null);
    onSelectGraphNode?.(null);
  }, [onSelectGraphNode]);

  const renderDetailPanel = () => {
    if (selectedNode && selectedNodeContext) {
      const propEntries = selectedNode.props ? Object.entries(selectedNode.props).slice(0, 8) : [];

      return (
        <div className="absolute right-3 top-3 bottom-3 z-30 flex w-[320px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07110E]/95 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
                Graph inspect
              </span>
              <h4 className="truncate font-semibold text-sm text-[#F4FAF5]">{selectedNode.label}</h4>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[8px] font-bold uppercase text-[#D5E1D8]">
                  {selectedNode.type}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wide text-[#9BABA0]">
                  {selectedNode.source === 'phoenix' ? <Sparkles size={10} /> : <Network size={10} />}
                  {selectedNode.source === 'phoenix'
                    ? 'Phoenix trace span'
                    : selectedNode.lane === 'semantic'
                      ? 'Semantic trace'
                      : selectedNode.lane === 'runtime'
                        ? 'Runtime graph'
                        : 'Graph'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear graph selection"
              className="shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-[#B4C1B8] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 text-xs [scrollbar-gutter:stable]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="mb-1 block font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#9BABA0]">
                Node id
              </span>
              <code className="block break-all font-mono text-[10px] text-[#F4FAF5]">
                {selectedNode.id}
              </code>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#9BABA0]">
                    Incoming
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] font-bold text-[#F4FAF5]">
                    {selectedNodeContext.incoming.length}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#9BABA0]">
                    Outgoing
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] font-bold text-[#F4FAF5]">
                    {selectedNodeContext.outgoing.length}
                  </div>
                </div>
              </div>
              {selectedNodeContext.webUrl ? (
                <p className="mt-2 font-mono text-[9px] text-[#94A59B]">{selectedNodeContext.webUrl}</p>
              ) : null}
            </div>

            {propEntries.length > 0 ? (
              <div className="space-y-2">
                <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#9BABA0]">
                  Properties
                </span>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {propEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[minmax(88px,34%)_1fr] gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2 last:border-b-0"
                    >
                      <span className="font-mono text-[9px] font-bold uppercase text-[#9BABA0]">
                        {key}
                      </span>
                      <span className="whitespace-pre-wrap break-all font-mono text-[10px] text-[#F4FAF5]">
                        {formatGraphPropValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedNodeContext.incoming.length > 0 || selectedNodeContext.outgoing.length > 0 ? (
              <div className="space-y-2">
                <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#9BABA0]">
                  Graph connections
                </span>
                <div className="space-y-1.5">
                  {selectedNodeContext.incoming.map(({ edge, from }) => (
                    <button
                      key={`in-${edge.id}`}
                      type="button"
                      onClick={() => from && openNodeDetails(from.id)}
                      disabled={!from}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-left transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/10 disabled:cursor-default disabled:opacity-60"
                    >
                      <span className="font-mono text-[9px] text-[#9BABA0]">in</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#F4FAF5]">
                        {from?.label ?? edge.from}
                      </span>
                      {edge.label ? (
                        <span className="font-mono text-[8px] uppercase text-[#9BABA0]">
                          {edge.label}
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {selectedNodeContext.outgoing.map(({ edge, to }) => (
                    <button
                      key={`out-${edge.id}`}
                      type="button"
                      onClick={() => to && openNodeDetails(to.id)}
                      disabled={!to}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-left transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/10 disabled:cursor-default disabled:opacity-60"
                    >
                      <span className="font-mono text-[9px] text-[#9BABA0]">out</span>
                      <ArrowRight size={10} className="text-[#9BABA0]" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#F4FAF5]">
                        {to?.label ?? edge.to}
                      </span>
                      {edge.label ? (
                        <span className="font-mono text-[8px] uppercase text-[#9BABA0]">
                          {edge.label}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              {selectedNodeContext.webUrl ? (
                <a
                  href={selectedNodeContext.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#08110D] hover:bg-emerald-300"
                >
                  Open source
                  <ExternalLink size={10} />
                </a>
              ) : null}
              {selectedNode.type === 'issue' && onNavigateTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab('audits')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#F4FAF5] hover:bg-white/10"
                >
                  Open audits
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    if (selectedEdge) {
      const fromNode = nodes.find((node) => node.id === selectedEdge.from) ?? null;
      const toNode = nodes.find((node) => node.id === selectedEdge.to) ?? null;
      const edgeProps = selectedEdge.props ? Object.entries(selectedEdge.props).slice(0, 8) : [];

      return (
        <div className="absolute right-3 top-3 bottom-3 z-30 flex w-[300px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07110E]/95 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
                Edge details
              </span>
              <h4 className="truncate font-semibold text-sm text-[#F4FAF5]">
                {selectedEdge.label ?? 'RELATED'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEdgeId(null)}
              aria-label="Clear edge selection"
              className="shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-[#B4C1B8] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 text-xs [scrollbar-gutter:stable]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="font-mono text-[8px] uppercase tracking-[0.24em] text-[#9BABA0]">
                Relationship
              </div>
              <div className="mt-1 font-mono text-[11px] text-[#F4FAF5]">
                <span className="font-bold">{fromNode?.label ?? selectedEdge.from}</span>
                <span className="px-1.5 text-[#9BABA0]">→</span>
                <span className="font-bold">{selectedEdge.label ?? 'RELATED'}</span>
                <span className="px-1.5 text-[#9BABA0]">→</span>
                <span className="font-bold">{toNode?.label ?? selectedEdge.to}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="mb-1 block font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#9BABA0]">
                Edge id
              </span>
              <code className="block break-all font-mono text-[10px] text-[#F4FAF5]">
                {selectedEdge.id}
              </code>
            </div>

            {edgeProps.length > 0 ? (
              <div className="space-y-2">
                <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#9BABA0]">
                  Properties
                </span>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {edgeProps.map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[minmax(88px,34%)_1fr] gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2 last:border-b-0"
                    >
                      <span className="font-mono text-[9px] font-bold uppercase text-[#9BABA0]">
                        {key}
                      </span>
                      <span className="whitespace-pre-wrap break-all font-mono text-[10px] text-[#F4FAF5]">
                        {formatGraphPropValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#050706]">
      <WorkflowD3Graph
        key={layoutKey ?? 'workflow-graph'}
        graphNodes={nodes}
        graphEdges={edges}
        selectedGraphNodeId={selectedGraphNodeId}
        selectedEdgeId={selectedEdgeId}
        memoryUpdating={memoryUpdating}
        showEdgeLabels
        emptyMessage={
          emptyMessage ??
          (phoenixConfigured
            ? semanticIncluded
              ? 'Graph snapshot and Phoenix semantic trace spans are ready.'
              : 'Run an audit to populate the graph snapshot and Phoenix semantic trace spans.'
            : 'Run an audit to populate the graph snapshot (nodes + links).')
        }
        semanticIncluded={semanticIncluded}
        phoenixConfigured={phoenixConfigured}
        onSelectGraphNode={(id) => {
          if (id) {
            openNodeDetails(id);
          } else {
            onSelectGraphNode?.(null);
          }
        }}
        onSelectGraphEdge={(id) => {
          setSelectedEdgeId(id);
          if (id) {
            onSelectGraphNode?.(null);
          }
        }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md">
        <div className="mb-2 font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
          Entity types
        </div>
        <div className="flex max-w-[320px] flex-wrap gap-2">
          {legendItems.map((item) => (
            <div
              key={item.name}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] text-[#D7E4DA]"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
              <span className="text-[#8D9A93]">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {renderDetailPanel()}
    </div>
  );
}

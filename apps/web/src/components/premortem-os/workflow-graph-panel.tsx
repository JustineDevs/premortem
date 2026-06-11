'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AUDIT_PARALLEL_LANES } from '@premortem/domain';
import { GitBranch, Network } from 'lucide-react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  useEdgesState,
  useNodesState,
  useReactFlow
} from '@xyflow/react';

import {
  REPOSITORY_GRAPH_FORCE_SIZE,
  layoutWithForce
} from './workflow-force-layout';
import {
  REPO_GRAPH_NODE_HEIGHT,
  REPO_GRAPH_NODE_WIDTH,
  repoGraphNodeTypes,
  type RepoGraphFlowNode
} from './workflow-repo-graph-node';

export interface WorkflowGraphNode {
  id: string;
  label: string;
  type: string;
  lane?: 'structure' | 'runtime' | 'pipeline';
}

export interface WorkflowGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface WorkflowGraphPanelProps {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  nodeCount?: number;
  edgeCount?: number;
  memoryUpdating?: boolean;
  activeNodeId?: string | null;
  onSelectNode?: (id: string) => void;
}

const TYPE_COLORS = [
  '#1A936F',
  '#004E89',
  '#7B2D8E',
  '#C5283D',
  '#E9724C',
  '#3498db',
  '#9b59b6',
  '#27ae60',
  '#f39c12',
  '#FF6B35'
];

function colorForType(type: string, index: number): string {
  if (type === 'repo') return '#1A936F';
  if (type === 'file' || type === 'pipeline') return '#004E89';
  if (type === 'pipeline_run') return '#7B2D8E';
  if (type === 'ci_job') return '#C5283D';
  if (type === 'issue') return '#E9724C';
  if (type === 'package') return '#3498db';
  if (type === 'service') return '#27ae60';
  if (type === 'structure') return '#004E89';
  if (type === 'runtime') return '#1A936F';
  return TYPE_COLORS[index % TYPE_COLORS.length]!;
}

function toRepoFlowNodes(
  graphNodes: WorkflowGraphNode[],
  positions: Map<string, { x: number; y: number }>,
  activeNodeId: string | null | undefined
): RepoGraphFlowNode[] {
  return graphNodes.map((node, index) => ({
    id: node.id,
    type: 'repoGraph',
    position: positions.get(node.id) ?? { x: (index % 6) * 140, y: Math.floor(index / 6) * 96 },
    data: {
      label: node.label,
      type: node.type,
      color: colorForType(node.lane ?? node.type, index),
      lane: node.lane
    },
    selected: activeNodeId === node.id
  }));
}

function toRepoFlowEdges(graphEdges: WorkflowGraphEdge[]): Edge[] {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: 'default',
    style: { stroke: '#B8B0A6', strokeWidth: 1.25, opacity: 0.85 },
    labelStyle: { fontSize: 7, fontFamily: 'ui-monospace, monospace', fill: '#8A958F' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#B8B0A6', width: 16, height: 16 }
  }));
}

function RepositoryGraphFlow({
  graphNodes,
  graphEdges,
  activeNodeId,
  onSelectNode
}: {
  graphNodes: WorkflowGraphNode[];
  graphEdges: WorkflowGraphEdge[];
  activeNodeId?: string | null;
  onSelectNode?: (id: string) => void;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<RepoGraphFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutVersionRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const entityTypes = useMemo(() => {
    const map = new Map<string, { name: string; count: number; color: string }>();
    graphNodes.forEach((node, index) => {
      const color = colorForType(node.lane ?? node.type, index);
      const existing = map.get(node.type);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(node.type, { name: node.type, count: 1, color });
      }
    });
    return [...map.values()];
  }, [graphNodes]);

  const runForceLayout = useCallback(() => {
    const version = ++layoutVersionRef.current;

    if (graphNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const bounds = containerRef.current?.getBoundingClientRect();
    const width = Math.max(Math.round(bounds?.width ?? REPOSITORY_GRAPH_FORCE_SIZE.width), 320);
    const height = Math.max(Math.round(bounds?.height ?? REPOSITORY_GRAPH_FORCE_SIZE.height), 240);

    const inputNodes = graphNodes.map((node) => ({
      id: node.id,
      width: REPO_GRAPH_NODE_WIDTH,
      height: REPO_GRAPH_NODE_HEIGHT
    }));
    const inputEdges = graphEdges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to
    }));

    const scheduleLayout = () => {
      const positions = layoutWithForce(inputNodes, inputEdges, { width, height });
      if (version !== layoutVersionRef.current) return;

      setNodes(toRepoFlowNodes(graphNodes, positions, activeNodeId));
      setEdges(toRepoFlowEdges(graphEdges));

      requestAnimationFrame(() => {
        void fitView({ padding: 0.22, duration: 280 });
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(scheduleLayout, { timeout: 120 });
    } else {
      scheduleLayout();
    }
  }, [graphNodes, graphEdges, activeNodeId, setNodes, setEdges, fitView]);

  useEffect(() => {
    runForceLayout();
  }, [runForceLayout]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: activeNodeId === node.id
      }))
    );
  }, [activeNodeId, setNodes]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[220px] flex-1" ref={containerRef}>
        {graphNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center font-mono text-[10px] text-[#717A75]">
            Run an audit to populate the repository knowledge graph (repo, CI, issues).
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={repoGraphNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_event, node) => onSelectNode?.(node.id)}
            nodesConnectable={false}
            nodesDraggable
            elementsSelectable={Boolean(onSelectNode)}
            fitView
            minZoom={0.15}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
            className="premortem-repo-graph-flow"
          >
            <Background gap={18} size={1.2} color="#D8D2C8" />
            <Controls showInteractive={false} className="!border-[#EAE6DF] !shadow-sm" />
            <MiniMap
              pannable
              zoomable
              className="!border-[#EAE6DF] !bg-white/95"
              nodeColor={(node) => (node.data as RepoGraphFlowNode['data']).color}
              maskColor="rgba(253, 253, 253, 0.7)"
            />
          </ReactFlow>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[#EAE6DF] px-1 py-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#8A958F]">
          Entity types
        </p>
        <div className="flex flex-wrap gap-2">
          {entityTypes.map((entry) => (
            <span
              key={entry.name}
              className="inline-flex items-center gap-1.5 rounded border border-[#EAE6DF] bg-white px-2 py-1 font-mono text-[9px] text-[#4A5550]"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name} ({entry.count})
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {AUDIT_PARALLEL_LANES.map((lane) => (
            <div key={lane.id} className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-2">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase text-[#3C4A42]">
                {lane.id === 'structure' ? <Network size={11} /> : <GitBranch size={11} />}
                {lane.label}
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-[#717A75]">{lane.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkflowGraphPanel({
  nodes,
  edges,
  nodeCount,
  edgeCount,
  memoryUpdating = false,
  activeNodeId,
  onSelectNode
}: WorkflowGraphPanelProps) {
  return (
    <div className="flex h-full flex-col bg-[#FDFDFD]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#EAE6DF] px-4 py-2.5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8A958F]">
            Repository Graph
          </p>
          <p className="text-[11px] text-[#5C6560]">
            {nodeCount ?? nodes.length} nodes · {edgeCount ?? edges.length} edges · force layout
          </p>
        </div>
        {memoryUpdating ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[9px] font-bold uppercase text-amber-800">
            <span className="h-1.5 w-1.5 motion-safe:animate-ping rounded-full bg-amber-500" />
            Graph updating
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <ReactFlowProvider>
          <RepositoryGraphFlow
            graphNodes={nodes}
            graphEdges={edges}
            activeNodeId={activeNodeId}
            onSelectNode={onSelectNode}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

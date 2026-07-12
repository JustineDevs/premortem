'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  useReactFlow
} from '@xyflow/react';
import {
  PIPELINE_NODE_HEIGHT,
  PIPELINE_NODE_WIDTH,
  pipelineNodeTypes,
  type PipelineStepFlowNode
} from './workflow-pipeline-node';
import { swarmNodeTypes, type SwarmAgentFlowNode } from './workflow-swarm-agent-node';

export interface WorkflowCanvasNode {
  id: string;
  label: string;
  description: string;
  status: string;
  meta?: string;
  icon: React.ReactNode;
  statusClassName: string;
  cardClassName: string;
}

export interface WorkflowCanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  active?: boolean;
  completed?: boolean;
}

export interface WorkflowCanvasBoardHandle {
  resetLayout: () => void;
  resetCamera: () => void;
}

export interface WorkflowCanvasBoardProps {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  activeNodeId: string | null;
  activeEdgeId: string | null;
  agentRuns?: Array<{
    id: string;
    agentName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  selectedAgentRunId?: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onSelectAgentRun?: (id: string | null) => void;
  onClearSelection: () => void;
}

function toFlowNodes(
  boardNodes: WorkflowCanvasNode[],
  positions: Map<string, { x: number; y: number }>,
  activeNodeId: string | null
): PipelineStepFlowNode[] {
  return boardNodes.map((node, index) => ({
    id: node.id,
    type: 'pipelineStep',
    position: positions.get(node.id) ?? { x: index * 280, y: 0 },
    data: {
      label: node.label,
      description: node.description,
      status: node.status,
      meta: node.meta,
      icon: node.icon,
      statusClassName: node.statusClassName,
      cardClassName: node.cardClassName
    },
    selected: activeNodeId === node.id
  }));
}

function agentLaneForName(agentName: string): 'structure' | 'runtime' {
  const normalized = agentName.toLowerCase();
  if (
    normalized.includes('topology') ||
    normalized.includes('dependency') ||
    normalized.includes('artifact') ||
    normalized.includes('manifest') ||
    normalized.includes('struct')
  ) {
    return 'structure';
  }
  return 'runtime';
}

function buildSwarmPositions(
  agentRuns: WorkflowCanvasBoardProps['agentRuns'],
  anchor: { x: number; y: number } | null,
  containerWidth: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (!anchor || !agentRuns || agentRuns.length === 0) {
    return positions;
  }

  const columns = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(agentRuns.length))));
  const cardWidth = 190;
  const cardHeight = 72;
  const gapX = 18;
  const gapY = 18;
  const startX = Math.min(Math.max(32, anchor.x + PIPELINE_NODE_WIDTH + 84), Math.max(32, containerWidth - (columns * cardWidth + (columns - 1) * gapX) - 32));
  const startY = Math.max(32, anchor.y - 42);

  agentRuns.forEach((run, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(run.id, {
      x: startX + column * (cardWidth + gapX),
      y: startY + row * (cardHeight + gapY)
    });
  });

  return positions;
}

function toFlowEdges(boardEdges: WorkflowCanvasEdge[]): Edge[] {
  return boardEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: 'smoothstep',
    animated: edge.active,
    style: {
      stroke: edge.active ? '#047857' : edge.completed ? '#10B981' : '#CDC7BD',
      strokeWidth: edge.active ? 2.5 : 2
    },
    labelStyle: {
      fontSize: 8,
      fontFamily: 'ui-monospace, monospace',
      fill: edge.active ? '#FAF8F5' : '#5C6560'
    },
    labelBgStyle: {
      fill: edge.active ? '#064E3B' : '#FFFFFF',
      fillOpacity: 0.95
    },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.active ? '#047857' : edge.completed ? '#10B981' : '#8A958F'
    }
  }));
}

function buildPipelineGridPositions(
  boardNodes: WorkflowCanvasNode[],
  containerWidth: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (boardNodes.length === 0) {
    return positions;
  }

  const columns = boardNodes.length <= 2 ? boardNodes.length : 2;

  const horizontalGap = 72;
  const verticalGap = 84;
  const columnStep = PIPELINE_NODE_WIDTH + horizontalGap;
  const rowStep = PIPELINE_NODE_HEIGHT + verticalGap;
  const totalWidth = columns * PIPELINE_NODE_WIDTH + (columns - 1) * horizontalGap;
  const offsetX = Math.max(0, Math.round((containerWidth - totalWidth) / 2));
  const offsetY = 24;

  boardNodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(node.id, {
      x: offsetX + column * columnStep,
      y: offsetY + row * rowStep
    });
  });

  return positions;
}

function buildBoardSignature(
  boardNodes: WorkflowCanvasNode[],
  boardEdges: WorkflowCanvasEdge[],
  agentRuns: WorkflowCanvasBoardProps['agentRuns'],
  containerWidth: number
) {
  return [
    containerWidth,
    boardNodes.map((node) => node.id).join('|'),
    boardEdges.map((edge) => edge.id).join('|'),
    agentRuns?.map((run) => `${run.id}:${run.status}`).join('|') ?? 'no-agent-runs'
  ].join('::');
}

function PipelineFlowCanvas({
  boardNodes,
  boardEdges,
  activeNodeId,
  activeEdgeId,
  agentRuns,
  selectedAgentRunId,
  onSelectNode,
  onSelectEdge,
  onSelectAgentRun,
  onClearSelection,
  layoutRequestRef,
  isVisible,
  containerWidth
}: {
  boardNodes: WorkflowCanvasNode[];
  boardEdges: WorkflowCanvasEdge[];
  activeNodeId: string | null;
  activeEdgeId: string | null;
  agentRuns?: WorkflowCanvasBoardProps['agentRuns'];
  selectedAgentRunId?: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onSelectAgentRun?: (id: string | null) => void;
  onClearSelection: () => void;
  layoutRequestRef: React.MutableRefObject<(() => void) | null>;
  isVisible: boolean;
  containerWidth: number;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineStepFlowNode | SwarmAgentFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const activeNodeIdRef = useRef(activeNodeId);
  const lastRenderedSignatureRef = useRef<string | null>(null);
  const gridPositions = useMemo(
    () => buildPipelineGridPositions(boardNodes, containerWidth),
    [boardNodes, containerWidth]
  );
  const boardSignature = useMemo(
    () =>
      buildBoardSignature(
        boardNodes,
        boardEdges,
        agentRuns,
        containerWidth
      ),
    [agentRuns, boardEdges, boardNodes, containerWidth]
  );
  const nextFlowNodes = useMemo(
    () => toFlowNodes(boardNodes, gridPositions, activeNodeId),
    [activeNodeId, boardNodes, gridPositions]
  );
  const nextFlowEdges = useMemo(() => toFlowEdges(boardEdges), [boardEdges]);
  const swarmAnchor = useMemo(
    () => gridPositions.get('node-run-audit') ?? null,
    [gridPositions]
  );
  const swarmPositions = useMemo(
    () => buildSwarmPositions(agentRuns, swarmAnchor, containerWidth),
    [agentRuns, containerWidth, swarmAnchor]
  );
  const showSwarmLayer = Boolean(
    agentRuns?.length && (activeNodeId === 'node-run-audit' || selectedAgentRunId)
  );
  const swarmNodes = useMemo<SwarmAgentFlowNode[]>(
    () =>
      showSwarmLayer && agentRuns
        ? agentRuns.slice(0, 11).map((run, index) => ({
            id: `agent:${run.id}`,
            type: 'swarmAgentStep',
            position: swarmPositions.get(run.id) ?? {
              x: (swarmAnchor?.x ?? 0) + 340 + (index % 3) * 208,
              y: (swarmAnchor?.y ?? 0) + Math.floor(index / 3) * 90
            },
            draggable: false,
            data: {
              label: run.agentName,
              status: run.status,
              lane: agentLaneForName(run.agentName),
              tokenCount: null,
              badge: agentLaneForName(run.agentName),
              isSelected: selectedAgentRunId === run.id
            },
            selected: selectedAgentRunId === run.id
          }))
        : [],
    [agentRuns, selectedAgentRunId, showSwarmLayer, swarmPositions, swarmAnchor]
  );
  const swarmEdges = useMemo<Edge[]>(
    () =>
      showSwarmLayer && agentRuns
        ? agentRuns.slice(0, 11).map((run, index) => ({
            id: `swarm-edge-${run.id}`,
            source: 'node-run-audit',
            target: `agent:${run.id}`,
            type: 'smoothstep',
            animated: run.status === 'running',
            style: {
              stroke: run.status === 'completed' || run.status === 'published' ? '#10B981' : '#F59E0B',
              strokeWidth: 1.5,
              strokeDasharray: run.status === 'running' ? '6 4' : '4 4'
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: run.status === 'completed' || run.status === 'published' ? '#10B981' : '#F59E0B'
            },
            label: index < 3 ? run.agentName : undefined,
            labelStyle: {
              fontSize: 7,
              fontFamily: 'ui-monospace, monospace',
              fill: '#5C6560'
            }
          }))
        : [],
    [agentRuns, showSwarmLayer]
  );

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    if (!isVisible) return;
    if (lastRenderedSignatureRef.current === boardSignature) return;
    lastRenderedSignatureRef.current = boardSignature;
    setNodes(nextFlowNodes);
    setEdges([...nextFlowEdges, ...swarmEdges]);
    requestAnimationFrame(() => {
      void fitView({ padding: 0.1, duration: 280 });
    });
  }, [boardSignature, fitView, isVisible, nextFlowEdges, nextFlowNodes, setEdges, setNodes, swarmEdges]);

  useEffect(() => {
    if (!isVisible) return;
    setNodes(toFlowNodes(boardNodes, gridPositions, activeNodeId));
    setEdges([...toFlowEdges(boardEdges), ...swarmEdges]);
  }, [
    activeNodeId,
    boardEdges,
    boardNodes,
    gridPositions,
    isVisible,
    selectedAgentRunId,
    setEdges,
    setNodes,
    swarmEdges
  ]);

  useEffect(() => {
    layoutRequestRef.current = () => {
      const signature = buildBoardSignature(
        boardNodes,
        boardEdges,
        agentRuns,
        containerWidth
      );
      if (lastRenderedSignatureRef.current === signature) return;
      lastRenderedSignatureRef.current = signature;
      setNodes(toFlowNodes(boardNodes, gridPositions, activeNodeIdRef.current));
      setEdges([...toFlowEdges(boardEdges), ...swarmEdges]);
      requestAnimationFrame(() => {
        void fitView({ padding: 0.1, duration: 280 });
      });
    };
    return () => {
      layoutRequestRef.current = null;
    };
  }, [agentRuns, boardEdges, boardNodes, containerWidth, fitView, gridPositions, layoutRequestRef, swarmEdges, setEdges, setNodes]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('agent:')) {
        onSelectNode('node-run-audit');
        onSelectAgentRun?.(node.id.slice('agent:'.length));
        return;
      }
      onSelectAgentRun?.(null);
      onSelectNode(node.id);
    },
    [onSelectAgentRun, onSelectNode]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onSelectEdge(edge.id);
    },
    [onSelectEdge]
  );

  const onPaneClick = useCallback(() => {
    onSelectAgentRun?.(null);
    onClearSelection();
  }, [onClearSelection, onSelectAgentRun]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={[...nodes, ...swarmNodes]}
        edges={edges}
        nodeTypes={{ ...pipelineNodeTypes, ...swarmNodeTypes }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesConnectable={false}
        nodesDraggable
        snapToGrid
        snapGrid={[24, 24]}
        elementsSelectable
        fitView
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        className="premortem-workflow-flow h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <Background gap={24} size={1.2} color="#EAE6DF" />
        <Controls showInteractive={false} className="!border-[#EAE6DF] !shadow-sm" />
        <MiniMap
          pannable
          zoomable
          className="!border-[#EAE6DF] !bg-white/95"
          nodeColor="#064E3B"
          maskColor="rgba(250, 248, 245, 0.65)"
        />
      </ReactFlow>
    </div>
  );
}

export const WorkflowCanvasBoard = forwardRef<
  WorkflowCanvasBoardHandle,
  WorkflowCanvasBoardProps
>(function WorkflowCanvasBoard(
  {
    nodes: boardNodes,
    edges: boardEdges,
    activeNodeId,
    activeEdgeId,
    agentRuns,
    selectedAgentRunId,
    onSelectNode,
    onSelectEdge,
    onSelectAgentRun,
    onClearSelection
  },
  ref
) {
  const layoutRequestRef = useRef<(() => void) | null>(null);
  const fitViewRef = useRef<(() => void) | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useImperativeHandle(ref, () => ({
    resetLayout: () => layoutRequestRef.current?.(),
    resetCamera: () => fitViewRef.current?.()
  }));

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateVisibility = () => {
      const { width, height } = element.getBoundingClientRect();
      setContainerSize({ width, height });
      setIsVisible(width > 0 && height > 0);
    };

    updateVisibility();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateVisibility);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-[520px] w-full overflow-hidden rounded-lg border border-[#EAE6DF] bg-[#FAF8F5]"
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded border border-[#EAE6DF] bg-white/95 px-2 py-1 font-mono text-[9px] text-[#5C6560] shadow-sm">
        Drag nodes · Snap to grid · Scroll to zoom · Grid layout
      </div>
      {isVisible ? (
        <ReactFlowProvider>
          <FitViewBridge fitViewRef={fitViewRef} />
          <PipelineFlowCanvas
            boardNodes={boardNodes}
            boardEdges={boardEdges}
            activeNodeId={activeNodeId}
            activeEdgeId={activeEdgeId}
            agentRuns={agentRuns}
            selectedAgentRunId={selectedAgentRunId}
            onSelectNode={onSelectNode}
            onSelectEdge={onSelectEdge}
            onSelectAgentRun={onSelectAgentRun}
            onClearSelection={onClearSelection}
            layoutRequestRef={layoutRequestRef}
            isVisible={isVisible}
            containerWidth={containerSize.width}
          />
        </ReactFlowProvider>
      ) : (
        <div className="flex h-full min-h-[520px] items-center justify-center px-6 text-center font-mono text-[10px] uppercase tracking-wider text-[#8A958F]">
          Preparing workflow canvas…
        </div>
      )}
    </div>
  );
});

function FitViewBridge({
  fitViewRef
}: {
  fitViewRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    fitViewRef.current = () => {
      void fitView({ padding: 0.1, duration: 280 });
    };
    return () => {
      fitViewRef.current = null;
    };
  }, [fitView, fitViewRef]);

  return null;
}

export function WorkflowCanvasControls({
  onResetLayout,
  onResetCamera
}: {
  onResetLayout: () => void;
  onResetCamera: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-[#FAF8F5] p-1">
      <button
        type="button"
        onClick={onResetLayout}
        className="cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#5C6560] transition-colors hover:bg-white hover:text-[#1E2522] focus-visible:outline-none focus-visible:ring-0"
        title="Re-run grid layout"
      >
        Reset layout
      </button>
      <button
        type="button"
        onClick={onResetCamera}
        className="flex cursor-pointer items-center gap-1 rounded-md border border-transparent px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#5C6560] transition-colors hover:bg-white hover:text-[#1E2522] focus-visible:outline-none focus-visible:ring-0"
        title="Reset pan and zoom"
      >
        <RotateCcw size={10} aria-hidden />
        Reset view
      </button>
    </div>
  );
}

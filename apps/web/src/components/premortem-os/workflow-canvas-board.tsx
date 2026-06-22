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

interface WorkflowCanvasBoardProps {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  activeNodeId: string | null;
  activeEdgeId: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
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

function PipelineFlowCanvas({
  boardNodes,
  boardEdges,
  activeNodeId,
  activeEdgeId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  layoutRequestRef,
  isVisible,
  containerWidth
}: {
  boardNodes: WorkflowCanvasNode[];
  boardEdges: WorkflowCanvasEdge[];
  activeNodeId: string | null;
  activeEdgeId: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
  layoutRequestRef: React.MutableRefObject<(() => void) | null>;
  isVisible: boolean;
  containerWidth: number;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineStepFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const activeNodeIdRef = useRef(activeNodeId);
  const gridPositions = useMemo(
    () => buildPipelineGridPositions(boardNodes, containerWidth),
    [boardNodes, containerWidth]
  );

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    if (!isVisible) return;
    setNodes(toFlowNodes(boardNodes, gridPositions, activeNodeIdRef.current));
    setEdges(toFlowEdges(boardEdges));
    requestAnimationFrame(() => {
      void fitView({ padding: 0.1, duration: 280 });
    });
  }, [activeNodeId, boardEdges, boardNodes, fitView, gridPositions, isVisible, setEdges, setNodes]);

  useEffect(() => {
    layoutRequestRef.current = () => {
      setNodes(toFlowNodes(boardNodes, gridPositions, activeNodeIdRef.current));
      setEdges(toFlowEdges(boardEdges));
      requestAnimationFrame(() => {
        void fitView({ padding: 0.1, duration: 280 });
      });
    };
    return () => {
      layoutRequestRef.current = null;
    };
  }, [boardEdges, boardNodes, fitView, gridPositions, layoutRequestRef, setEdges, setNodes]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onSelectEdge(edge.id);
    },
    [onSelectEdge]
  );

  const onPaneClick = useCallback(() => {
    onClearSelection();
  }, [onClearSelection]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={pipelineNodeTypes}
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
      className="premortem-workflow-flow"
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
    onSelectNode,
    onSelectEdge,
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
            onSelectNode={onSelectNode}
            onSelectEdge={onSelectEdge}
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
    <div className="flex items-center gap-1 rounded border border-[#EAE6DF] bg-[#FAF8F5] p-1">
      <button
        type="button"
        onClick={onResetLayout}
        className="cursor-pointer rounded px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#5C6560] transition-colors hover:bg-white hover:text-[#1E2522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950"
        title="Re-run grid layout"
      >
        Reset layout
      </button>
      <button
        type="button"
        onClick={onResetCamera}
        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#5C6560] transition-colors hover:bg-white hover:text-[#1E2522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950"
        title="Reset pan and zoom"
      >
        <RotateCcw size={10} aria-hidden />
        Reset view
      </button>
    </div>
  );
}

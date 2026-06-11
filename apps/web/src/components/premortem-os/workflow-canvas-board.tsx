'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
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
  PIPELINE_ELK_OPTIONS,
  layoutWithElk
} from './workflow-elk-layout';
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

function PipelineFlowCanvas({
  boardNodes,
  boardEdges,
  activeNodeId,
  activeEdgeId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  layoutRequestRef
}: {
  boardNodes: WorkflowCanvasNode[];
  boardEdges: WorkflowCanvasEdge[];
  activeNodeId: string | null;
  activeEdgeId: string | null;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
  layoutRequestRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineStepFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutVersionRef = useRef(0);
  const activeNodeIdRef = useRef(activeNodeId);

  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  const runElkLayout = useCallback(
    async (fitAfter = false) => {
      const version = ++layoutVersionRef.current;
      const inputNodes = boardNodes.map((node) => ({
        id: node.id,
        width: PIPELINE_NODE_WIDTH,
        height: PIPELINE_NODE_HEIGHT
      }));
      const inputEdges = boardEdges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to
      }));

      const positions = await layoutWithElk(inputNodes, inputEdges, PIPELINE_ELK_OPTIONS);
      if (version !== layoutVersionRef.current) return;

      setNodes(toFlowNodes(boardNodes, positions, activeNodeIdRef.current));
      setEdges(toFlowEdges(boardEdges));

      if (fitAfter) {
        requestAnimationFrame(() => {
          void fitView({ padding: 0.18, duration: 280 });
        });
      }
    },
    [boardNodes, boardEdges, setNodes, setEdges, fitView]
  );

  useEffect(() => {
    void runElkLayout(true);
  }, [runElkLayout]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: activeNodeId === node.id
      }))
    );
    setEdges(toFlowEdges(boardEdges));
  }, [activeNodeId, boardEdges, setNodes, setEdges]);

  useEffect(() => {
    layoutRequestRef.current = () => {
      void runElkLayout(true);
    };
    return () => {
      layoutRequestRef.current = null;
    };
  }, [layoutRequestRef, runElkLayout]);

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

  useImperativeHandle(ref, () => ({
    resetLayout: () => layoutRequestRef.current?.(),
    resetCamera: () => fitViewRef.current?.()
  }));

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-lg border border-[#EAE6DF] bg-[#FAF8F5]">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded border border-[#EAE6DF] bg-white/95 px-2 py-1 font-mono text-[9px] text-[#5C6560] shadow-sm">
        Drag nodes · Scroll to zoom · ELK auto-layout
      </div>
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
        />
      </ReactFlowProvider>
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
      void fitView({ padding: 0.18, duration: 280 });
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
        title="Re-run ELK layout"
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

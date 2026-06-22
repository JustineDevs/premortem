'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY
} from 'd3-force';
import { drag as d3Drag, type D3DragEvent } from 'd3-drag';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import 'd3-transition';
import type { Simulation } from 'd3-force';

import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

type GraphNodeDatum = WorkflowGraphNode & {
  degree: number;
  radius: number;
  color: string;
  enteredAt: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

type GraphLinkDatum = {
  id: string;
  label?: string;
  sourceId: string;
  targetId: string;
  source: string | number | GraphNodeDatum;
  target: string | number | GraphNodeDatum;
};

interface WorkflowD3GraphProps {
  graphNodes: WorkflowGraphNode[];
  graphEdges: WorkflowGraphEdge[];
  selectedGraphNodeId?: string | null;
  selectedEdgeId?: string | null;
  memoryUpdating?: boolean;
  showEdgeLabels?: boolean;
  emptyMessage?: string;
  semanticIncluded?: boolean;
  phoenixConfigured?: boolean;
  onSelectGraphNode?: (id: string | null) => void;
  onSelectGraphEdge?: (id: string | null) => void;
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

const DEFAULT_VIEW_SCALE = 0.82;
const MIN_VIEW_SCALE = 0.45;
const MAX_VIEW_SCALE = 1.9;
const TEMPORAL_ENTRY_MS = 120;
const BASE_NODE_RADIUS = 6;
const MAX_NODE_RADIUS = 18;

type CanvasSize = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function colorForType(type: string, index: number, lane?: WorkflowGraphNode['lane']): string {
  if (lane === 'structure') return '#004E89';
  if (lane === 'runtime') return '#1A936F';
  if (type === 'repo') return '#1A936F';
  if (type === 'file' || type === 'pipeline') return '#004E89';
  if (type === 'pipeline_run') return '#7B2D8E';
  if (type === 'ci_job') return '#C5283D';
  if (type === 'issue') return '#E9724C';
  if (type === 'package') return '#3498db';
  if (type === 'service') return '#27ae60';
  if (type === 'structure') return '#004E89';
  if (type === 'runtime') return '#1A936F';
  if (type === 'semantic') return '#6B4E9B';
  if (type === 'chain') return '#6B4E9B';
  if (type === 'llm') return '#E9724C';
  if (type === 'agent') return '#7B2D8E';
  if (type === 'tool') return '#004E89';
  if (type === 'retriever') return '#3498db';
  return TYPE_COLORS[index % TYPE_COLORS.length] ?? '#1A936F';
}

function degreeRadius(degree: number) {
  return clamp(BASE_NODE_RADIUS + Math.min(degree, 8) * 1.5, BASE_NODE_RADIUS, MAX_NODE_RADIUS);
}

function laneAnchor(node: WorkflowGraphNode, width: number, height: number) {
  if (node.lane === 'structure') return { x: width * 0.32, y: height * 0.42 };
  if (node.lane === 'runtime') return { x: width * 0.68, y: height * 0.56 };
  if (node.lane === 'pipeline') return { x: width * 0.5, y: height * 0.28 };
  if (node.lane === 'semantic') return { x: width * 0.54, y: height * 0.22 };
  if (node.type === 'repo') return { x: width * 0.26, y: height * 0.48 };
  if (node.type === 'pipeline' || node.type === 'pipeline_run') return { x: width * 0.56, y: height * 0.34 };
  if (node.type === 'llm' || node.type === 'agent') return { x: width * 0.58, y: height * 0.32 };
  return { x: width * 0.5, y: height * 0.5 };
}

export function WorkflowD3Graph({
  graphNodes,
  graphEdges,
  selectedGraphNodeId = null,
  selectedEdgeId = null,
  memoryUpdating = false,
  showEdgeLabels = true,
  emptyMessage,
  semanticIncluded = false,
  phoenixConfigured = false,
  onSelectGraphNode,
  onSelectGraphEdge
}: WorkflowD3GraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<SVGGElement | null>(null);
  const linkLayerRef = useRef<SVGGElement | null>(null);
  const linkLabelLayerRef = useRef<SVGGElement | null>(null);
  const nodeLayerRef = useRef<SVGGElement | null>(null);
  const simulationRef = useRef<Simulation<GraphNodeDatum, GraphLinkDatum> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const seedPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const initializedGraphRef = useRef<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [visibleCount, setVisibleCount] = useState(0);

  const graphSignature = useMemo(
    () => `${graphNodes.map((node) => node.id).join('|')}::${graphEdges.map((edge) => edge.id).join('|')}`,
    [graphEdges, graphNodes]
  );

  const graphWidth = Math.max(canvasSize.width, 640);
  const graphHeight = Math.max(canvasSize.height, 220);

  const degreeMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of graphEdges) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [graphEdges]);

  const visibleNodes = useMemo(() => {
    return memoryUpdating ? graphNodes.slice(0, visibleCount) : graphNodes;
  }, [graphNodes, memoryUpdating, visibleCount]);

  const visibleNodeSet = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const activeLinks = useMemo(() => {
    return graphEdges.filter((edge) => visibleNodeSet.has(edge.from) && visibleNodeSet.has(edge.to));
  }, [graphEdges, visibleNodeSet]);

  useEffect(() => {
    const element = svgRef.current?.parentElement;
    if (!element) return;

    const updateSize = () => {
      const { width, height } = element.getBoundingClientRect();
      setCanvasSize({
        width: Math.max(Math.round(width), 640),
        height: Math.max(Math.round(height), 220)
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (memoryUpdating) {
      setVisibleCount(0);
      let cancelled = false;
      const start = performance.now();

      const step = () => {
        if (cancelled) return;
        const elapsed = performance.now() - start;
        const next = Math.min(graphNodes.length, Math.floor(elapsed / TEMPORAL_ENTRY_MS));
        setVisibleCount((current) => (next > current ? next : current));
        if (next < graphNodes.length) {
          window.requestAnimationFrame(step);
        }
      };

      const rafId = window.requestAnimationFrame(step);
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
      };
    }

    setVisibleCount(graphNodes.length);
    return undefined;
  }, [graphNodes.length, memoryUpdating]);

  useEffect(() => {
    if (!svgRef.current || !viewportRef.current || !linkLayerRef.current || !nodeLayerRef.current) {
      return;
    }

    const svg = select(svgRef.current);
    const viewport = select(viewportRef.current);
    const linkLayer = select(linkLayerRef.current);
    const linkLabelLayer = select(linkLabelLayerRef.current);
    const nodeLayer = select(nodeLayerRef.current);
    const currentNodes = visibleNodes.map((node, index): GraphNodeDatum => {
      const degree = degreeMap.get(node.id) ?? 0;
      const radius = degreeRadius(degree);
      const seed = seedPositionsRef.current.get(node.id);
      const anchor = laneAnchor(node, graphWidth, graphHeight);
      const spread = 28 + (index % 4) * 4;
      const angle = (index % 8) * (Math.PI / 4);
      return {
        ...node,
        degree,
        radius,
        color: colorForType(node.lane ?? node.type, index, node.lane),
        enteredAt: performance.now(),
        x: seed?.x ?? anchor.x + Math.cos(angle) * spread,
        y: seed?.y ?? anchor.y + Math.sin(angle) * spread,
        vx: 0,
        vy: 0
      };
    });

    const currentNodeIds = new Set(currentNodes.map((node) => node.id));
    const currentLinks: GraphLinkDatum[] = activeLinks.map((edge) => ({
      id: edge.id,
      label: edge.label?.trim() || undefined,
      sourceId: edge.from,
      targetId: edge.to,
      source: edge.from,
      target: edge.to
    }));

    simulationRef.current?.stop();
    simulationRef.current = null;

    const nodeLookup = new Map(currentNodes.map((node) => [node.id, node]));
    const linkData = currentLinks.filter((edge) => currentNodeIds.has(edge.sourceId) && currentNodeIds.has(edge.targetId));

    const linkSelection = linkLayer
      .selectAll<SVGLineElement, GraphLinkDatum>('line.graph-link')
      .data(linkData, (d: GraphLinkDatum) => d.id)
      .join(
        (enter) =>
          enter
            .append('line')
            .attr('class', 'graph-link')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.2)
            .attr('stroke-opacity', 0.6)
            .attr('stroke', '#B8B0A6')
            .style('cursor', 'pointer'),
        (update) => update,
        (exit) => exit.remove()
      );

    const linkLabelSelection = linkLabelLayer
      .selectAll<SVGTextElement, GraphLinkDatum>('text.graph-edge-label')
      .data(showEdgeLabels ? linkData.filter((edge) => Boolean(edge.label)) : [], (d: GraphLinkDatum) => d.id)
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'graph-edge-label')
            .attr('text-anchor', 'middle')
            .attr('dy', -8)
            .attr('fill', '#D7E4DA')
            .attr('font-size', 8)
            .attr('font-family', 'monospace')
            .attr('letter-spacing', '0.2em')
            .attr('text-transform', 'uppercase')
            .style('pointer-events', 'none')
            .style('user-select', 'none'),
        (update) => update,
        (exit) => exit.remove()
      );

    const dragBehavior = d3Drag<SVGGElement, GraphNodeDatum>()
      .clickDistance(4)
      .on('start', (event: D3DragEvent<SVGGElement, GraphNodeDatum, GraphNodeDatum>, d: GraphNodeDatum) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.25).restart();
        d.fx = d.x ?? null;
        d.fy = d.y ?? null;
      })
      .on('drag', (event: D3DragEvent<SVGGElement, GraphNodeDatum, GraphNodeDatum>, d: GraphNodeDatum) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: D3DragEvent<SVGGElement, GraphNodeDatum, GraphNodeDatum>, d: GraphNodeDatum) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const nodeSelection = nodeLayer
      .selectAll<SVGGElement, GraphNodeDatum>('g.graph-node')
      .data(currentNodes, (d: GraphNodeDatum) => d.id)
      .join(
        (enter) => {
          const group = enter
            .append('g')
            .attr('class', 'graph-node')
            .attr('role', 'button')
            .style('cursor', 'grab')
            .style('pointer-events', 'all')
            .style('opacity', 0);

          group
            .append('circle')
            .attr('class', 'graph-node-hit')
            .attr('r', (d) => Math.max(22, d.radius + 10))
            .attr('fill', 'transparent')
            .style('pointer-events', 'all');

          group
            .append('circle')
            .attr('class', 'graph-node-core')
            .attr('r', (d) => d.radius)
            .attr('fill', (d) => d.color)
            .attr('stroke-width', 0)
            .attr('opacity', 0.92);

          group.append('title').text((d) => d.label);

          group.transition().duration(200).style('opacity', 1);
          return group;
        },
        (update) => update,
        (exit) => exit.transition().duration(140).style('opacity', 0).remove()
      );

    const activeNodeIds = new Set<string>();
    if (selectedGraphNodeId) {
      activeNodeIds.add(selectedGraphNodeId);
      for (const edge of linkData) {
        if (edge.sourceId === selectedGraphNodeId) activeNodeIds.add(edge.targetId);
        if (edge.targetId === selectedGraphNodeId) activeNodeIds.add(edge.sourceId);
      }
    }

    const renderStyles = () => {
      nodeSelection
        .attr('opacity', (d) =>
        selectedGraphNodeId && !activeNodeIds.has(d.id) ? 0.62 : 1
        )
        .each(function updateNodeStyles(this: SVGGElement, d: GraphNodeDatum) {
          const isSelected = selectedGraphNodeId === d.id;
          const isConnected = activeNodeIds.has(d.id);
          select(this)
            .select<SVGCircleElement>('circle.graph-node-core')
            .attr('stroke', isSelected ? '#064E3B' : 'transparent')
            .attr('stroke-width', isSelected ? 2 : 0)
            .attr('opacity', isConnected ? 1 : 0.84);
        });

      linkSelection
        .attr('stroke', (d: GraphLinkDatum) => (selectedEdgeId === d.id ? '#D6B4FF' : '#B8B0A6'))
        .attr('stroke-width', (d: GraphLinkDatum) => (selectedEdgeId === d.id ? 2 : 1.2))
        .attr('stroke-opacity', (d: GraphLinkDatum) => (selectedEdgeId === d.id ? 1 : 0.6));

      linkLabelSelection
        .attr('fill', (d: GraphLinkDatum) => (selectedEdgeId === d.id ? '#E7D9FF' : '#D7E4DA'))
        .text((d: GraphLinkDatum) => d.label ?? '');
    };

    nodeSelection
      .on('click', function onNodeClick(this: SVGGElement, event: MouseEvent, d: GraphNodeDatum) {
        event.stopPropagation();
        onSelectGraphEdge?.(null);
        onSelectGraphNode?.(d.id);
      })
      .call(dragBehavior as any);

    const simulation = forceSimulation<GraphNodeDatum>(currentNodes)
      .force(
        'link',
        forceLink<GraphNodeDatum, GraphLinkDatum>(linkData)
          .id((d) => d.id)
          .distance((d: GraphLinkDatum) => {
            const source = nodeLookup.get(d.sourceId);
            const target = nodeLookup.get(d.targetId);
            const sourceDegree = source?.degree ?? 0;
            const targetDegree = target?.degree ?? 0;
            return 96 + Math.max(sourceDegree, targetDegree) * 6;
          })
          .strength(0.75)
      )
      .force('charge', forceManyBody().strength(-280))
      .force('center', forceCenter(graphWidth / 2, graphHeight / 2))
      .force(
        'collide',
        forceCollide<GraphNodeDatum>().radius((d) => d.radius + 8).iterations(2)
      )
      .force(
        'x',
        forceX<GraphNodeDatum>((d: GraphNodeDatum) => laneAnchor(d, graphWidth, graphHeight).x).strength(0.08)
      )
      .force(
        'y',
        forceY<GraphNodeDatum>((d: GraphNodeDatum) => laneAnchor(d, graphWidth, graphHeight).y).strength(0.08)
      )
      .alpha(memoryUpdating ? 1 : 0.92)
      .alphaDecay(memoryUpdating ? 0.035 : 0.028)
      .on('tick', () => {
        linkSelection
          .attr('x1', (d: GraphLinkDatum) => (nodeLookup.get(d.sourceId)?.x ?? 0))
          .attr('y1', (d: GraphLinkDatum) => (nodeLookup.get(d.sourceId)?.y ?? 0))
          .attr('x2', (d: GraphLinkDatum) => (nodeLookup.get(d.targetId)?.x ?? 0))
          .attr('y2', (d: GraphLinkDatum) => (nodeLookup.get(d.targetId)?.y ?? 0));

        linkLabelSelection
          .attr('x', (d: GraphLinkDatum) => {
            const source = nodeLookup.get(d.sourceId);
            const target = nodeLookup.get(d.targetId);
            return ((source?.x ?? 0) + (target?.x ?? 0)) / 2;
          })
          .attr('y', (d: GraphLinkDatum) => {
            const source = nodeLookup.get(d.sourceId);
            const target = nodeLookup.get(d.targetId);
            return ((source?.y ?? 0) + (target?.y ?? 0)) / 2 - 8;
          });

        nodeSelection.attr('transform', (d: GraphNodeDatum) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        renderStyles();
      })
      .on('end', () => {
        renderStyles();
      });

    simulationRef.current = simulation;

    if (initializedGraphRef.current !== graphSignature) {
      initializedGraphRef.current = graphSignature;
      const initialTransform = zoomIdentity.translate(0, 0).scale(DEFAULT_VIEW_SCALE);
      if (!zoomBehaviorRef.current) {
          zoomBehaviorRef.current = d3Zoom<SVGSVGElement, unknown>()
          .scaleExtent([MIN_VIEW_SCALE, MAX_VIEW_SCALE])
          .filter((event: WheelEvent | MouseEvent) => {
            if ((event as WheelEvent).ctrlKey) return false;
            if ((event as MouseEvent).button === 2) return false;
            return true;
          })
          .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
            viewport.attr('transform', event.transform.toString());
          });
      }

      svg.call(zoomBehaviorRef.current as any);
      svg.call(zoomBehaviorRef.current.transform as any, initialTransform);
    } else if (!zoomBehaviorRef.current) {
      zoomBehaviorRef.current = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([MIN_VIEW_SCALE, MAX_VIEW_SCALE])
        .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          viewport.attr('transform', event.transform.toString());
        });
      svg.call(zoomBehaviorRef.current as any);
    }

    svg.on('dblclick.zoom', null);
    renderStyles();

    return () => {
      currentNodes.forEach((node) => {
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
          seedPositionsRef.current.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
        }
      });
      simulation.stop();
    };
  }, [
    activeLinks,
    degreeMap,
    graphHeight,
    graphSignature,
    graphWidth,
    memoryUpdating,
    onSelectGraphEdge,
    onSelectGraphNode,
    selectedEdgeId,
    selectedGraphNodeId,
    showEdgeLabels,
    visibleNodes
  ]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050706] text-[#EAF0EB]">
      {memoryUpdating ? (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-amber-100 backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
          </span>
          Temporal
        </div>
      ) : null}

      {graphNodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-md space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-2xl shadow-black/20">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
              Graph canvas
            </p>
            <p className="text-sm text-[#F4FAF5]">
              {emptyMessage ??
                (phoenixConfigured
                  ? semanticIncluded
                    ? 'Graph snapshot and Phoenix semantic trace spans are ready.'
                    : 'Run an audit to populate the graph snapshot and Phoenix semantic trace spans.'
                  : 'Run an audit to populate the graph snapshot (nodes + links).')}
            </p>
          </div>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <marker
            id="workflow-d3-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#B8C4BD" />
          </marker>
        </defs>

        <g ref={viewportRef}>
          <g ref={linkLayerRef} />
          <g ref={linkLabelLayerRef} />
          <g ref={nodeLayerRef} />
        </g>
      </svg>
    </div>
  );
}

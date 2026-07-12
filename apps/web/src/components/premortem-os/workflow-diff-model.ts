import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

export type WorkflowDiffState = 'new' | 'resolved' | 'unchanged';

export interface WorkflowGraphDiffResult {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  nodeStates: Record<string, WorkflowDiffState>;
  edgeStates: Record<string, WorkflowDiffState>;
}

function mergeById<T extends { id: string }>(current: T[], baseline: T[]): T[] {
  const merged = new Map<string, T>();
  for (const entry of baseline) {
    merged.set(entry.id, entry);
  }
  for (const entry of current) {
    merged.set(entry.id, entry);
  }
  return [...merged.values()];
}

export function buildWorkflowGraphDiff(input: {
  current: { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] };
  baseline: { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] };
}): WorkflowGraphDiffResult {
  const currentNodeIds = new Set(input.current.nodes.map((node) => node.id));
  const baselineNodeIds = new Set(input.baseline.nodes.map((node) => node.id));
  const currentEdgeIds = new Set(input.current.edges.map((edge) => edge.id));
  const baselineEdgeIds = new Set(input.baseline.edges.map((edge) => edge.id));

  const nodeStates: Record<string, WorkflowDiffState> = {};
  const edgeStates: Record<string, WorkflowDiffState> = {};

  for (const node of input.current.nodes) {
    nodeStates[node.id] = baselineNodeIds.has(node.id) ? 'unchanged' : 'new';
  }
  for (const node of input.baseline.nodes) {
    if (!currentNodeIds.has(node.id)) {
      nodeStates[node.id] = 'resolved';
    }
  }

  for (const edge of input.current.edges) {
    edgeStates[edge.id] = baselineEdgeIds.has(edge.id) ? 'unchanged' : 'new';
  }
  for (const edge of input.baseline.edges) {
    if (!currentEdgeIds.has(edge.id)) {
      edgeStates[edge.id] = 'resolved';
    }
  }

  return {
    nodes: mergeById(input.current.nodes, input.baseline.nodes),
    edges: mergeById(input.current.edges, input.baseline.edges),
    nodeStates,
    edgeStates
  };
}


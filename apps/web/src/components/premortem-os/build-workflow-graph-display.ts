import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph-panel';

interface BuildGraphDisplayInput {
  artifactNodes: WorkflowGraphNode[];
  artifactEdges: WorkflowGraphEdge[];
}

function filterEdgesToKnownNodes(
  graphNodes: WorkflowGraphNode[],
  graphEdges: WorkflowGraphEdge[]
): WorkflowGraphEdge[] {
  const nodeIds = new Set(graphNodes.map((node) => node.id));
  return graphEdges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
}

/** Left panel shows audit repository graph only; pipeline steps live on the canvas board. */
export function buildWorkflowGraphDisplay(input: BuildGraphDisplayInput): {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  fromArtifact: boolean;
} {
  if (input.artifactNodes.length === 0) {
    return { nodes: [], edges: [], fromArtifact: false };
  }

  const nodes = input.artifactNodes;
  const edges = filterEdgesToKnownNodes(nodes, input.artifactEdges);
  return { nodes, edges, fromArtifact: true };
}

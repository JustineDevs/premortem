import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

interface BuildGraphDisplayInput {
  artifactNodes: WorkflowGraphNode[];
  artifactEdges: WorkflowGraphEdge[];
  semanticNodes?: WorkflowGraphNode[];
  semanticEdges?: WorkflowGraphEdge[];
}

function filterEdgesToKnownNodes(
  graphNodes: WorkflowGraphNode[],
  graphEdges: WorkflowGraphEdge[]
): WorkflowGraphEdge[] {
  const nodeIds = new Set(graphNodes.map((node) => node.id));
  return graphEdges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
}

/** Left panel merges repository artifact graph with optional Phoenix semantic spans. */
export function buildWorkflowGraphDisplay(input: BuildGraphDisplayInput): {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  fromArtifact: boolean;
  semanticIncluded: boolean;
} {
  const artifactNodes = input.artifactNodes;
  const semanticNodes = input.semanticNodes ?? [];
  const hasArtifact = artifactNodes.length > 0;
  const hasSemantic = semanticNodes.length > 0;

  if (!hasArtifact && !hasSemantic) {
    return { nodes: [], edges: [], fromArtifact: false, semanticIncluded: false };
  }

  const nodes = [...artifactNodes, ...semanticNodes];
  const edges = filterEdgesToKnownNodes(nodes, [
    ...input.artifactEdges,
    ...(input.semanticEdges ?? [])
  ]);

  return {
    nodes,
    edges,
    fromArtifact: hasArtifact,
    semanticIncluded: hasSemantic
  };
}

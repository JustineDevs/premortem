import type { GraphEdge, GraphNode, GraphSnapshotPayload } from '@premortem/graph-model';

export class GraphGroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphGroundingError';
  }
}

export interface GroundedGraphFileContext {
  path: string;
  node: GraphNode;
  incomingEdges: GraphEdge[];
  outgoingEdges: GraphEdge[];
  symbolNodes: GraphNode[];
}

export interface GroundedGraphContext {
  auditRunId: string;
  projectId: string;
  files: GroundedGraphFileContext[];
}

function fileNodeId(path: string) {
  return `source:${path}`;
}

function toPathFromNodeId(nodeId: string) {
  return nodeId.startsWith('source:') ? nodeId.slice('source:'.length) : null;
}

function assertNodeExists(node: GraphNode | undefined, ref: string): GraphNode {
  if (!node) {
    throw new GraphGroundingError(`Missing grounded graph node for ${ref}`);
  }

  return node;
}

function collectEdgesByNode(payload: GraphSnapshotPayload) {
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();

  for (const edge of payload.edges) {
    const nextOutgoing = outgoing.get(edge.from) ?? [];
    nextOutgoing.push(edge);
    outgoing.set(edge.from, nextOutgoing);

    const nextIncoming = incoming.get(edge.to) ?? [];
    nextIncoming.push(edge);
    incoming.set(edge.to, nextIncoming);
  }

  return { incoming, outgoing };
}

export function buildGraphGroundingContext(input: {
  graph: GraphSnapshotPayload;
  sourcePaths?: string[];
}): GroundedGraphContext {
  const { incoming, outgoing } = collectEdgesByNode(input.graph);
  const nodeById = new Map(input.graph.nodes.map((node) => [node.id, node] as const));
  const requestedPaths = input.sourcePaths?.length
    ? [...new Set(input.sourcePaths.filter((path) => path.length > 0))]
    : input.graph.nodes
        .map((node) => toPathFromNodeId(node.id))
        .filter((path): path is string => Boolean(path));

  const files = requestedPaths.map((path) => {
    const node = assertNodeExists(nodeById.get(fileNodeId(path)), path);
    const outgoingEdges = outgoing.get(node.id) ?? [];
    const incomingEdges = incoming.get(node.id) ?? [];

    for (const edge of outgoingEdges) {
      const targetNode = assertNodeExists(nodeById.get(edge.to), `${path} -> ${edge.to}`);
      if (edge.type === 'imports' && !targetNode.id.startsWith('source:')) {
        throw new GraphGroundingError(`Import edge from ${path} points outside the source graph: ${edge.to}`);
      }
      if ((edge.type === 'declares' || edge.type === 'exports') && targetNode.kind !== 'symbol') {
        throw new GraphGroundingError(`Symbol edge from ${path} does not land on a symbol node: ${edge.to}`);
      }
    }

    return {
      path,
      node,
      incomingEdges,
      outgoingEdges,
      symbolNodes: outgoingEdges
        .filter((edge) => edge.type === 'declares' || edge.type === 'exports')
        .map((edge) => assertNodeExists(nodeById.get(edge.to), `${path} -> ${edge.to}`))
    };
  });

  return {
    auditRunId: input.graph.auditRunId,
    projectId: input.graph.projectId,
    files
  };
}

export function requireGraphNode(context: GroundedGraphContext, path: string): GroundedGraphFileContext {
  const file = context.files.find((entry) => entry.path === path);
  if (!file) {
    throw new GraphGroundingError(`Missing required grounded file node: ${path}`);
  }

  return file;
}

export function requireGraphRelation(input: {
  context: GroundedGraphContext;
  fromPath: string;
  toPath: string;
  type?: string;
}): GraphEdge {
  const from = requireGraphNode(input.context, input.fromPath);
  const edge = from.outgoingEdges.find(
    (candidate) =>
      candidate.to === fileNodeId(input.toPath) && (input.type ? candidate.type === input.type : true)
  );

  if (!edge) {
    const relationSuffix = input.type ? ` of type ${input.type}` : '';
    throw new GraphGroundingError(
      `Missing grounded relation${relationSuffix}: ${input.fromPath} -> ${input.toPath}`
    );
  }

  return edge;
}

export function summarizeGraphGrounding(context: GroundedGraphContext) {
  return {
    auditRunId: context.auditRunId,
    projectId: context.projectId,
    fileCount: context.files.length,
    files: context.files.map((file) => ({
      path: file.path,
      incomingEdges: file.incomingEdges.map((edge) => ({
        from: edge.from,
        type: edge.type
      })),
      outgoingEdges: file.outgoingEdges.map((edge) => ({
        to: edge.to,
        type: edge.type
      })),
      symbolNodes: file.symbolNodes.map((node) => ({
        id: node.id,
        label: node.label,
        kind: node.kind
      }))
    }))
  };
}

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation
} from 'd3-force';

export interface ForceLayoutInputNode {
  id: string;
  width: number;
  height: number;
}

export interface ForceLayoutInputEdge {
  id: string;
  source: string;
  target: string;
}

interface SimNode extends ForceLayoutInputNode {
  x: number;
  y: number;
}

export const REPOSITORY_GRAPH_FORCE_SIZE = { width: 720, height: 520 };

/** Force-directed layout for repository knowledge graphs (organic topology, not pipeline lanes). */
export function layoutWithForce(
  nodes: ForceLayoutInputNode[],
  edges: ForceLayoutInputEdge[],
  size: { width: number; height: number }
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) {
    return new Map();
  }

  const simNodes: SimNode[] = nodes.map((node) => ({
    ...node,
    x: size.width / 2 + (Math.random() - 0.5) * 48,
    y: size.height / 2 + (Math.random() - 0.5) * 48
  }));

  const nodeById = new Map(simNodes.map((node) => [node.id, node]));
  const simEdges = edges
    .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: nodeById.get(edge.source)!,
      target: nodeById.get(edge.target)!
    }));

  const nodeRadius = (node: SimNode) => Math.max(node.width, node.height) / 2;

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink(simEdges)
        .id((node) => (node as SimNode).id)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          return source.id === target.id ? 48 : 130;
        })
    )
    .force('charge', forceManyBody().strength(-360))
    .force('center', forceCenter(size.width / 2, size.height / 2))
    .force('collide', forceCollide<SimNode>().radius((node) => nodeRadius(node) + 10))
    .stop();

  const tickCount = Math.min(180, 80 + simNodes.length * 3);
  for (let tick = 0; tick < tickCount; tick += 1) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    positions.set(node.id, {
      x: Math.round(node.x - node.width / 2),
      y: Math.round(node.y - node.height / 2)
    });
  }

  return positions;
}

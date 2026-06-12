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
  kind?: string;
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

function placeNodeCenter(
  positions: Map<string, { x: number; y: number }>,
  node: ForceLayoutInputNode,
  centerX: number,
  centerY: number
) {
  positions.set(node.id, {
    x: Math.round(centerX - node.width / 2),
    y: Math.round(centerY - node.height / 2)
  });
}

function ringRadiusForCount(
  count: number,
  nodeWidth: number,
  size: { width: number; height: number },
  minRadius: number
): number {
  if (count <= 0) return minRadius;
  const arcSpacing = Math.max(nodeWidth + 36, 112);
  const fromCircumference = (count * arcSpacing) / (2 * Math.PI);
  const maxRadius = Math.min(size.width, size.height) / 2 - nodeWidth;
  return Math.min(Math.max(minRadius, fromCircumference, 150), Math.max(maxRadius, minRadius));
}

function placeOnRing(
  nodes: ForceLayoutInputNode[],
  positions: Map<string, { x: number; y: number }>,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle = -Math.PI / 2
) {
  if (nodes.length === 0) return;

  const sorted = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const step = (2 * Math.PI) / sorted.length;

  sorted.forEach((node, index) => {
    const angle = startAngle + step * index;
    placeNodeCenter(
      positions,
      node,
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle)
    );
  });
}

/** Radial hub layout: repo (or highest-degree node) at center, satellites on spaced rings. */
function layoutRadialHub(
  nodes: ForceLayoutInputNode[],
  edges: ForceLayoutInputEdge[],
  size: { width: number; height: number },
  hub: ForceLayoutInputNode
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const centerX = size.width / 2;
  const centerY = size.height / 2;

  placeNodeCenter(positions, hub, centerX, centerY);

  const satelliteIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === hub.id) satelliteIds.add(edge.target);
    if (edge.target === hub.id) satelliteIds.add(edge.source);
  }

  const satellites = nodes.filter((node) => node.id !== hub.id && satelliteIds.has(node.id));
  const remainder = nodes.filter((node) => node.id !== hub.id && !satelliteIds.has(node.id));

  const maxNodeWidth = Math.max(...nodes.map((node) => node.width), 96);
  const innerRadius = ringRadiusForCount(satellites.length, maxNodeWidth, size, 170);
  placeOnRing(satellites, positions, centerX, centerY, innerRadius);

  if (remainder.length > 0) {
    const outerRadius = ringRadiusForCount(remainder.length, maxNodeWidth, size, innerRadius + 130);
    placeOnRing(remainder, positions, centerX, centerY, outerRadius, -Math.PI / 2 + Math.PI / remainder.length);
  }

  return positions;
}

function pickHubNode(nodes: ForceLayoutInputNode[], edges: ForceLayoutInputEdge[]): ForceLayoutInputNode | null {
  const repos = nodes.filter((node) => node.kind === 'repo');
  if (repos.length === 1) return repos[0]!;

  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  let best: ForceLayoutInputNode | null = null;
  let bestDegree = -1;
  for (const node of nodes) {
    const value = degree.get(node.id) ?? 0;
    if (value > bestDegree) {
      best = node;
      bestDegree = value;
    }
  }

  return bestDegree >= 2 ? best : null;
}

/** Primary layout for repository knowledge graphs (repo + issues, CI, files). */
export function layoutRepositoryGraph(
  nodes: ForceLayoutInputNode[],
  edges: ForceLayoutInputEdge[],
  size: { width: number; height: number }
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) {
    return new Map();
  }

  if (nodes.length === 1) {
    const positions = new Map<string, { x: number; y: number }>();
    placeNodeCenter(positions, nodes[0]!, size.width / 2, size.height / 2);
    return positions;
  }

  const hub = pickHubNode(nodes, edges);
  if (hub) {
    return layoutRadialHub(nodes, edges, size, hub);
  }

  return layoutWithForce(nodes, edges, size);
}

/** Force-directed fallback for multi-hub or weakly connected graphs. */
export function layoutWithForce(
  nodes: ForceLayoutInputNode[],
  edges: ForceLayoutInputEdge[],
  size: { width: number; height: number }
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) {
    return new Map();
  }

  const simNodes: SimNode[] = nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    const spread = Math.min(size.width, size.height) * 0.28;
    return {
      ...node,
      x: size.width / 2 + spread * Math.cos(angle),
      y: size.height / 2 + spread * Math.sin(angle)
    };
  });

  const nodeById = new Map(simNodes.map((node) => [node.id, node]));
  const simEdges = edges
    .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: nodeById.get(edge.source)!,
      target: nodeById.get(edge.target)!
    }));

  const nodeRadius = (node: SimNode) => Math.max(node.width, node.height) / 2;
  const chargeStrength = -420 - nodes.length * 12;
  const linkDistance = 110 + Math.min(nodes.length * 4, 80);

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink(simEdges)
        .id((node) => (node as SimNode).id)
        .distance(linkDistance)
    )
    .force('charge', forceManyBody().strength(chargeStrength))
    .force('center', forceCenter(size.width / 2, size.height / 2))
    .force('collide', forceCollide<SimNode>().radius((node) => nodeRadius(node) + 22))
    .stop();

  const tickCount = Math.min(240, 100 + simNodes.length * 4);
  for (let tick = 0; tick < tickCount; tick += 1) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    const padding = 16;
    const halfW = node.width / 2;
    const halfH = node.height / 2;
    const cx = Math.min(Math.max(node.x, halfW + padding), size.width - halfW - padding);
    const cy = Math.min(Math.max(node.y, halfH + padding), size.height - halfH - padding);
    positions.set(node.id, {
      x: Math.round(cx - halfW),
      y: Math.round(cy - halfH)
    });
  }

  return positions;
}

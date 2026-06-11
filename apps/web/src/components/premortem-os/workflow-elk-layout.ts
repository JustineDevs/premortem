import type { ELK, ElkNode } from 'elkjs/lib/elk-api';

let elkInstancePromise: Promise<ELK> | null = null;

async function getElk(): Promise<ELK> {
  if (typeof window === 'undefined') {
    throw new Error('ELK layout is only available in the browser');
  }

  if (!elkInstancePromise) {
    elkInstancePromise = import('elkjs/lib/elk.bundled.js').then((mod) => new mod.default());
  }

  return elkInstancePromise;
}

function fallbackGridLayout(nodes: ElkLayoutInputNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: (index % 4) * (node.width + 48),
      y: Math.floor(index / 4) * (node.height + 48)
    });
  });
  return positions;
}

export type ElkDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';

export interface ElkLayoutInputNode {
  id: string;
  width: number;
  height: number;
}

export interface ElkLayoutInputEdge {
  id: string;
  source: string;
  target: string;
}

export interface ElkLayoutOptions {
  direction?: ElkDirection;
  algorithm?: string;
  nodeNodeSpacing?: string;
  layerSpacing?: string;
  edgeRouting?: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
}

export const PIPELINE_ELK_OPTIONS: ElkLayoutOptions = {
  direction: 'RIGHT',
  algorithm: 'layered',
  nodeNodeSpacing: '56',
  layerSpacing: '96',
  edgeRouting: 'ORTHOGONAL'
};

export const REPOSITORY_GRAPH_ELK_OPTIONS: ElkLayoutOptions = {
  direction: 'DOWN',
  algorithm: 'layered',
  nodeNodeSpacing: '40',
  layerSpacing: '72',
  edgeRouting: 'ORTHOGONAL'
};

function buildLayoutOptions(options: ElkLayoutOptions): Record<string, string> {
  return {
    'elk.algorithm': options.algorithm ?? 'layered',
    'elk.direction': options.direction ?? 'RIGHT',
    'elk.spacing.nodeNode': options.nodeNodeSpacing ?? '48',
    'elk.layered.spacing.nodeNodeBetweenLayers': options.layerSpacing ?? '80',
    'elk.edgeRouting': options.edgeRouting ?? 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '64'
  };
}

export async function layoutWithElk(
  nodes: ElkLayoutInputNode[],
  edges: ElkLayoutInputEdge[],
  options: ElkLayoutOptions = PIPELINE_ELK_OPTIONS
): Promise<Map<string, { x: number; y: number }>> {
  if (nodes.length === 0) {
    return new Map();
  }

  if (typeof window === 'undefined') {
    return fallbackGridLayout(nodes);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  const graph: ElkNode = {
    id: 'premortem-root',
    layoutOptions: buildLayoutOptions(options),
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height
    })),
    edges: validEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };

  try {
    const elk = await getElk();
    const layouted = await elk.layout(graph);
    const positions = new Map<string, { x: number; y: number }>();

    for (const child of layouted.children ?? []) {
      positions.set(child.id, {
        x: Math.round(child.x ?? 0),
        y: Math.round(child.y ?? 0)
      });
    }

    return positions;
  } catch {
    return fallbackGridLayout(nodes);
  }
}

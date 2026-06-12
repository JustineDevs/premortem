'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

interface PhoenixSemanticGraphResponse {
  configured?: boolean;
  source?: 'phoenix' | 'unconfigured' | 'empty';
  traceIds?: string[];
  nodes?: Array<{
    id: string;
    label: string;
    kind: string;
    spanKind?: string;
    status?: string;
  }>;
  edges?: Array<{ from: string; to: string; type?: string }>;
}

function mapPhoenixToGraph(payload: PhoenixSemanticGraphResponse): {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  configured: boolean;
  included: boolean;
  traceIds: string[];
} {
  const nodes: WorkflowGraphNode[] = (payload.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.label,
    type: node.kind,
    lane: 'semantic',
    source: 'phoenix',
    spanKind: node.spanKind,
    status: node.status,
    props: {
      ...(node.spanKind ? { spanKind: node.spanKind } : {}),
      ...(node.status ? { status: node.status } : {})
    }
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: WorkflowGraphEdge[] = (payload.edges ?? [])
    .map((edge, index) => ({
      id: `phoenix-edge-${index}`,
      from: edge.from,
      to: edge.to,
      label: edge.type
    }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  const included = payload.source === 'phoenix' && nodes.length > 0;

  return {
    nodes,
    edges,
    configured: payload.configured ?? false,
    included,
    traceIds: payload.traceIds ?? []
  };
}

export function useWorkflowPhoenixSemanticGraph(
  auditRunId: string | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = Boolean(auditRunId) && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: ['os', 'audit-semantic-graph', auditRunId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`/api/audits/${auditRunId}/semantic-graph`);
      if (!response.ok) {
        return {
          nodes: [] as WorkflowGraphNode[],
          edges: [] as WorkflowGraphEdge[],
          configured: false,
          included: false,
          traceIds: [] as string[]
        };
      }
      const data = (await response.json()) as PhoenixSemanticGraphResponse;
      return mapPhoenixToGraph(data);
    }
  });

  const semanticGraph = useMemo(
    () =>
      query.data ?? {
        nodes: [] as WorkflowGraphNode[],
        edges: [] as WorkflowGraphEdge[],
        configured: false,
        included: false,
        traceIds: [] as string[]
      },
    [query.data]
  );

  return { ...semanticGraph, loading: query.isLoading || query.isFetching };
}

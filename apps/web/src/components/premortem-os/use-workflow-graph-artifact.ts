'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph-panel';

interface GraphArtifactPayload {
  nodes?: Array<{ id: string; label: string; kind?: string }>;
  edges?: Array<{ from: string; to: string; type?: string }>;
}

const RUNTIME_KINDS = new Set(['pipeline_run', 'ci_job', 'issue', 'service']);

function laneForKind(kind: string): 'structure' | 'runtime' | undefined {
  if (RUNTIME_KINDS.has(kind)) return 'runtime';
  if (kind === 'repo' || kind === 'file' || kind === 'pipeline' || kind === 'package') {
    return 'structure';
  }
  return undefined;
}

function mapArtifactToGraph(payload: GraphArtifactPayload): {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
} {
  const nodes: WorkflowGraphNode[] = (payload.nodes ?? []).slice(0, 96).map((node) => ({
    id: node.id,
    label: node.label,
    type: node.kind ?? 'repo',
    lane: laneForKind(node.kind ?? 'repo')
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: WorkflowGraphEdge[] = (payload.edges ?? [])
    .slice(0, 160)
    .map((edge, index) => ({
      id: `artifact-edge-${index}`,
      from: edge.from,
      to: edge.to,
      label: edge.type
    }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

  return { nodes, edges };
}

export function useWorkflowGraphArtifact(
  auditRunId: string | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = Boolean(auditRunId) && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: ['os', 'audit-graph', auditRunId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`/api/audits/${auditRunId}/graph`);
      if (!response.ok) {
        return { nodes: [] as WorkflowGraphNode[], edges: [] as WorkflowGraphEdge[] };
      }
      const data = (await response.json()) as { payload?: GraphArtifactPayload };
      if (!data.payload) {
        return { nodes: [] as WorkflowGraphNode[], edges: [] as WorkflowGraphEdge[] };
      }
      return mapArtifactToGraph(data.payload);
    }
  });

  const artifactGraph = useMemo(
    () => query.data ?? { nodes: [], edges: [] },
    [query.data]
  );

  return { ...artifactGraph, loading: query.isLoading || query.isFetching };
}

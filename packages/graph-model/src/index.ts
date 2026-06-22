export type GraphNodeKind =
  | 'repo'
  | 'package'
  | 'service'
  | 'pipeline'
  | 'pipeline_run'
  | 'ci_job'
  | 'issue'
  | 'file'
  | 'symbol'
  | 'owner'
  | 'artifact';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  props?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  props?: Record<string, unknown>;
}

export interface GraphSnapshotPayload {
  auditRunId: string;
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const packageName = '@premortem/graph-model';

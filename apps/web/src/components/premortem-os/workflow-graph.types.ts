export type WorkflowGraphNodeSource = 'artifact' | 'phoenix';

export interface WorkflowGraphNode {
  id: string;
  label: string;
  type: string;
  lane?: 'structure' | 'runtime' | 'pipeline' | 'semantic';
  source?: WorkflowGraphNodeSource;
  props?: Record<string, unknown>;
  spanKind?: string;
  status?: string;
}

export interface WorkflowGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  props?: Record<string, unknown>;
}

export interface WorkflowGraphInspectContext {
  node: WorkflowGraphNode;
  incoming: Array<{ edge: WorkflowGraphEdge; from: WorkflowGraphNode | undefined }>;
  outgoing: Array<{ edge: WorkflowGraphEdge; to: WorkflowGraphNode | undefined }>;
  webUrl: string | null;
  relatedAgentRuns: Array<{
    id: string;
    agentName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  relatedEvents: Array<{ eventType: string; actor: string; createdAt: string }>;
}

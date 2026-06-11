import type { Finding } from '@/lib/premortem-os/types';

export type CanvasNodeStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'reviewable'
  | 'published';

export type CanvasNodeType = 'input' | 'execution' | 'synthesis' | 'review' | 'publish';

export interface CanvasNodeMetadata {
  title: string;
  duration?: string;
  timestamp?: string;
  inputs: string[];
  outputs: string[];
  logs: string[];
  systemNote?: string;
  promptVersion?: string;
  agentConfig?: string;
  linkedFindingIds?: string[];
}

export interface CanvasNode {
  id: string;
  label: string;
  type: CanvasNodeType;
  description: string;
  status: CanvasNodeStatus;
  targetLinkTab: string;
  metadata: CanvasNodeMetadata;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  transformationDetail: string;
}

export interface WorkflowAuditSnapshot {
  events: Array<{ eventType: string; actor: string; createdAt: string }>;
  agentRuns: Array<{
    id: string;
    agentName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>;
  clusters: Array<{
    id: string;
    categoryOwner: string;
    titleHint?: string | null;
    severity: string;
    findingCount: number;
  }>;
  graphSnapshot?: { nodeCount: number; edgeCount: number } | null;
  counts?: { findings: number; agentRuns: number; clusters: number; events: number };
  runStatus: string;
}

export const WORKFLOW_STEP_IDS = [
  'node-connect-vcs',
  'node-scan-repo',
  'node-run-audit',
  'node-cluster-risks',
  'node-review-approval',
  'node-publish-gitlab'
] as const;

export const WORKFLOW_STEP_LABELS: Record<(typeof WORKFLOW_STEP_IDS)[number], string> = {
  'node-connect-vcs': 'Connect',
  'node-scan-repo': 'Analyze',
  'node-run-audit': 'Run AI',
  'node-cluster-risks': 'Cluster',
  'node-review-approval': 'Review',
  'node-publish-gitlab': 'Publish'
};

export type WorkflowFindingsList = Finding[];

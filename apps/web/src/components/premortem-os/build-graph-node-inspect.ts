import type { WorkflowAuditSnapshot } from './workflow-canvas.types';
import type {
  WorkflowGraphEdge,
  WorkflowGraphInspectContext,
  WorkflowGraphNode
} from './workflow-graph.types';

function readWebUrl(props: Record<string, unknown> | undefined): string | null {
  const value = props?.webUrl;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function agentMatchesNode(agentName: string, node: WorkflowGraphNode): boolean {
  const normalizedAgent = agentName.toLowerCase();
  const normalizedLabel = node.label.toLowerCase();
  const normalizedId = node.id.toLowerCase();

  if (normalizedLabel.includes(normalizedAgent.replace(/_agent$/, ''))) return true;
  if (normalizedId.includes(normalizedAgent)) return true;
  if (node.type === 'agent' && normalizedLabel.includes(normalizedAgent.split('_')[0] ?? '')) {
    return true;
  }

  return false;
}

export function buildGraphNodeInspectContext(
  node: WorkflowGraphNode,
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[],
  auditSnapshot: WorkflowAuditSnapshot | null
): WorkflowGraphInspectContext {
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  const incoming = edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => ({ edge, from: nodeById.get(edge.from) }));

  const outgoing = edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => ({ edge, to: nodeById.get(edge.to) }));

  const agentRuns = auditSnapshot?.agentRuns ?? [];
  const relatedAgentRuns =
    node.source === 'phoenix' || node.type === 'agent' || node.type === 'llm' || node.type === 'chain'
      ? agentRuns.filter((run) => agentMatchesNode(run.agentName, node))
      : node.type === 'repo'
        ? agentRuns.slice(0, 8)
        : agentRuns.filter((run) => agentMatchesNode(run.agentName, node)).slice(0, 6);

  const events = auditSnapshot?.events ?? [];
  const relatedEvents =
    node.type === 'repo' || node.type === 'pipeline_run' || node.type === 'ci_job'
      ? events.slice(0, 8)
      : events.slice(0, 4);

  return {
    node,
    incoming,
    outgoing,
    webUrl: readWebUrl(node.props),
    relatedAgentRuns,
    relatedEvents
  };
}

export function formatGraphPropValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

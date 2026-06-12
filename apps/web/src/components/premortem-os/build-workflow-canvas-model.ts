import { AuditEvent, hasAuditEvent } from '@premortem/domain';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

import { canvasNodeIcon, getNodeStyles } from './workflow-canvas-node-styles';
import type {
  CanvasEdge,
  CanvasNode,
  WorkflowAuditSnapshot
} from './workflow-canvas.types';

interface BuildCanvasModelInput {
  selectedProj: Project;
  matchingAudit: AuditRun | undefined;
  auditSnapshot: WorkflowAuditSnapshot | null;
  runtimeEventTypes: string[];
  isSimulating: boolean;
  simulationIndex: number;
  providerConnected: boolean;
}

export function buildWorkflowCanvasModel(input: BuildCanvasModelInput) {
  const {
    selectedProj,
    matchingAudit,
    auditSnapshot,
    runtimeEventTypes,
    isSimulating,
    simulationIndex,
    providerConnected
  } = input;

  const totalFindingsCount = matchingAudit?.findings?.length || 0;
  const resolvedFindings = matchingAudit?.findings?.filter((f) => f.status === 'RESOLVED') || [];
  const publishedFindings = matchingAudit?.findings?.filter((f) => f.gitlabIssueId) || [];
  const findingsList = matchingAudit?.findings || [];
  const findingIds = findingsList.map((f) => f.id);
  const publishedFindingIds = findingsList.filter((f) => f.gitlabIssueId).map((f) => f.id);

  let scannerState: 'completed' | 'failed' | 'running' | 'queued' = matchingAudit ? 'completed' : 'queued';
  if (selectedProj.status === 'SCANNING') scannerState = 'running';
  else if (selectedProj.status === 'FAILED') scannerState = 'failed';
  else if (!matchingAudit) scannerState = 'queued';

  let reviewState: 'completed' | 'reviewable' | 'queued' = matchingAudit && totalFindingsCount > 0 ? 'reviewable' : 'queued';
  if (matchingAudit && (totalFindingsCount === 0 || resolvedFindings.length === totalFindingsCount)) {
    reviewState = 'completed';
  }

  let publishState: 'completed' | 'published' | 'queued' = 'queued';
  if (publishedFindings.length > 0) publishState = 'published';
  else if (matchingAudit && totalFindingsCount === 0) publishState = 'completed';

  const connectState: CanvasNode['status'] = providerConnected ? 'completed' : 'queued';

  const clusterCount = auditSnapshot?.clusters?.length ?? 0;
  const graphNodeCount =
    auditSnapshot?.graphSnapshot?.nodeCount ?? matchingAudit?.graphSnapshot?.nodeCount ?? 0;
  const graphEdgeCount =
    auditSnapshot?.graphSnapshot?.edgeCount ?? matchingAudit?.graphSnapshot?.edgeCount ?? 0;
  const agentRunCount = auditSnapshot?.agentRuns?.length ?? matchingAudit?.agentRuns?.length ?? 0;
  const auditTimestamp = matchingAudit?.date
    ? new Date(matchingAudit.date).toLocaleString()
    : 'No audit run yet';

  const eventLogs = (eventTypes: string[]) =>
    (auditSnapshot?.events ?? [])
      .filter((event) => eventTypes.length === 0 || eventTypes.includes(event.eventType))
      .slice(0, 6)
      .map(
        (event) =>
          `[${event.eventType}] ${event.actor} @ ${new Date(event.createdAt).toLocaleString()}`
      );

  const fallbackLogs = (message: string) =>
    eventLogs([]).length > 0 ? eventLogs([]) : [message];

  const getSimulatedStatus = (
    stepIdx: number,
    baseStatus: CanvasNode['status']
  ): CanvasNode['status'] => {
    if (isSimulating) {
      if (simulationIndex > stepIdx) return 'completed';
      if (simulationIndex === stepIdx) return 'running';
      return 'queued';
    }

    if (runtimeEventTypes.length > 0) {
      const stepComplete = [
        hasAuditEvent(runtimeEventTypes, AuditEvent.INGESTION_COMPLETED),
        hasAuditEvent(runtimeEventTypes, AuditEvent.GRAPH_BUILT),
        hasAuditEvent(runtimeEventTypes, AuditEvent.STARTED) ||
          hasAuditEvent(runtimeEventTypes, AuditEvent.COMPLETED),
        hasAuditEvent(runtimeEventTypes, AuditEvent.COMPLETED),
        hasAuditEvent(runtimeEventTypes, AuditEvent.COMPLETED),
        publishedFindingIds.length > 0
      ];
      if (stepComplete[stepIdx]) {
        return stepIdx === 5 && publishedFindingIds.length > 0 ? 'published' : 'completed';
      }
      if (stepIdx > 0 && stepComplete[stepIdx - 1]) return 'running';
      return stepIdx === 0 ? 'completed' : 'queued';
    }

    return baseStatus;
  };

  const nodes: CanvasNode[] = [
    {
      id: 'node-connect-vcs',
      label: 'Connect Provider',
      type: 'input',
      description: 'Ingest GitLab repository metadata & branches context',
      status: getSimulatedStatus(0, connectState),
      targetLinkTab: 'settings',
      metadata: {
        title: 'GitLab Provider Auth Gateway',
        timestamp: auditTimestamp,
        duration: auditSnapshot?.runStatus ?? matchingAudit?.status ?? 'unknown',
        inputs: [
          `Repo: ${selectedProj.repoUrl}`,
          `Branch: ${selectedProj.branch}`,
          `Provider: ${selectedProj.provider}`
        ],
        outputs: ['Project registered', `Latest audit: ${matchingAudit?.id ?? 'none'}`],
        logs: fallbackLogs('Connect provider via Settings → Providers or register a project.'),
        systemNote:
          'Provider connection state comes from workspace integrations and project registry.',
        promptVersion: 'N/A',
        agentConfig: 'ingestion-service',
        linkedFindingIds: []
      }
    },
    {
      id: 'node-scan-repo',
      label: 'Analyze CI & Config',
      type: 'execution',
      description: 'Parse pipeline YAML profiles and Docker configurations',
      status: getSimulatedStatus(1, scannerState === 'failed' ? 'partial' : scannerState),
      targetLinkTab: 'projects',
      metadata: {
        title: 'CI Scan Pipeline',
        duration: `${graphNodeCount} nodes / ${graphEdgeCount} edges`,
        timestamp: auditTimestamp,
        inputs: ['Repository ingestion', 'Graph builder snapshot'],
        outputs: [
          `${graphNodeCount} graph nodes materialized`,
          `${graphEdgeCount} dependency edges mapped`
        ],
        logs: eventLogs(['GRAPH_BUILT', 'INGESTION_COMPLETED']).length
          ? eventLogs(['GRAPH_BUILT', 'INGESTION_COMPLETED'])
          : fallbackLogs('Graph snapshot pending: run an audit to populate.'),
        systemNote: 'Graph metrics loaded from orchestrator graphSnapshot.',
        promptVersion: auditSnapshot?.counts ? `events:${auditSnapshot.counts.events}` : 'N/A',
        agentConfig: 'graph-builder',
        linkedFindingIds: []
      }
    },
    {
      id: 'node-run-audit',
      label: 'Run Premortem AI',
      type: 'execution',
      description: 'Trace data pathways and flag potential key leakages',
      status: getSimulatedStatus(2, scannerState),
      targetLinkTab: 'audits',
      metadata: {
        title: 'Premortem AI Reasoning Engine',
        duration: `${agentRunCount} agent runs`,
        timestamp: auditTimestamp,
        inputs: [
          selectedProj.scanCodeSnippet
            ? 'Custom scan snippet attached'
            : 'Repository checkout context',
          `Run status: ${auditSnapshot?.runStatus ?? matchingAudit?.status ?? 'unknown'}`
        ],
        outputs: [
          `${totalFindingsCount} findings`,
          `Compliance score: ${matchingAudit?.score ?? selectedProj.lastAuditScore ?? 'N/A'}/100`
        ],
        logs: eventLogs(['STARTED', 'COMPLETED', 'FAILED']).length
          ? eventLogs(['STARTED', 'COMPLETED', 'FAILED'])
          : (auditSnapshot?.agentRuns ?? []).map((run) => `${run.agentName}: ${run.status}`),
        systemNote: 'Agent runs and findings loaded from audit runtime snapshot.',
        promptVersion: `${agentRunCount} agents dispatched`,
        agentConfig:
          auditSnapshot?.agentRuns?.map((run) => run.agentName).join(', ') || 'orchestrator',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-cluster-risks',
      label: 'Cluster Risks',
      type: 'synthesis',
      description: 'Consolidate individual trace violations into deduplicated risk clusters',
      status: getSimulatedStatus(3, totalFindingsCount > 0 ? 'completed' : 'queued'),
      targetLinkTab: 'dashboard',
      metadata: {
        title: 'Synthesized Risk Cluster Deduplicator',
        duration: `${clusterCount} clusters`,
        inputs: [`${totalFindingsCount} raw findings`],
        outputs:
          clusterCount > 0
            ? (auditSnapshot?.clusters ?? []).map(
                (cluster) => `${cluster.titleHint ?? cluster.categoryOwner} (${cluster.findingCount})`
              )
            : ['No clusters: run audit or no findings to cluster'],
        logs: (auditSnapshot?.clusters ?? []).length
          ? (auditSnapshot?.clusters ?? []).map(
              (cluster) =>
                `Cluster ${cluster.id}: ${cluster.findingCount} findings (${cluster.severity})`
            )
          : fallbackLogs('Clustering output appears after orchestrator completes.'),
        promptVersion: 'cluster-service',
        agentConfig: 'cluster-findings',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-review-approval',
      label: 'Reviewer Approval',
      type: 'review',
      description: 'Human approval gateway controls (Merge, Dismiss, Split, Edit)',
      status: getSimulatedStatus(4, reviewState),
      targetLinkTab: 'audits',
      metadata: {
        title: 'Reviewer Approval Control Board',
        duration: matchingAudit?.status ?? 'pending',
        inputs: [totalFindingsCount > 0 ? `${totalFindingsCount} issue candidates` : 'No findings'],
        outputs: [
          `Confirmed: ${matchingAudit?.findings?.filter((f) => f.status === 'CONFIRMED').length || 0}`,
          `Resolved: ${resolvedFindings.length}`,
          `Dismissed: ${matchingAudit?.findings?.filter((f) => f.status === 'DISMISSED').length || 0}`
        ],
        logs: [
          `Audit ${matchingAudit?.id ?? 'N/A'} awaiting reviewer actions`,
          resolvedFindings.length > 0
            ? `${resolvedFindings.length} findings resolved in runtime`
            : 'No reviewer actions recorded yet.'
        ],
        systemNote: 'Review states reflect issue candidate reviewerStatus from the audit snapshot.',
        promptVersion: 'review-console',
        agentConfig: 'human-in-the-loop',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-publish-gitlab',
      label: 'Sync GitLab Issues',
      type: 'publish',
      description: 'Serialize approved issue drafts directly back to repo work items',
      status: getSimulatedStatus(5, publishState),
      targetLinkTab: 'audits',
      metadata: {
        title: 'Operational GitLab Sync Connector',
        timestamp: auditTimestamp,
        duration: `${publishedFindings.length} published`,
        inputs: ['Approved issue candidate drafts'],
        outputs: [
          publishedFindings.length > 0
            ? `${publishedFindings.length} GitLab issues linked`
            : '0 synchronized items'
        ],
        logs:
          publishedFindings.length > 0
            ? publishedFindings.map(
                (finding) => `Published: ${finding.gitlabIssueId ?? finding.id}`
              )
            : fallbackLogs('Publish findings from Audits → Synthesis to create GitLab issues.'),
        promptVersion: 'gitlab-publisher',
        agentConfig: 'issue-publisher',
        linkedFindingIds: publishedFindingIds
      }
    }
  ];

  const edges: CanvasEdge[] = [
    {
      id: 'edge-vcs-scan',
      from: 'node-connect-vcs',
      to: 'node-scan-repo',
      label: 'Repo Files Ingest',
      transformationDetail:
        'VCS checking logs stream is matched against package list dependencies to establish audit scope guidelines.'
    },
    {
      id: 'edge-scan-audit',
      from: 'node-scan-repo',
      to: 'node-run-audit',
      label: 'Configs Context Influx',
      transformationDetail:
        'CI/CD pipeline maps and configuration metadata are passed to the orchestrator alongside source file snippets.'
    },
    {
      id: 'edge-audit-cluster',
      from: 'node-run-audit',
      to: 'node-cluster-risks',
      label: 'Extract Findings',
      transformationDetail:
        'Raw trace alerts from AI engines are processed via semantic vector models to grouping identical errors.'
    },
    {
      id: 'edge-cluster-review',
      from: 'node-cluster-risks',
      to: 'node-review-approval',
      label: 'Actionable Items Mapping',
      transformationDetail:
        'Deduplicated clusters are populated as structured draft templates with customizable fields to allow editing, merging, or splits.'
    },
    {
      id: 'edge-review-publish',
      from: 'node-review-approval',
      to: 'node-publish-gitlab',
      label: 'GitLab Sync Stream',
      transformationDetail:
        'Upon manual confirmed review actions, secure payloads containing issue descriptions are published back to GitLab as real, traceable work tickets.'
    }
  ];

  const boardNodes = nodes.map((node) => {
    const styles = getNodeStyles(node.status);
    const meta =
      node.id === 'node-review-approval' && totalFindingsCount > 0
        ? `OPEN RISKS: ${matchingAudit?.findings?.filter((f) => f.status === 'OPEN').length || 0}`
        : node.status === 'completed' && node.metadata.timestamp
          ? node.metadata.timestamp
          : undefined;

    return {
      id: node.id,
      label: node.label,
      description: node.description,
      status: node.status,
      meta,
      icon: canvasNodeIcon(node.type, styles.iconColor),
      statusClassName: styles.statusClassName,
      cardClassName: styles.cardClassName
    };
  });

  const boardEdges = edges.map((edge) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);
    const completed = fromNode?.status === 'completed' && toNode?.status !== 'queued';
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      completed
    };
  });

  return {
    nodes,
    edges,
    boardNodes,
    boardEdges,
    findingsList,
    graphNodeCount,
    graphEdgeCount
  };
}

import type { AuditRun, Finding, Project, RiskCluster } from '@/lib/premortem-os/types';
import type { RuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import {
  ConsoleComplianceStatus,
  deriveConsoleCompliance,
  projectAuditListItemToConsoleAudit,
  projectSnapshotToConsoleAudit,
  severityToConsole
} from '@premortem/domain';

export function mapSnapshotToAuditRun(
  snapshot: RuntimeAuditSnapshot,
  projectName: string,
  createdAt?: string
): AuditRun {
  const projected = projectSnapshotToConsoleAudit(snapshot, projectName, createdAt);
  return {
    ...projected,
    agentRuns: snapshot.agentRuns,
    lineage: snapshot.lineage,
    graphSnapshot: snapshot.graphSnapshot ?? null
  };
}

export function mapSnapshotsToRiskClusters(snapshots: RuntimeAuditSnapshot[]): RiskCluster[] {
  const clusters: RiskCluster[] = [];
  for (const snapshot of snapshots) {
    for (const cluster of snapshot.clusters) {
      clusters.push({
        id: cluster.id,
        name: cluster.titleHint ?? cluster.categoryOwner,
        description: `${cluster.findingCount} related findings in ${cluster.categoryOwner}`,
        severity: severityToConsole(cluster.severity),
        findingsCount: cluster.findingCount,
        projectIds: [snapshot.projectId],
        auditRunId: snapshot.auditRunId
      });
    }
  }
  return clusters.slice(0, 12);
}

export function mapRuntimeProject(project: Record<string, unknown>): Project {
  const connectionStatus = String(project.connectionStatus ?? project.status ?? 'active');
  const complianceStatus =
    connectionStatus === 'archived' || connectionStatus === 'disconnected'
      ? ConsoleComplianceStatus.WARNING
      : ConsoleComplianceStatus.COMPLIANT;

  return {
    id: String(project.id),
    name: String(project.name),
    provider: (project.provider as Project['provider']) ?? 'gitlab',
    repoUrl: String(project.repoUrl ?? ''),
    branch: String(project.branch ?? 'main'),
    status: (project.complianceStatus as Project['status']) ?? complianceStatus,
    lastAuditScore: typeof project.lastAuditScore === 'number' ? project.lastAuditScore : null,
    lastAuditDate: typeof project.lastAuditDate === 'string' ? project.lastAuditDate : null,
    infrastructureCount: Number(project.infrastructureCount ?? 0),
    apiEndpointsCount: Number(project.apiEndpointsCount ?? 0),
    unencryptedEndpointsCount: Number(project.unencryptedEndpointsCount ?? 0),
    scanCodeSnippet: typeof project.scanCodeSnippet === 'string' ? project.scanCodeSnippet : undefined
  };
}

export function mapAuditListItemToAuditRun(
  item: {
    auditRunId?: string;
    id?: string;
    projectId: string;
    branch: string;
    runStatus?: string;
    status?: string;
    createdAt?: string;
    date?: string;
    findingCount?: number;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    reviewableIssueCount?: number;
    reviewableCount?: number;
    rejectedIssueCount?: number;
    rejectedCount?: number;
  },
  projectName: string
): AuditRun {
  const auditRunId = item.auditRunId ?? item.id ?? '';
  const runStatus = item.runStatus ?? item.status ?? 'failed';
  const reviewableIssueCount = item.reviewableIssueCount ?? item.reviewableCount ?? 0;
  const rejectedIssueCount = item.rejectedIssueCount ?? item.rejectedCount ?? 0;

  return projectAuditListItemToConsoleAudit(
    {
      ...item,
      auditRunId,
      runStatus,
      findingCount: item.findingCount,
      criticalCount: item.criticalCount,
      highCount: item.highCount,
      mediumCount: item.mediumCount,
      lowCount: item.lowCount,
      reviewableIssueCount,
      rejectedIssueCount,
      createdAt: item.createdAt ?? item.date ?? new Date().toISOString()
    },
    projectName
  ) as AuditRun;
}

export function mapFindingComplianceFromAudit(audit: AuditRun): Project['status'] {
  const counts = {
    critical: audit.criticalCount,
    high: audit.highCount,
    medium: audit.mediumCount,
    low: audit.lowCount
  };
  return deriveConsoleCompliance(counts);
}

import type { AuditRun, Project } from '@/lib/premortem-os/types';

function projectStatusFromAudit(audit: AuditRun): Project['status'] {
  if (audit.status === 'RUNNING') return 'SCANNING';
  if (audit.status === 'FAILED') return 'FAILED';
  if (audit.criticalCount > 0 || audit.highCount > 0) return 'WARNING';
  return 'COMPLIANT';
}

function projectFromAudit(audit: AuditRun): Project {
  return {
    id: audit.projectId,
    name: audit.projectName?.trim() || audit.projectId,
    provider: 'gitlab',
    repoUrl: '',
    branch: 'main',
    status: projectStatusFromAudit(audit),
    lastAuditScore: audit.score,
    lastAuditDate: audit.date,
    infrastructureCount: 0,
    apiEndpointsCount: 0,
    unencryptedEndpointsCount: 0
  };
}

/** Fill gaps when audit history references projects missing from the inventory list. */
export function mergeConsoleProjects(projects: Project[], audits: AuditRun[]): Project[] {
  const merged = new Map(projects.map((project) => [project.id, project] as const));

  for (const audit of audits) {
    if (!audit.projectId || merged.has(audit.projectId)) continue;
    merged.set(audit.projectId, projectFromAudit(audit));
  }

  return [...merged.values()];
}

export function pickLatestAuditForProject(audits: AuditRun[], projectId: string): AuditRun | undefined {
  return [...audits]
    .filter((audit) => audit.projectId === projectId)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
}

export function pickDefaultWorkflowProjectId(projects: Project[], audits: AuditRun[]): string | null {
  if (projects.length === 0) return null;

  const latestAudit = [...audits].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  )[0];

  if (latestAudit && projects.some((project) => project.id === latestAudit.projectId)) {
    return latestAudit.projectId;
  }

  return projects[0]!.id;
}

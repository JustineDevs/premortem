import type { AuditRun, Project } from '@/lib/premortem-os/types';
import { isRealProject } from './project-selection';

function projectStatusFromAudit(audit: AuditRun): Project['status'] {
  if (audit.status === 'RUNNING' || audit.status === 'QUEUED' || audit.status === 'PAUSED') {
    return 'SCANNING';
  }
  if (audit.status === 'FAILED') return 'FAILED';
  if (audit.criticalCount > 0 || audit.highCount > 0) return 'WARNING';
  return 'COMPLIANT';
}

export function mergeConsoleProjects(projects: Project[], audits: AuditRun[]): Project[] {
  const merged = new Map(projects.map((project) => [project.id, project] as const));
  const latestAuditByProject = new Map<string, AuditRun>();

  for (const audit of audits) {
    if (!audit.projectId) continue;
    const current = latestAuditByProject.get(audit.projectId);
    if (!current || new Date(audit.date).getTime() > new Date(current.date).getTime()) {
      latestAuditByProject.set(audit.projectId, audit);
    }
  }

  return [...merged.values()].map((project) => {
    const latestAudit = latestAuditByProject.get(project.id);
    if (!latestAudit) {
      return project;
    }

    return {
      ...project,
      status: projectStatusFromAudit(latestAudit),
      lastAuditScore: latestAudit.score,
      lastAuditDate: latestAudit.date
    };
  });
}

export function pickLatestAuditForProject(audits: AuditRun[], projectId: string): AuditRun | undefined {
  return [...audits]
    .filter((audit) => audit.projectId === projectId)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
}

export function pickDefaultWorkflowProjectId(projects: Project[], audits: AuditRun[]): string | null {
  const realProjects = projects.filter(isRealProject);
  if (realProjects.length === 0) return null;

  const latestAudit = [...audits].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  )[0];

  if (latestAudit && realProjects.some((project) => project.id === latestAudit.projectId)) {
    return latestAudit.projectId;
  }

  return realProjects[0]!.id;
}

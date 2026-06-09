import type { AuditRun, Project } from './types';
import { seedAudits, seedProjects } from './seed-data';

let projects: Project[] = structuredClone(seedProjects);
let audits: AuditRun[] = structuredClone(seedAudits);

export function getProjects(): Project[] {
  return projects;
}

export function getAudits(): AuditRun[] {
  return audits;
}

export function getAuditById(id: string): AuditRun | undefined {
  return audits.find((audit) => audit.id === id);
}

export function addProject(project: Project): Project {
  projects.push(project);
  return project;
}

export function updateProject(projectId: string, updater: (project: Project) => Project): Project | undefined {
  const index = projects.findIndex((project) => project.id === projectId);
  if (index === -1) return undefined;
  projects[index] = updater(projects[index]);
  return projects[index];
}

export function getProjectById(projectId: string): Project | undefined {
  return projects.find((project) => project.id === projectId);
}

export function prependAudit(audit: AuditRun): AuditRun {
  audits.unshift(audit);
  return audit;
}

export function updateAudit(auditId: string, updater: (audit: AuditRun) => AuditRun): AuditRun | undefined {
  const index = audits.findIndex((audit) => audit.id === auditId);
  if (index === -1) return undefined;
  audits[index] = updater(audits[index]);
  return audits[index];
}

import type { Project } from './types';

export function isRealProject(project: Project | null | undefined): project is Project {
  return Boolean(project && typeof project.repoUrl === 'string' && project.repoUrl.trim().length > 0);
}

export function selectRealProject(
  projects: Project[] | null | undefined,
  preferredProjectId?: string | null
): Project | null {
  const safeProjects = Array.isArray(projects) ? projects : [];
  if (preferredProjectId) {
    const preferred = safeProjects.find((project) => project.id === preferredProjectId);
    if (isRealProject(preferred)) {
      return preferred;
    }
  }

  return safeProjects.find(isRealProject) ?? null;
}

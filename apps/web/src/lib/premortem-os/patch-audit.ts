import type { IssueStatusType } from './types';
import { getAuditById, getProjectById, updateAudit, updateProject } from './store';

export function updateFindingStatus(
  auditId: string,
  issueId: string,
  action: IssueStatusType
): { success: true; finding: NonNullable<ReturnType<typeof getAuditById>>['findings'][number] } | { success: false; error: string } {
  const audit = getAuditById(auditId);
  if (!audit) return { success: false, error: 'Audit not found' };

  const finding = audit.findings.find((item) => item.id === issueId);
  if (!finding) return { success: false, error: 'Finding not found' };

  finding.status = action;
  return { success: true, finding };
}

export function deployPatch(
  auditId: string,
  issueId: string
): { success: true; finding: NonNullable<ReturnType<typeof getAuditById>>['findings'][number]; auditScore: number } | { success: false; error: string } {
  const audit = getAuditById(auditId);
  if (!audit) return { success: false, error: 'Audit not found' };

  const finding = audit.findings.find((item) => item.id === issueId);
  if (!finding) return { success: false, error: 'Finding not found' };

  updateAudit(auditId, (current) => {
    const nextFindings = current.findings.map((item) =>
      item.id === issueId ? { ...item, patchApplied: true, status: 'RESOLVED' as const } : item
    );
    const unresolvedCount = nextFindings.filter(
      (item) => item.status !== 'RESOLVED' && item.status !== 'DISMISSED'
    ).length;

    const project = getProjectById(current.projectId);
    if (project) {
      const nextScore = Math.min(100, current.score + 12);
      updateProject(project.id, (currentProject) => ({
        ...currentProject,
        status: unresolvedCount === 0 ? 'COMPLIANT' : 'WARNING',
        lastAuditScore: nextScore
      }));
    }

    return {
      ...current,
      score: Math.min(100, current.score + 12),
      findings: nextFindings
    };
  });

  const updatedAudit = getAuditById(auditId);
  const updatedFinding = updatedAudit?.findings.find((item) => item.id === issueId) ?? finding;

  return {
    success: true,
    finding: updatedFinding,
    auditScore: updatedAudit?.score ?? audit.score
  };
}

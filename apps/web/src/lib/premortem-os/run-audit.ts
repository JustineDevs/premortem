import type { AuditRun, Finding, Project } from './types';
import { performStaticAudit } from './static-audit';
import { getProjectById, prependAudit, updateProject } from './store';

type ProjectStatus = Project['status'];

function computeProjectStatus(findings: Finding[]): ProjectStatus {
  const crits = findings.filter((finding) => finding.severity === 'CRITICAL').length;
  const highs = findings.filter((finding) => finding.severity === 'HIGH').length;
  const meds = findings.filter((finding) => finding.severity === 'MEDIUM').length;

  if (crits > 0 || highs > 0) return 'FAILED';
  if (meds > 0) return 'WARNING';
  return 'COMPLIANT';
}

function countBySeverity(findings: Finding[]) {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const finding of findings) {
    if (finding.severity === 'CRITICAL') criticalCount++;
    else if (finding.severity === 'HIGH') highCount++;
    else if (finding.severity === 'MEDIUM') mediumCount++;
    else if (finding.severity === 'LOW') lowCount++;
  }

  return { criticalCount, highCount, mediumCount, lowCount };
}

export async function runSecurityAudit(input: {
  projectId?: string;
  customSnippet?: string;
}): Promise<{ success: true; audit: AuditRun } | { success: false; error: string }> {
  const project = input.projectId ? getProjectById(input.projectId) : undefined;

  if (!project && !input.customSnippet) {
    return { success: false, error: 'Project reference not found' };
  }

  const codeToScan = input.customSnippet || project?.scanCodeSnippet || '';
  const nameToUse = project?.name || 'AdHoc Code Scan';
  const projectIdToUse = input.projectId || 'proj-adhoc';

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const { overallScore, findings } = performStaticAudit(codeToScan);

  const randomFindings: Finding[] = findings.map((finding, index) => ({
    ...finding,
    id: `find-sim-${index}-${Math.random().toString(36).substring(2, 5)}`,
    status: 'OPEN' as const
  }));

  const counts = countBySeverity(randomFindings);
  const computedStatus = computeProjectStatus(randomFindings);

  const newAudit: AuditRun = {
    id: `aud-sim-${Math.random().toString(36).substring(2, 6)}`,
    projectId: projectIdToUse,
    projectName: nameToUse,
    score: overallScore,
    status: 'COMPLETED',
    date: new Date().toISOString(),
    ...counts,
    findings: randomFindings
  };

  prependAudit(newAudit);

  if (project) {
    updateProject(project.id, (current) => ({
      ...current,
      status: computedStatus,
      lastAuditScore: overallScore,
      lastAuditDate: newAudit.date
    }));
  }

  return { success: true, audit: newAudit };
}

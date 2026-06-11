import { ConsoleIssueStatus } from '@premortem/domain';

import type { AuditRun, Finding } from '@/lib/premortem-os/types';
import { performStaticAudit } from '@/lib/premortem-os/static-audit';

export function mapSandboxScanToAuditRun(customSnippet: string): AuditRun {
  const { overallScore, findings } = performStaticAudit(customSnippet);
  const auditId = `sandbox-${Date.now().toString(36)}`;

  const mappedFindings: Finding[] = findings.map((finding, index) => ({
    id: `${auditId}-finding-${index + 1}`,
    title: finding.title,
    severity: finding.severity,
    status: ConsoleIssueStatus.OPEN,
    category: finding.category,
    filepath: finding.filepath,
    line: finding.line,
    description: finding.description,
    evidence: finding.evidence,
    trace: finding.trace,
    recommendation: finding.recommendation,
    aiReasoning: finding.aiReasoning,
    suggestedPatchCode: finding.suggestedPatchCode
  }));

  const severityCounts = {
    critical: mappedFindings.filter((f) => f.severity === 'CRITICAL').length,
    high: mappedFindings.filter((f) => f.severity === 'HIGH').length,
    medium: mappedFindings.filter((f) => f.severity === 'MEDIUM').length,
    low: mappedFindings.filter((f) => f.severity === 'LOW').length
  };

  return {
    id: auditId,
    projectId: 'sandbox',
    projectName: 'Ad-hoc Sandbox',
    score: overallScore,
    status: 'COMPLETED',
    date: new Date().toISOString(),
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    findings: mappedFindings,
    runtimeEventTypes: ['sandbox.static_scan.completed']
  };
}

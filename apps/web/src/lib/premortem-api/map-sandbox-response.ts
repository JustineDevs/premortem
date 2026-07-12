import {
  buildTraceFromEvidence,
  formatSourceCodeEvidence,
  normalizeEvidenceRefs,
  parseFileEvidenceRef,
  primaryEvidenceLocation
} from '@premortem/domain';

import type { AuditRun, Finding, SeverityType } from '@/lib/premortem-os/types';

type SandboxSeverity = 'critical' | 'high' | 'medium' | 'low';

type SandboxFinding = {
  finding_id?: string;
  category: string;
  severity: SandboxSeverity;
  predicted_failure: {
    summary: string;
    failure_mode?: string | null;
    trigger_conditions: string[];
    blast_radius?: string | null;
  };
  why_it_matters?: string | null;
  affected_assets: string[];
  evidence: unknown;
  recommended_controls: string[];
};

function toSeverity(severity: SandboxSeverity): SeverityType {
  switch (severity) {
    case 'critical':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function deriveFindingTitle(finding: SandboxFinding) {
  const summary = finding.predicted_failure.summary.trim();
  const category = titleCase(finding.category);
  return summary.length > 0 ? `${category}: ${summary}` : `${category} Risk`;
}

function countBySeverity(findings: Finding[]) {
  return findings.reduce(
    (counts, finding) => {
      const key = finding.severity.toLowerCase() as keyof typeof counts;
      counts[key] += 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function buildSandboxCodeDna(finding: SandboxFinding, evidenceRefs: ReturnType<typeof normalizeEvidenceRefs>) {
  const primarySnippet = evidenceRefs.find((item) => item.codeSnippet?.trim());
  const citedEvidence = evidenceRefs.slice(0, 4).map((item, index) => {
    const parsed = parseFileEvidenceRef(item.ref);
    const citation = parsed
      ? `${parsed.filePath}:${parsed.startLine}${parsed.endLine > parsed.startLine ? `-${parsed.endLine}` : ''}`
      : item.ref;
    const reason = item.reason ? ` — ${item.reason}` : '';
    return `// Evidence citation ${index + 1}: ${citation}${reason}`;
  });

  const sourceExcerpt = primarySnippet?.codeSnippet?.trim()
    ? primarySnippet.codeSnippet
        .trim()
        .split('\n')
        .slice(0, 8)
        .map((line) => `// ${line}`)
    : ['// Source excerpt unavailable in this sandbox response.'];

  const controls = finding.recommended_controls.length > 0
    ? finding.recommended_controls.map((control, index) => `  // Control ${index + 1}: ${control.trim()}`)
    : ['  // Control 1: Preserve the surrounding behavior and add a regression test.'];

  return [
    `// Recommended code DNA for ${finding.predicted_failure.summary.trim() || finding.category}`,
    `// Goal: ${finding.why_it_matters?.trim() || finding.predicted_failure.failure_mode?.trim() || finding.predicted_failure.summary.trim() || 'Apply the smallest safe fix grounded in the evidence.'}`,
    ...citedEvidence,
    '',
    ...sourceExcerpt,
    '',
    'export function applySandboxFix() {',
    ...controls,
    '  return true;',
    '}'
  ].join('\n');
}

function mapCanonicalFinding(finding: SandboxFinding, index: number): Finding {
  const evidenceRefs = normalizeEvidenceRefs(finding.evidence);
  const primaryLocation = primaryEvidenceLocation(evidenceRefs);
  const trace = buildTraceFromEvidence(evidenceRefs);
  const evidence = formatSourceCodeEvidence(evidenceRefs);
  const description =
    finding.why_it_matters?.trim() ||
    finding.predicted_failure.failure_mode?.trim() ||
    finding.predicted_failure.summary.trim();
  const recommendation =
    finding.recommended_controls.map((control: string) => control.trim()).filter(Boolean).join(' · ') ||
    `Review ${finding.category.replace(/[_-]+/g, ' ')} controls.`;

  return {
    id: finding.finding_id || `sandbox-finding-${index + 1}`,
    title: deriveFindingTitle(finding),
    severity: toSeverity(finding.severity),
    status: 'OPEN',
    category: finding.category,
    filepath: primaryLocation.filepath,
    line: primaryLocation.line || 1,
    description,
    evidence,
    evidenceRefs,
    trace,
    recommendation,
    aiReasoning:
      finding.why_it_matters?.trim() ||
      finding.predicted_failure.failure_mode?.trim() ||
      finding.predicted_failure.summary.trim(),
    suggestedPatchCode: buildSandboxCodeDna(finding, evidenceRefs),
    whyItMatters: finding.why_it_matters?.trim()
  };
}

export function mapSandboxResponseToAuditRun(input: {
  projectId: string;
  projectName: string;
  overallScore: number;
  findings: SandboxFinding[];
  generatedAt?: string;
}): AuditRun {
  const findings = input.findings.map(mapCanonicalFinding);
  const severityCounts = countBySeverity(findings);
  const date = input.generatedAt ?? new Date().toISOString();

  return {
    id: `sandbox-${date.replace(/[:.]/g, '-')}`,
    projectId: input.projectId,
    projectName: input.projectName,
    score: input.overallScore,
    status: 'COMPLETED',
    date,
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    findings,
    isSandbox: true
  };
}

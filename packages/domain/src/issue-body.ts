import {
  formatSourceCodeEvidence,
  primaryEvidenceLocation,
  parseFileEvidenceRef,
  type EvidenceRefLike
} from './evidence-projection';
import { resolvePremortemPublishSiteUrl } from './branding';

export interface PublishedIssueBodyInput {
  title: string;
  category: string;
  severity: string;
  confidence: number;
  predictedFailureSummary: string;
  whyItMatters: string;
  triggerConditions: string[];
  evidence: EvidenceRefLike[];
  recommendedActionSummary: string;
  implementationSteps: string[];
  doneCriteria: string[];
  affectedAssets: string[];
  sourceAgents: string[];
  sourceFindings: string[];
}

export interface PublishedIssueBodyContext {
  issueCandidateId?: string;
  auditRunId?: string;
  branch?: string | null;
  commitSha?: string | null;
  projectPath?: string | null;
  createdAt?: string | null;
  reviewerStatus?: string;
  priority?: string;
  assignee?: string | null;
  milestone?: string | null;
  dueDate?: string | null;
  timeEstimate?: string | null;
  weight?: number | null;
}

function formatEvidenceCitationComment(item: EvidenceRefLike, index: number): string {
  const parsed = parseFileEvidenceRef(item.ref);
  const citation = parsed
    ? `${parsed.filePath}:${parsed.startLine}${parsed.endLine > parsed.startLine ? `-${parsed.endLine}` : ''}`
    : item.ref;
  const reason = item.reason ? ` — ${item.reason}` : '';
  return `// Evidence citation ${index + 1}: ${citation}${reason}`;
}

function buildRecommendedCodeDna(
  issue: PublishedIssueBodyInput,
  evidence: EvidenceRefLike[]
): string {
  const lines = [
    `// Recommended code DNA for ${issue.title}`,
    `// Goal: ${issue.recommendedActionSummary}`,
    ...evidence.slice(0, 4).map(formatEvidenceCitationComment),
    ...issue.implementationSteps.map((step, index) => `// Step ${index + 1}: ${step}`),
    '',
    'export function applyRecommendedChange() {',
    '  // Apply the smallest safe fix that satisfies the evidence above.',
    '  // Preserve surrounding behavior unless a step explicitly requires it.',
    '  return true;',
    '}'
  ];
  return lines.join('\n');
}

function formatRawCodeAnchors(evidence: EvidenceRefLike[]): string {
  const anchoredItems = evidence.filter((item) => item.codeSnippet?.trim());
  if (anchoredItems.length === 0) {
    return 'No code snippet was attached to these evidence refs.';
  }

  return anchoredItems
    .map((item, index) =>
      [
        `#### Evidence anchor ${index + 1}`,
        `- **Ref**: ${item.kind} · ${item.ref}`,
        ...(item.reason ? [`- **Reason**: ${item.reason}`] : []),
        '',
        '```ts',
        item.codeSnippet?.trim() ?? '',
        '```'
      ].join('\n')
    )
    .join('\n\n');
}

function formatReviewPosture(issue: PublishedIssueBodyInput, context: PublishedIssueBodyContext): string {
  const reviewerStatus = context.reviewerStatus?.trim() || 'pending';
  const artifactMode = reviewerStatus.toLowerCase() === 'approved'
    ? 'Reviewer-approved publish artifact'
    : 'Review draft with raw AI evidence attached';
  const evidenceCount = issue.evidence.length;
  const severity = issue.severity.trim() || 'unknown';
  const priority = context.priority?.trim() || 'normal';

  return [
    '## Review posture',
    '',
    `> **${artifactMode}**. The summary above is the reviewer-facing version; raw AI analysis, code anchors, and lineage remain below for auditability.`,
    '',
    '| Signal | Value |',
    '| --- | --- |',
    `| Severity | \`${severity}\` |`,
    `| Confidence | ${issue.confidence.toFixed(3)} |`,
    `| Priority | \`${priority}\` |`,
    `| Reviewer status | \`${reviewerStatus}\` |`,
    `| Evidence refs | ${evidenceCount} |`
  ].join('\n');
}

function formatEvidenceIndexTable(evidence: EvidenceRefLike[]): string {
  if (evidence.length === 0) {
    return 'No structured evidence refs were attached to this issue.';
  }

  return [
    '| # | Kind | Location | Snippet | Reason |',
    '| --- | --- | --- | --- | --- |',
    ...evidence.map((item, index) => {
      const parsed = parseFileEvidenceRef(item.ref);
      const location = parsed
        ? `${parsed.filePath}:${parsed.startLine}${parsed.endLine > parsed.startLine ? `-${parsed.endLine}` : ''}`
        : item.ref;
      const snippetState = item.codeSnippet?.trim() ? 'present' : 'not attached';
      const reason = item.reason ? item.reason.replace(/\|/g, '\\|') : 'none';
      return `| ${index + 1} | \`${item.kind}\` | \`${location}\` | ${snippetState} | ${reason} |`;
    })
  ].join('\n');
}

function extractTargetSyntaxEntity(issue: PublishedIssueBodyInput, evidence: EvidenceRefLike[]): string {
  for (const item of evidence) {
    const snippet = item.codeSnippet?.trim();
    if (!snippet) continue;

    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
      /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/,
      /class\s+([A-Za-z_$][\w$]*)/,
      /(?:public\s+)?([A-Za-z_$][\w$]*)\s*\(/
    ];

    for (const pattern of patterns) {
      const match = snippet.match(pattern);
      if (match?.[1]) return match[1];
    }
  }

  const fallback = primaryEvidenceLocation(evidence);
  return fallback.filepath !== 'repository' ? fallback.filepath.split('/').pop() ?? issue.title : issue.title;
}

function buildSystemGroundingManifest(
  issue: PublishedIssueBodyInput,
  context: PublishedIssueBodyContext,
  evidence: EvidenceRefLike[]
): string {
  const primaryLocation = primaryEvidenceLocation(evidence);
  const targetEntity = extractTargetSyntaxEntity(issue, evidence);
  const identifier = `PRM-TRK-${(context.commitSha ?? context.auditRunId ?? 'unknown')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 7) || 'unknown'}-${context.issueCandidateId ?? issue.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  const timestamp = context.createdAt ?? new Date().toISOString();

  return [
    '## System Grounding Manifest (SGM / ARPS)',
    '',
    '```text',
    `[[IDENTIFIER]] ${identifier}`,
    `[[TIMESTAMP]] ${timestamp}`,
    '[[SPEC TYPE]] Actionable Remediation Prompt Specification',
    '[[TARGET ENGINE REQUIREMENT]] Code Modification / Refactoring Agent',
    `[[TARGET REPOSITORY]] ${context.projectPath ?? 'unknown'}`,
    `[[ACTIVE BRANCH / COMMIT]] ${context.branch ?? 'unknown'} @ ${context.commitSha ?? 'unknown'}`,
    `[[DOMAIN CATEGORY]] ${issue.category}`,
    `[[IDENTIFIED CRITICALITY]] ${issue.severity}`,
    `[[REVIEW STATE]] ${context.reviewerStatus ?? 'pending'}`,
    `[[ARTIFACT MODE]] ${(context.reviewerStatus ?? '').toLowerCase() === 'approved' ? 'reviewer-approved publish artifact' : 'review draft with raw AI evidence'}`,
    `[[FILE TARGET PATH]] ${primaryLocation.filepath}`,
    `[[TARGET OBJECT / METHOD NAME]] ${targetEntity}`,
    `[[EVIDENCE SUMMARY]] ${issue.predictedFailureSummary}`,
    `[[BLAST RADIUS]] ${issue.whyItMatters}`,
    `[[SCOPE BOUNDARY]] Modify only the targeted syntax block and preserve the published contract.`,
    `[[SUCCESS CRITERIA]] ${issue.doneCriteria[0] ?? 'The fix is covered by a regression test and the unsafe path no longer passes.'}`,
    '```',
    '',
    '### Raw code anchors',
    formatRawCodeAnchors(evidence)
  ].join('\n');
}

function formatEvidenceComparison(issue: PublishedIssueBodyInput, evidence: EvidenceRefLike[]) {
  const recommendedCode = buildRecommendedCodeDna(issue, evidence);

  return [
    '## Evidence vs recommendation',
    '',
    '### Current code evidence',
    formatSourceCodeEvidence(evidence),
    '',
    '### Recommended code DNA',
    '```ts',
    recommendedCode,
    '```'
  ].join('\n');
}

function formatConsoleDeepLink(context: PublishedIssueBodyContext): string | undefined {
  if (!context.auditRunId) return undefined;

  const siteUrl = resolvePremortemPublishSiteUrl();
  const consoleUrl = `${siteUrl.replace(/\/$/, '')}/app?tab=audits&audit=${encodeURIComponent(context.auditRunId)}`;
  return `[Open in Premortem console](${consoleUrl})`;
}

/**
 * Render the canonical published issue body used by publish adapters and the reviewer console.
 *
 * The body is intentionally platform-neutral so GitLab, GitHub, and the `/app`
 * preview can stay byte-for-byte aligned for the core issue content.
 */
export function renderPublishedIssueBodyMarkdown(
  issue: PublishedIssueBodyInput,
  context: PublishedIssueBodyContext = {}
): string {
  const evidence = issue.evidence;
  const sections: string[] = [];

  sections.push(
    formatReviewPosture(issue, context),
    '',
    buildSystemGroundingManifest(issue, context, evidence),
    '',
    '## Predicted failure',
    issue.predictedFailureSummary,
    '',
    '## Why this matters',
    issue.whyItMatters
  );

  if (context.projectPath || context.branch || context.commitSha) {
    sections.push(
      '',
      '## Repository context',
      `- **Project**: ${context.projectPath ?? 'unknown'}`,
      ...(context.branch ? [`- **Branch**: \`${context.branch}\``] : []),
      ...(context.commitSha ? [`- **Commit**: \`${context.commitSha}\``] : []),
      ...(formatConsoleDeepLink(context) ? [`- **Console deep link**: ${formatConsoleDeepLink(context)}`] : [])
    );
  }

  sections.push(
    '',
    '## Trigger conditions',
    ...issue.triggerConditions.map((condition) => `- ${condition}`),
    '',
    '## Evidence',
    '### Evidence index',
    formatEvidenceIndexTable(evidence),
    '',
    formatSourceCodeEvidence(evidence),
    '',
    formatEvidenceComparison(issue, evidence),
    '',
    '## Affected assets',
    ...issue.affectedAssets.map((asset) => `- \`${asset}\``),
    '',
    '## Recommended action',
    issue.recommendedActionSummary,
    '',
    '## Implementation steps',
    ...issue.implementationSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Success criteria',
    ...issue.doneCriteria.map((criterion) => `- [ ] ${criterion}`),
    '',
    '## Lineage',
    `- **Category**: \`${issue.category}\``,
    `- **Severity**: \`${issue.severity}\``,
    `- **Confidence**: ${issue.confidence.toFixed(3)}`,
    `- **Source agents**: ${issue.sourceAgents.map((agent) => `\`${agent}\``).join(', ')}`,
    `- **Source findings**: ${issue.sourceFindings.map((id) => `\`${id}\``).join(', ')}`
  );

  if (
    context.auditRunId ||
    context.issueCandidateId ||
    context.reviewerStatus ||
    context.priority
  ) {
    sections.push(
      '',
      '## Premortem traceability',
      '| Field | Value |',
      '| --- | --- |',
      ...(context.issueCandidateId
        ? [`| Issue candidate | \`${context.issueCandidateId}\` |`]
        : []),
      ...(context.auditRunId ? [`| Audit run | \`${context.auditRunId}\` |`] : []),
      ...(context.reviewerStatus ? [`| Reviewer status | \`${context.reviewerStatus}\` |`] : []),
      ...(context.priority ? [`| Priority | \`${context.priority}\` |`] : [])
    );
  }

  const scheduling: string[] = [];
  if (context.assignee) scheduling.push(`- **Assignee**: @${context.assignee}`);
  if (context.milestone) scheduling.push(`- **Milestone**: ${context.milestone}`);
  if (context.dueDate) scheduling.push(`- **Due date**: ${context.dueDate}`);
  if (context.timeEstimate) scheduling.push(`- **Time estimate**: ${context.timeEstimate}`);
  if (context.weight != null) scheduling.push(`- **Weight**: ${context.weight}`);

  if (scheduling.length > 0) {
    sections.push('', '## Work item scheduling', ...scheduling);
  }

  return sections.join('\n');
}

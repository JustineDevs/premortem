import {
  formatSourceCodeEvidence,
  primaryEvidenceLocation,
  type EvidenceRefLike
} from './evidence-projection';

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

function buildRecommendedCodeDna(issue: PublishedIssueBodyInput): string {
  const lines = [
    `// Recommended change for ${issue.title}`,
    `// ${issue.recommendedActionSummary}`,
    ...issue.implementationSteps.map((step, index) => `// Step ${index + 1}: ${step}`)
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
  const recommendedCode = buildRecommendedCodeDna(issue);

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
      ...(context.commitSha ? [`- **Commit**: \`${context.commitSha}\``] : [])
    );
  }

  sections.push(
    '',
    '## Trigger conditions',
    ...issue.triggerConditions.map((condition) => `- ${condition}`),
    '',
    '## Evidence',
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

import type { IssueCandidate } from '@premortem/agent-kit';
import {
  PREMORTEM_PRODUCT_NAME,
  premortemPublishAttributionLogoCdnUrl,
  renderPremortemPublishAttribution,
  resolvePremortemPublishSiteUrl
} from '@premortem/domain';
import {
  renderPublishedIssueBodyMarkdown,
  type EvidenceRefLike,
  type PublishedIssueBodyContext,
  type PublishedIssueBodyInput
} from '@premortem/domain';

export interface GitLabIssueRenderContext extends PublishedIssueBodyContext {}

function stripGitLabQuickActionLines(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('/'))
    .join('\n');
}

function sanitizeText(value: string | null | undefined): string {
  return stripGitLabQuickActionLines((value ?? '').toString());
}

function sanitizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => sanitizeText(entry))
        .filter((entry) => entry.length > 0)
    : [];
}

function formatConfidencePercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const bounded = Math.max(0, Math.min(1, value));
  return `${Math.round(bounded * 100)}%`;
}

function formatReviewState(status: string | undefined): string {
  const normalized = sanitizeText(status ?? 'pending').toLowerCase();
  if (normalized === 'approved') return 'Reviewer-approved publish artifact';
  if (normalized === 'rejected') return 'Reviewer rejected, not publishable';
  return 'Reviewer draft, raw AI evidence preserved below';
}

function buildGitLabHeader(
  issue: IssueCandidate,
  context: GitLabIssueRenderContext,
  sourceCount: number
): string {
  const siteUrl = resolvePremortemPublishSiteUrl();
  const logoUrl = premortemPublishAttributionLogoCdnUrl(siteUrl);
  const branch = context.branch ?? 'unknown';
  const commitSha = context.commitSha ?? 'unknown';
  const issueCandidateId = context.issueCandidateId ?? 'unknown';
  const auditRunId = context.auditRunId ?? 'unknown';
  const assignee = context.assignee ? `@${context.assignee}` : 'unassigned';
  const milestone = context.milestone ?? 'none';
  const dueDate = context.dueDate ?? 'none';
  const timeEstimate = context.timeEstimate ?? 'none';
  const weight = context.weight != null ? String(context.weight) : 'none';
  const reviewerStatus = sanitizeText(context.reviewerStatus ?? 'pending') || 'pending';
  const confidence = formatConfidencePercent(Number(issue.confidence));
  const reviewState = formatReviewState(context.reviewerStatus);
  const consoleLink =
    auditRunId !== 'unknown'
      ? `[Open in Premortem console](${`${siteUrl.replace(/\/$/, '')}/app?tab=audits&audit=${encodeURIComponent(auditRunId)}`})`
      : 'unavailable';

  return [
    '<table>',
    '<tr>',
    `<td width="108" valign="top"><img src="${logoUrl}" alt="${PREMORTEM_PRODUCT_NAME}" width="80" /></td>`,
    '<td>',
    `# ${issue.title}`,
    '',
    `> **${PREMORTEM_PRODUCT_NAME} publish artifact**: reviewer-approved remediation brief for GitLab triage.`,
    `> Raw AI analysis remains visible below in the evidence and lineage sections.`,
    '',
    '| At a glance | Value |',
    '| --- | --- |',
    `| Severity | \`${sanitizeText(String(issue.severity))}\` |`,
    `| Confidence | ${confidence} |`,
    `| Priority | \`${sanitizeText(context.priority ?? 'normal')}\` |`,
    `| Review state | \`${reviewerStatus}\` |`,
    `| Evidence refs | ${sourceCount} |`,
    '',
    '| Traceability | Value |',
    '| --- | --- |',
    `| Issue candidate | \`${issueCandidateId}\` |`,
    `| Audit run | \`${auditRunId}\` |`,
    `| Category | \`${sanitizeText(issue.category)}\` |`,
    `| Branch | \`${branch}\` |`,
    `| Commit | \`${commitSha}\` |`,
    `| Assignee | ${assignee} |`,
    `| Milestone | ${sanitizeText(milestone)} |`,
    `| Due date | ${sanitizeText(dueDate)} |`,
    `| Time estimate | ${sanitizeText(timeEstimate)} |`,
    `| Weight | ${weight} |`,
    `| Console link | ${consoleLink} |`,
    '',
    `> ${sanitizeText(issue.predicted_failure_summary) || 'Published issue with grounded evidence and remediation guidance.'}`,
    '',
    `> ${reviewState}`,
    '</td>',
    '</tr>',
    '</table>',
    ''
  ].join('\n');
}

function toPublishedIssueBodyInput(issue: IssueCandidate): PublishedIssueBodyInput {
  return {
    title: issue.title,
    category: issue.category,
    severity: String(issue.severity),
    confidence: Number(issue.confidence),
    predictedFailureSummary: sanitizeText(issue.predicted_failure_summary),
    whyItMatters: sanitizeText(issue.why_it_matters),
    triggerConditions: sanitizeStringArray(issue.trigger_conditions),
    evidence: Array.isArray(issue.evidence) ? (issue.evidence as EvidenceRefLike[]) : [],
    recommendedActionSummary: sanitizeText(issue.recommended_action_summary),
    implementationSteps: sanitizeStringArray(issue.implementation_steps),
    doneCriteria: sanitizeStringArray(issue.done_criteria),
    affectedAssets: Array.isArray(issue.affected_assets)
      ? issue.affected_assets.filter((entry): entry is string => typeof entry === 'string')
      : [],
    sourceAgents: Array.isArray(issue.source_agents)
      ? issue.source_agents.filter((entry): entry is string => typeof entry === 'string')
      : [],
    sourceFindings: Array.isArray(issue.source_findings)
      ? issue.source_findings.filter((entry): entry is string => typeof entry === 'string')
      : []
  };
}

/**
 * Render the canonical issue body used for published work items.
 */
export function renderGitLabIssue(
  issue: IssueCandidate,
  context: GitLabIssueRenderContext = {}
): string {
  const input = toPublishedIssueBodyInput(issue);
  const sharedBody = renderPublishedIssueBodyMarkdown(input, context);
  const sourceCount = input.evidence.length;

  return [
    buildGitLabHeader(issue, context, sourceCount),
    sharedBody,
    '',
    '---',
    '',
    renderPremortemPublishAttribution({
      siteUrl: resolvePremortemPublishSiteUrl(),
      logoUrl: premortemPublishAttributionLogoCdnUrl(),
      productName: PREMORTEM_PRODUCT_NAME
    })
  ].join('\n');
}

/**
 * Render the canonical published issue body used by both GitLab and GitHub.
 *
 * The publisher adds the metadata footer after this shared body so the body
 * content stays identical across transports.
 */
export function renderPublishedIssueBody(
  issue: IssueCandidate,
  context: GitLabIssueRenderContext = {}
): string {
  return renderGitLabIssue(issue, context);
}

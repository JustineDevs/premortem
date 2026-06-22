import type { IssueCandidate } from '@premortem/agent-kit';
import {
  renderPublishedIssueBodyMarkdown,
  type EvidenceRefLike,
  type PublishedIssueBodyContext,
  type PublishedIssueBodyInput
} from '@premortem/domain';

export interface GitLabIssueRenderContext extends PublishedIssueBodyContext {}

function toPublishedIssueBodyInput(issue: IssueCandidate): PublishedIssueBodyInput {
  return {
    title: issue.title,
    category: issue.category,
    severity: String(issue.severity),
    confidence: Number(issue.confidence),
    predictedFailureSummary: issue.predicted_failure_summary,
    whyItMatters: issue.why_it_matters,
    triggerConditions: Array.isArray(issue.trigger_conditions)
      ? issue.trigger_conditions.filter((entry): entry is string => typeof entry === 'string')
      : [],
    evidence: Array.isArray(issue.evidence) ? (issue.evidence as EvidenceRefLike[]) : [],
    recommendedActionSummary: issue.recommended_action_summary,
    implementationSteps: Array.isArray(issue.implementation_steps)
      ? issue.implementation_steps.filter((entry): entry is string => typeof entry === 'string')
      : [],
    doneCriteria: Array.isArray(issue.done_criteria)
      ? issue.done_criteria.filter((entry): entry is string => typeof entry === 'string')
      : [],
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
  return renderPublishedIssueBodyMarkdown(toPublishedIssueBodyInput(issue), context);
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

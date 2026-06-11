import { prisma, resolveGitHubCredentialsForProject } from '@premortem/db';
import {
  createGitHubIssue,
  ensureGitHubLabels,
  parseGitHubRepoFromUrl
} from '@premortem/integrations';
import type { FindingSeverity } from '@premortem/agent-kit';
import { renderGitLabIssue } from '@premortem/orchestrator';

import { buildPublishWorkItemAttributes, resolveWorkItemAttributeConfig } from './resolve-work-item-attributes';

interface PublishableIssue {
  id: string;
  organizationId: string;
  projectId: string;
  auditRunId: string;
  reviewerStatus: string;
  title: string;
  category: string;
  severity: string;
  priority: string;
  confidence: unknown;
  predictedFailureSummary: string;
  whyItMatters: string;
  triggerConditions: unknown;
  evidence: unknown;
  recommendedActionSummary: string;
  implementationSteps: unknown;
  doneCriteria: unknown;
  affectedAssets: unknown;
  sourceAgents: unknown;
  sourceFindings: unknown;
  project: { externalProjectId: string; repoUrl: string | null; provider: string };
  publishedIssue: { id: string; url: string | null } | null;
  auditRun?: { branch: string; commitSha: string | null } | null;
}

export async function publishIssueCandidateToGitHub(issue: PublishableIssue) {
  if (issue.reviewerStatus !== 'approved' && issue.reviewerStatus !== 'edited') {
    throw new Error('Issue candidate must be approved before publish');
  }

  if (issue.publishedIssue) {
    return { publishedIssue: issue.publishedIssue, alreadyPublished: true as const };
  }

  const credentials = await resolveGitHubCredentialsForProject(issue.projectId);
  if (!credentials) {
    throw new Error('GitHub credentials are required to publish issues');
  }

  const repo =
    parseGitHubRepoFromUrl(issue.project.repoUrl) ??
    parseGitHubRepoFromUrl(`https://github.com/${issue.project.externalProjectId}`);

  if (!repo) {
    throw new Error('Unable to resolve GitHub repository coordinates for publish');
  }

  const attributes = await buildPublishWorkItemAttributes({
    organizationId: issue.organizationId,
    projectId: issue.projectId,
    issueCandidateId: issue.id,
    auditRunId: issue.auditRunId,
    branch: issue.auditRun?.branch,
    commitSha: issue.auditRun?.commitSha,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    priority: issue.priority,
    confidence: Number(issue.confidence),
    reviewerStatus: issue.reviewerStatus,
    sourceAgents: issue.sourceAgents
  });

  const description =
    renderGitLabIssue({
      title: issue.title,
      category: issue.category,
      severity: issue.severity as FindingSeverity,
      confidence: Number(issue.confidence),
      predicted_failure_summary: issue.predictedFailureSummary,
      why_it_matters: issue.whyItMatters,
      trigger_conditions: issue.triggerConditions as string[],
      evidence: issue.evidence as Array<{ kind: string; ref: string; reason: string }>,
      recommended_action_summary: issue.recommendedActionSummary,
      implementation_steps: issue.implementationSteps as string[],
      done_criteria: issue.doneCriteria as string[],
      affected_assets: issue.affectedAssets as string[],
      source_agents: issue.sourceAgents as string[],
      source_findings: issue.sourceFindings as string[]
    }) + attributes.metadataFooter;

  const config = await resolveWorkItemAttributeConfig(issue.organizationId);
  if (config.github.ensureRepositoryLabels) {
    await ensureGitHubLabels(credentials.token, repo, attributes.labelDefinitions);
  }

  const created = await createGitHubIssue(credentials.token, {
    owner: repo.owner,
    repo: repo.repo,
    title: issue.title,
    body: description,
    labels: attributes.labels
  });

  const publishedIssue = await prisma.publishedIssue.create({
    data: {
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      issueCandidateId: issue.id,
      provider: 'github',
      externalIssueId: String(created.id),
      externalIssueIid: String(created.number),
      url: created.html_url,
      syncStatus: 'created',
      publishedTitle: issue.title,
      publishedBodyMd: description,
      labels: attributes.labels,
      publishedAt: new Date(),
      lastSyncedAt: new Date()
    }
  });

  return { publishedIssue, alreadyPublished: false as const };
}

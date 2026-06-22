/**
 * GitLab publish adapter for approved issue candidates.
 *
 * This module formats reviewer-approved issue data into GitLab issue bodies,
 * applies work-item metadata, creates the remote issue, and records the publish result.
 */
import { prisma, resolveGitLabCredentialsForProject } from '@premortem/db';
import { createOrganizationNotifications } from '@premortem/db/notifications';
import { recordUsageEvent } from '@premortem/db';
import { resolvePremortemPublishSiteUrl } from '@premortem/domain';
import { createGitLabIssue, ensureGitLabLabels, ensureGitLabProjectIssueWebhook, updateGitLabIssueTimeEstimate } from '@premortem/integrations';
import type { FindingSeverity } from '@premortem/agent-kit';
import type { EvidenceRefLike } from '@premortem/domain';
import { captureServerException } from '@premortem/observability/server';
import { renderPublishedIssueBody } from '@premortem/orchestrator/render-gitlab-issue';

import { buildPublishWorkItemAttributes, resolveWorkItemAttributeConfig } from './resolve-work-item-attributes';

/**
 * Internal publish payload normalized from the issue candidate read model.
 *
 * Several fields remain `unknown` because they are validated and narrowed by the
 * caller before publish formatting, and the publish path only needs them as
 * structured pass-through data for the GitLab body renderer.
 */
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
  project: { externalProjectId: string; provider: string; repoUrl?: string | null };
  publishedIssue: { id: string; url: string | null } | null;
  auditRun?: { branch: string; commitSha: string | null } | null;
  createdAt?: string | Date | null;
}

type PublishableEvidence = EvidenceRefLike;

/**
 * Publish one approved issue candidate to GitLab and persist the resulting
 * published-issue row for reconciliation and notification fan-out.
 *
 * @param issue - Approved issue candidate plus project and audit context.
 * @returns The persisted published issue and whether the item was already published.
 * @throws When the issue is not approved, credentials are missing, or the GitLab API fails.
 */
export async function publishIssueCandidateToGitLab(issue: PublishableIssue) {
  if (issue.reviewerStatus !== 'approved' && issue.reviewerStatus !== 'edited') {
    throw new Error('Issue candidate must be approved before publish');
  }

  if (issue.publishedIssue) {
    return { publishedIssue: issue.publishedIssue, alreadyPublished: true as const };
  }

  const credentials = await resolveGitLabCredentialsForProject(issue.projectId);
  if (!credentials) {
    throw new Error('GitLab credentials are required to publish issues');
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
    renderPublishedIssueBody(
      {
        title: issue.title,
        category: issue.category,
        severity: issue.severity as FindingSeverity,
        confidence: Number(issue.confidence),
        predicted_failure_summary: issue.predictedFailureSummary,
        why_it_matters: issue.whyItMatters,
        trigger_conditions: issue.triggerConditions as string[],
        evidence: issue.evidence as PublishableEvidence[],
        recommended_action_summary: issue.recommendedActionSummary,
        implementation_steps: issue.implementationSteps as string[],
        done_criteria: issue.doneCriteria as string[],
        affected_assets: issue.affectedAssets as string[],
        source_agents: issue.sourceAgents as string[],
        source_findings: issue.sourceFindings as string[]
      },
      {
        issueCandidateId: issue.id,
        auditRunId: issue.auditRunId,
        branch: issue.auditRun?.branch,
        commitSha: issue.auditRun?.commitSha,
        projectPath: issue.project.repoUrl ?? issue.project.externalProjectId,
        createdAt: issue.createdAt ? new Date(issue.createdAt).toISOString() : null,
        reviewerStatus: issue.reviewerStatus,
        priority: issue.priority,
        assignee: attributes.gitlabScheduling.assigneeUsername ?? null,
        milestone: attributes.gitlabScheduling.milestoneTitle ?? null,
        dueDate: attributes.gitlabScheduling.dueDate ?? null,
        timeEstimate: attributes.gitlabScheduling.timeEstimate ?? null,
        weight: attributes.gitlabScheduling.weight ?? null
      }
    ) + attributes.metadataFooter;

  const config = await resolveWorkItemAttributeConfig(issue.organizationId);
  if (config.gitlab.ensureProjectLabels) {
    try {
      await ensureGitLabLabels(
        credentials.baseUrl,
        credentials.token,
        issue.project.externalProjectId,
        attributes.labelDefinitions
      );
    } catch (error) {
      captureServerException(error, {
        surface: 'publish-to-gitlab.ensure-labels',
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        externalProjectId: issue.project.externalProjectId
      });
    }
  }

  const created = await createGitLabIssue(credentials.baseUrl, credentials.token, {
    projectId: issue.project.externalProjectId,
    title: issue.title,
    description,
    labels: attributes.labels,
    assigneeIds: attributes.gitlabScheduling.assigneeIds,
    milestoneId: attributes.gitlabScheduling.milestoneId,
    dueDate: attributes.gitlabScheduling.dueDate,
    weight: attributes.gitlabScheduling.weight
  });

  if (attributes.gitlabScheduling.timeEstimate) {
    try {
      await updateGitLabIssueTimeEstimate(
        credentials.baseUrl,
        credentials.token,
        issue.project.externalProjectId,
        created.iid,
        attributes.gitlabScheduling.timeEstimate
      );
    } catch (error) {
      captureServerException(error, {
        surface: 'publish-to-gitlab.time-estimate',
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        externalProjectId: issue.project.externalProjectId,
        issueIid: created.iid
      });
    }
  }

  const publishedIssue = await prisma.publishedIssue.create({
    data: {
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      issueCandidateId: issue.id,
      provider: 'gitlab',
      externalIssueId: String(created.id),
      externalIssueIid: String(created.iid),
      url: created.web_url,
      syncStatus: 'created',
      publishedTitle: issue.title,
      publishedBodyMd: description,
      labels: attributes.labels,
      publishedAt: new Date(),
      lastSyncedAt: new Date()
    }
  });

  await createOrganizationNotifications({
    organizationId: issue.organizationId,
    projectId: issue.projectId,
    kind: 'issue_published',
    title: `Published to GitLab: ${issue.title}`,
    body: `Issue ${issue.id} was published to GitLab as #${created.iid}.`,
    url: created.web_url,
    metadata: {
      provider: 'gitlab',
      auditRunId: issue.auditRunId,
      issueCandidateId: issue.id,
      publishedIssueId: publishedIssue.id
    }
  }).catch((error) => {
    captureServerException(error, {
      surface: 'publish-to-gitlab.notification-fanout',
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      externalProjectId: issue.project.externalProjectId,
      issueCandidateId: issue.id
    });
  });

  await recordUsageEvent({
    organizationId: issue.organizationId,
    projectId: issue.projectId,
    auditRunId: issue.auditRunId,
    eventType: 'publish',
    quantity: 1,
    unit: 'issue',
    metadata: {
      provider: 'gitlab',
      issueCandidateId: issue.id,
      externalIssueId: String(created.id)
    }
  });

  const webhookSecret = process.env.GITLAB_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    try {
      await ensureGitLabProjectIssueWebhook({
        baseUrl: credentials.baseUrl,
        token: credentials.token,
        externalProjectId: issue.project.externalProjectId,
        webhookUrl: `${resolvePremortemPublishSiteUrl()}/api/webhooks/gitlab`,
        secretToken: webhookSecret
      });
    } catch (error) {
      captureServerException(error, {
        surface: 'publish-to-gitlab.ensure-webhook',
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        externalProjectId: issue.project.externalProjectId
      });
    }
  }

  return { publishedIssue, alreadyPublished: false as const };
}

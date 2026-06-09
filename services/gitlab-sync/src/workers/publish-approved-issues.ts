import { prisma } from '@premortem/db';
import { createGitLabIssue } from '@premortem/integrations';
import { renderGitLabIssue } from '@premortem/orchestrator';

export async function publishApprovedIssues() {
  const issues = await prisma.issueCandidate.findMany({
    where: {
      reviewerStatus: 'approved',
      publishedIssue: null
    },
    include: {
      project: true
    },
    take: 25
  });

  for (const issue of issues) {
    const baseUrl = process.env.GITLAB_BASE_URL ?? 'https://gitlab.com';
    const token = process.env.GITLAB_TOKEN;
    if (!token) throw new Error('GITLAB_TOKEN is required');

    const description = renderGitLabIssue({
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
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
    });

    const created = await createGitLabIssue(baseUrl, token, {
      projectId: issue.project.externalProjectId,
      title: issue.title,
      description,
      labels: ['premortem', issue.category, issue.severity]
    });

    await prisma.publishedIssue.create({
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
        labels: ['premortem', issue.category, issue.severity],
        publishedAt: new Date(),
        lastSyncedAt: new Date()
      }
    });
  }

  return { publishedCount: issues.length };
}

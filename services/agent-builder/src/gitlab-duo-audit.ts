import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@premortem/db';
import { buildWorkerRegisteredAgents, executeAuditJob, getAuditRunSnapshot, submitAudit } from '@premortem/orchestrator';
import { fetchGitLabMergeRequest } from '@premortem/integrations';

export interface GitLabDuoAuditInput {
  externalProjectId: string;
  branch?: string;
  mergeRequestIid?: number | null;
  commitSha?: string | null;
  gitlabBaseUrl?: string;
  gitlabToken?: string;
  rootDir?: string;
}

function resolvePremortemRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name === 'premortem') {
          return current;
        }
      } catch {
        // keep walking
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

function severityRank(severity: string) {
  switch (String(severity).toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function buildTopClusters(clusters: NonNullable<Awaited<ReturnType<typeof getAuditRunSnapshot>>>['clusters']) {
  return [...clusters]
    .sort((left, right) => {
      const severityDelta = severityRank(right.severity) - severityRank(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return right.findingCount - left.findingCount;
    })
    .slice(0, 5)
    .map((cluster) => ({
      clusterId: cluster.id,
      categoryOwner: cluster.categoryOwner,
      titleHint: cluster.titleHint ?? null,
      severity: cluster.severity,
      findingCount: cluster.findingCount,
      memberFindingIds: cluster.memberFindingIds ?? []
    }));
}

function buildSuggestedIssues(
  issueCandidates: NonNullable<Awaited<ReturnType<typeof getAuditRunSnapshot>>>['issueCandidates']
) {
  return [...issueCandidates]
    .sort((left, right) => {
      const priorityOrder: Record<string, number> = { p0: 4, p1: 3, p2: 2, p3: 1 };
      const leftCandidate = left as { priority?: string; confidence?: number };
      const rightCandidate = right as { priority?: string; confidence?: number };
      const leftPriority = priorityOrder[String(leftCandidate.priority ?? 'p3').toLowerCase()] ?? 0;
      const rightPriority = priorityOrder[String(rightCandidate.priority ?? 'p3').toLowerCase()] ?? 0;
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return (Number(rightCandidate.confidence ?? 0) || 0) - (Number(leftCandidate.confidence ?? 0) || 0);
    })
    .slice(0, 3)
    .map((issue) => {
      const candidate = issue as { priority?: string; confidence?: number };
      return {
        issueCandidateId: issue.id,
        clusterId: issue.clusterId ?? null,
        title: issue.title,
        category: issue.category,
        priority: candidate.priority ?? 'p3',
        confidence: Number(candidate.confidence ?? 0),
        validationStatus: issue.validationStatus,
        reviewerStatus: issue.reviewerStatus,
        summary: issue.predictedFailureSummary ?? '',
        recommendedActionSummary: issue.recommendedActionSummary ?? '',
        publishedUrl: issue.publishedUrl ?? null,
        evidence: issue.evidence ?? []
      };
    });
}

export async function runGitLabDuoAudit(input: GitLabDuoAuditInput) {
  const externalProjectId = input.externalProjectId.trim();
  if (!externalProjectId) {
    throw new Error('externalProjectId is required.');
  }

  const project = await prisma.project.findUnique({
    where: {
      provider_externalProjectId: {
        provider: 'gitlab',
        externalProjectId
      }
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      externalProjectId: true,
      defaultBranch: true,
      repoUrl: true
    }
  });

  if (!project) {
    throw new Error(
      `Premortem project not found for GitLab repository ${externalProjectId}. Enable the repository in Premortem before running an audit.`
    );
  }

  const gitlabBaseUrl = input.gitlabBaseUrl?.trim() || process.env.GITLAB_BASE_URL?.trim() || 'https://gitlab.com';
  const gitlabToken = input.gitlabToken?.trim() || process.env.GITLAB_TOKEN?.trim() || '';
  let resolvedBranch = input.branch?.trim() || project.defaultBranch?.trim() || 'main';
  let resolvedCommitSha = input.commitSha?.trim() || '';
  let resolvedMergeRequest = null;

  if (input.mergeRequestIid !== null && input.mergeRequestIid !== undefined) {
    if (!gitlabToken) {
      throw new Error('GITLAB_TOKEN is required when resolving merge request context.');
    }
    resolvedMergeRequest = await fetchGitLabMergeRequest({
      baseUrl: gitlabBaseUrl,
      token: gitlabToken,
      externalProjectId,
      iid: input.mergeRequestIid
    });
    resolvedBranch = resolvedMergeRequest.sourceBranch || resolvedBranch;
    resolvedCommitSha = resolvedCommitSha || resolvedMergeRequest.sha;
  }

  if (!resolvedBranch) {
    throw new Error('branch is required after resolving GitLab context.');
  }

  const rootDir = input.rootDir?.trim() || resolvePremortemRepoRoot();
  const submission = await submitAudit({
    organizationId: project.organizationId,
    projectId: project.id,
    branch: resolvedBranch,
    commitSha: resolvedCommitSha || undefined,
    triggeredById: undefined,
    triggerSource: 'api'
  });

  await executeAuditJob({
    job: submission.job,
    rootDir,
    registryAgents: buildWorkerRegisteredAgents(rootDir)
  });

  const snapshot = await getAuditRunSnapshot(submission.auditRunId);
  if (!snapshot) {
    throw new Error(`Audit run ${submission.auditRunId} completed without a snapshot.`);
  }

  return {
    agent: 'premortem-gitlab-duo-audit',
    project: {
      id: project.id,
      externalProjectId: project.externalProjectId,
      name: project.name,
      repoUrl: project.repoUrl ?? null
    },
    input: {
      externalProjectId,
      branch: resolvedBranch,
      mergeRequestIid: resolvedMergeRequest?.iid ?? input.mergeRequestIid ?? null,
      commitSha: resolvedCommitSha || null
    },
    auditRunId: snapshot.auditRunId,
    runStatus: snapshot.runStatus,
    counts: snapshot.counts,
    orbit: {
      status: 'embedded',
      note: 'Orbit context is already loaded by the audit pipeline before the agent swarm runs.'
    },
    topClusters: buildTopClusters(snapshot.clusters),
    suggestedIssues: buildSuggestedIssues(snapshot.issueCandidates),
    issueCandidates: snapshot.issueCandidates,
    findings: snapshot.findings,
    evidenceCount: snapshot.findings.reduce((total, finding) => total + (finding.evidence?.length ?? 0), 0),
    graphSnapshot: snapshot.graphSnapshot,
    events: snapshot.events,
    nextSteps: [
      'Review the top clusters and evidence snippets in the Premortem reviewer console.',
      'Edit the suggested issue candidates before publishing to GitLab.',
      'Use approve/reject controls in the review workflow to keep the GitLab publish gate human-reviewed.'
    ]
  };
}

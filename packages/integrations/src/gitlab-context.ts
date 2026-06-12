import { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabJobSummary {
  id: number;
  name: string;
  stage: string;
  status: string;
  webUrl: string;
  durationSeconds: number | null;
  failureReason: string | null;
}

export interface GitLabPipelineSummary {
  id: number;
  status: string;
  ref: string;
  sha: string;
  webUrl: string;
  createdAt: string;
  durationSeconds: number | null;
  failedJobs: GitLabJobSummary[];
}

export interface GitLabIssueSummary {
  iid: number;
  title: string;
  state: string;
  labels: string[];
  updatedAt: string;
  webUrl: string;
}

export interface GitLabCiHistorySummary {
  pipelines: GitLabPipelineSummary[];
  totals: {
    sampled: number;
    failed: number;
    success: number;
    successRate: number;
  };
  recentFailedStages: string[];
}

export const EMPTY_CI_HISTORY: GitLabCiHistorySummary = {
  pipelines: [],
  totals: { sampled: 0, failed: 0, success: 0, successRate: 0 },
  recentFailedStages: []
};

async function gitlabRequest(baseUrl: string, token: string, apiPath: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4${apiPath}`, {
    headers: gitLabAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`GitLab API ${apiPath} failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

function mapJob(row: {
  id: number;
  name: string;
  stage: string;
  status: string;
  web_url: string;
  duration?: number | null;
  failure_reason?: string | null;
}): GitLabJobSummary {
  return {
    id: row.id,
    name: row.name,
    stage: row.stage,
    status: row.status,
    webUrl: row.web_url,
    durationSeconds: typeof row.duration === 'number' ? row.duration : null,
    failureReason: row.failure_reason ?? null
  };
}

export async function fetchRecentGitLabPipelines(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ref?: string;
  maxPipelines?: number;
  maxFailedJobsPerPipeline?: number;
}): Promise<GitLabCiHistorySummary> {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const maxPipelines = input.maxPipelines ?? 15;
  const maxFailedJobs = input.maxFailedJobsPerPipeline ?? 8;
  const params = new URLSearchParams({
    per_page: String(maxPipelines),
    order_by: 'updated_at',
    sort: 'desc'
  });
  if (input.ref?.trim()) {
    params.set('ref', input.ref.trim());
  }

  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/pipelines?${params.toString()}`
  );

  const rows = (await response.json()) as Array<{
    id: number;
    status: string;
    ref: string;
    sha: string;
    web_url: string;
    created_at: string;
    duration?: number | null;
  }>;

  const pipelines: GitLabPipelineSummary[] = [];
  const recentFailedStages = new Set<string>();
  let failed = 0;
  let success = 0;

  for (const row of rows) {
    if (row.status === 'failed') failed += 1;
    if (row.status === 'success') success += 1;

    let failedJobs: GitLabJobSummary[] = [];
    if (row.status === 'failed' || row.status === 'canceled') {
      try {
        const jobsResponse = await gitlabRequest(
          input.baseUrl,
          input.token,
          `/projects/${encodedProject}/pipelines/${row.id}/jobs?per_page=100`
        );
        const jobs = (await jobsResponse.json()) as Array<{
          id: number;
          name: string;
          stage: string;
          status: string;
          web_url: string;
          duration?: number | null;
          failure_reason?: string | null;
        }>;
        failedJobs = jobs
          .filter((job) => job.status === 'failed' || job.status === 'canceled')
          .slice(0, maxFailedJobs)
          .map(mapJob);
        for (const job of failedJobs) {
          recentFailedStages.add(job.stage);
        }
      } catch {
        // pipeline job fetch is best-effort
      }
    }

    pipelines.push({
      id: row.id,
      status: row.status,
      ref: row.ref,
      sha: row.sha,
      webUrl: row.web_url,
      createdAt: row.created_at,
      durationSeconds: typeof row.duration === 'number' ? row.duration : null,
      failedJobs
    });
  }

  const sampled = pipelines.length;
  const successRate = sampled > 0 ? success / sampled : 0;

  return {
    pipelines,
    totals: { sampled, failed, success, successRate },
    recentFailedStages: [...recentFailedStages]
  };
}

export async function fetchOpenGitLabIssues(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  maxIssues?: number;
}): Promise<GitLabIssueSummary[]> {
  const encodedProject = encodeURIComponent(input.externalProjectId);
  const maxIssues = input.maxIssues ?? 40;
  const response = await gitlabRequest(
    input.baseUrl,
    input.token,
    `/projects/${encodedProject}/issues?state=opened&order_by=updated_at&sort=desc&per_page=${maxIssues}`
  );

  const rows = (await response.json()) as Array<{
    iid: number;
    title: string;
    state: string;
    labels?: string[];
    updated_at: string;
    web_url: string;
  }>;

  return rows.map((row) => ({
    iid: row.iid,
    title: row.title,
    state: row.state,
    labels: row.labels ?? [],
    updatedAt: row.updated_at,
    webUrl: row.web_url
  }));
}

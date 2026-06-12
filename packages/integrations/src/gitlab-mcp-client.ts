import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { gitLabAuthHeaders } from './gitlab-auth';
import type { GitLabCiHistorySummary, GitLabIssueSummary } from './gitlab-context';
import { EMPTY_CI_HISTORY } from './gitlab-context';

export interface GitLabMcpClientOptions {
  baseUrl: string;
  token: string;
  toolPrefix?: string;
}

export interface GitLabMcpContextResult {
  ci_history: GitLabCiHistorySummary;
  existing_issues: GitLabIssueSummary[];
  toolCalls: string[];
  transport: 'gitlab-mcp';
}

function gitlabMcpUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/api/v4/mcp`;
}

function pickToolName(available: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const exact = available.find((name) => name === candidate);
    if (exact) return exact;
    const suffix = available.find((name) => name.endsWith(`_${candidate}`) || name.endsWith(candidate));
    if (suffix) return suffix;
  }
  return undefined;
}

function readTextContent(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return JSON.stringify(result);
  return content
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const text = (entry as { text?: unknown }).text;
      return typeof text === 'string' ? text : JSON.stringify(entry);
    })
    .filter(Boolean)
    .join('\n');
}

function parseJsonPayload<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mapIssuesFromMcp(payload: unknown): GitLabIssueSummary[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { issues?: unknown })?.issues)
      ? ((payload as { issues: unknown[] }).issues ?? [])
      : Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: unknown[] }).data ?? [])
        : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const issue = row as Record<string, unknown>;
      const iid = typeof issue.iid === 'number' ? issue.iid : Number(issue.iid);
      const title = typeof issue.title === 'string' ? issue.title : '';
      if (!Number.isFinite(iid) || !title) return null;
      return {
        iid,
        title,
        state: typeof issue.state === 'string' ? issue.state : 'opened',
        labels: Array.isArray(issue.labels)
          ? issue.labels.filter((label): label is string => typeof label === 'string')
          : [],
        updatedAt:
          typeof issue.updated_at === 'string'
            ? issue.updated_at
            : typeof issue.updatedAt === 'string'
              ? issue.updatedAt
              : new Date().toISOString(),
        webUrl:
          typeof issue.web_url === 'string'
            ? issue.web_url
            : typeof issue.webUrl === 'string'
              ? issue.webUrl
              : ''
      } satisfies GitLabIssueSummary;
    })
    .filter((row): row is GitLabIssueSummary => row !== null);
}

function mapPipelinesFromMcp(payload: unknown): GitLabCiHistorySummary {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { pipelines?: unknown })?.pipelines)
      ? ((payload as { pipelines: unknown[] }).pipelines ?? [])
      : [];

  const pipelines: GitLabCiHistorySummary['pipelines'] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const pipeline = row as Record<string, unknown>;
    const id = typeof pipeline.id === 'number' ? pipeline.id : Number(pipeline.id);
    if (!Number.isFinite(id)) continue;
    pipelines.push({
      id,
      status: typeof pipeline.status === 'string' ? pipeline.status : 'unknown',
      ref: typeof pipeline.ref === 'string' ? pipeline.ref : 'main',
      sha: typeof pipeline.sha === 'string' ? pipeline.sha : '',
      webUrl:
        typeof pipeline.web_url === 'string'
          ? pipeline.web_url
          : typeof pipeline.webUrl === 'string'
            ? pipeline.webUrl
            : '',
      createdAt:
        typeof pipeline.created_at === 'string'
          ? pipeline.created_at
          : new Date().toISOString(),
      durationSeconds:
        typeof pipeline.duration === 'number'
          ? pipeline.duration
          : typeof pipeline.durationSeconds === 'number'
            ? pipeline.durationSeconds
            : null,
      failedJobs: []
    });
  }

  const failed = pipelines.filter((pipeline) => pipeline.status === 'failed').length;
  const success = pipelines.filter((pipeline) => pipeline.status === 'success').length;
  const sampled = pipelines.length;

  return {
    pipelines,
    totals: {
      sampled,
      failed,
      success,
      successRate: sampled > 0 ? success / sampled : 0
    },
    recentFailedStages: []
  };
}

export async function withGitLabMcpClient<T>(
  options: GitLabMcpClientOptions,
  fn: (client: Client, toolNames: string[]) => Promise<T>
): Promise<T> {
  const headers: Record<string, string> = {
    ...gitLabAuthHeaders(options.token)
  };
  if (options.toolPrefix) {
    headers['X-Gitlab-Mcp-Server-Tool-Name-Prefix'] = options.toolPrefix;
  }

  const transport = new StreamableHTTPClientTransport(new URL(gitlabMcpUrl(options.baseUrl)), {
    requestInit: { headers }
  });

  const client = new Client({ name: 'premortem-gitlab-mcp', version: '1.0.0' });
  await client.connect(transport);

  try {
    const listed = await client.listTools();
    return await fn(client, listed.tools.map((tool) => tool.name));
  } finally {
    await client.close();
  }
}

export async function fetchGitLabContextViaMcp(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ref?: string;
  toolPrefix?: string;
  timeoutMs?: number;
}): Promise<GitLabMcpContextResult> {
  const timeoutMs = input.timeoutMs ?? 15_000;

  return Promise.race([
    fetchGitLabContextViaMcpInner(input),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`GitLab MCP timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

async function fetchGitLabContextViaMcpInner(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ref?: string;
  toolPrefix?: string;
}): Promise<GitLabMcpContextResult> {
  const toolCalls: string[] = [];

  return withGitLabMcpClient(
    {
      baseUrl: input.baseUrl,
      token: input.token,
      toolPrefix: input.toolPrefix ?? 'premortem'
    },
    async (client, toolNames) => {
      const projectId = input.externalProjectId;
      const ref = input.ref ?? 'main';

      const pipelineTool = pickToolName(toolNames, [
        'list_pipelines',
        'get_pipelines',
        'pipelines_list',
        'list_project_pipelines'
      ]);
      const issueTool = pickToolName(toolNames, [
        'list_issues',
        'get_issues',
        'issues_list',
        'list_project_issues'
      ]);

      let ci_history: GitLabCiHistorySummary = { ...EMPTY_CI_HISTORY };
      let existing_issues: GitLabIssueSummary[] = [];

      if (pipelineTool) {
        toolCalls.push(pipelineTool);
        const result = await client.callTool({
          name: pipelineTool,
          arguments: {
            project_id: projectId,
            ref,
            per_page: 10,
            status: 'any'
          }
        });
        const parsed =
          parseJsonPayload<unknown>(readTextContent(result)) ??
          (result.structuredContent as unknown | undefined);
        ci_history = mapPipelinesFromMcp(parsed ?? result);
      }

      if (issueTool) {
        toolCalls.push(issueTool);
        const result = await client.callTool({
          name: issueTool,
          arguments: {
            project_id: projectId,
            state: 'opened',
            per_page: 25
          }
        });
        const parsed =
          parseJsonPayload<unknown>(readTextContent(result)) ??
          (result.structuredContent as unknown | undefined);
        existing_issues = mapIssuesFromMcp(parsed ?? result);
      }

      if (toolCalls.length === 0) {
        throw new Error(`GitLab MCP server returned no usable tools (found: ${toolNames.join(', ')})`);
      }

      return {
        ci_history,
        existing_issues,
        toolCalls,
        transport: 'gitlab-mcp'
      };
    }
  );
}

export function isGitLabMcpEnabled() {
  return process.env.PREMORTEM_GITLAB_MCP !== '0';
}

import {
  EMPTY_CI_HISTORY as MCP_EMPTY_CI,
  fetchGitLabContextViaMcp,
  fetchOpenGitLabIssues,
  fetchRecentGitLabPipelines,
  fetchRepositoryFileRaw,
  fetchRepositoryTree,
  isGitLabMcpEnabled
} from '@premortem/integrations';

import { EMPTY_CI_HISTORY, type IngestionBundle } from './ingest-project';

const CI_FILE_NAMES = ['.gitlab-ci.yml', '.gitlab-ci.yaml'];
const MANIFEST_NAMES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'docker-compose.yml', 'wrangler.toml'];
const DOC_FILES = ['README.md', 'readme.md', 'docs/README.md'];

function uniqueTopLevelDirs(paths: string[], prefix: string) {
  const names = new Set<string>();
  for (const entry of paths) {
    if (!entry.startsWith(`${prefix}/`)) continue;
    const remainder = entry.slice(prefix.length + 1);
    const top = remainder.split('/')[0];
    if (top) names.add(top);
  }
  return [...names];
}

export async function ingestGitLabProject(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  branch: string;
  commitSha?: string;
}): Promise<IngestionBundle> {
  const treeEntries = await fetchRepositoryTree({
    baseUrl: input.baseUrl,
    token: input.token,
    externalProjectId: input.externalProjectId,
    ref: input.branch
  });

  const repo_tree = treeEntries.map((entry) => entry.path);
  const pipeline_files: string[] = [];
  const ci_config: Record<string, unknown> = {};
  const package_manifests: string[] = [];

  for (const fileName of CI_FILE_NAMES) {
    if (!repo_tree.includes(fileName)) continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: fileName
      });
      pipeline_files.push(fileName);
      ci_config[fileName] = {
        present: true,
        lineCount: content.split('\n').length,
        preview: content.split('\n').slice(0, 24).join('\n')
      };
    } catch {
      // skip unreadable CI file
    }
  }

  for (const fileName of MANIFEST_NAMES) {
    if (repo_tree.includes(fileName)) {
      package_manifests.push(fileName);
    }
  }

  const docs: Record<string, string> = {};
  for (const docPath of DOC_FILES) {
    if (!repo_tree.includes(docPath)) continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: docPath
      });
      docs[docPath] = content.split('\n').slice(0, 40).join('\n');
    } catch {
      // skip
    }
  }

  let ci_history = EMPTY_CI_HISTORY;
  let existing_issues: IngestionBundle['existing_issues'] = [];
  let mcpMetadata: Record<string, unknown> = {};

  if (isGitLabMcpEnabled()) {
    try {
      const mcpContext = await fetchGitLabContextViaMcp({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        toolPrefix: 'premortem'
      });
      ci_history = mcpContext.ci_history;
      existing_issues = mcpContext.existing_issues;
      mcpMetadata = {
        ingestionTransport: mcpContext.transport,
        mcpToolCalls: mcpContext.toolCalls,
        mcpPipelineCount: mcpContext.ci_history.pipelines.length,
        mcpOpenIssueCount: mcpContext.existing_issues.length
      };
    } catch (error) {
      mcpMetadata = {
        ingestionTransport: 'gitlab-mcp-fallback-rest',
        mcpError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const needsRestFallback =
    !isGitLabMcpEnabled() ||
    mcpMetadata.ingestionTransport === 'gitlab-mcp-fallback-rest' ||
    ci_history.pipelines.length === 0 ||
    existing_issues.length === 0;

  if (needsRestFallback) {
    const [restCi, restIssues] = await Promise.all([
      fetchRecentGitLabPipelines({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch
      }).catch(() => EMPTY_CI_HISTORY),
      fetchOpenGitLabIssues({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId
      }).catch(() => [])
    ]);

    if (ci_history.pipelines.length === 0) {
      ci_history = restCi.pipelines.length > 0 ? restCi : MCP_EMPTY_CI;
    }
    if (existing_issues.length === 0) {
      existing_issues = restIssues;
    }
    if (!mcpMetadata.ingestionTransport) {
      mcpMetadata = { ingestionTransport: 'gitlab-rest' };
    }
  }

  const apps = uniqueTopLevelDirs(repo_tree, 'apps');
  const services = uniqueTopLevelDirs(repo_tree, 'services');

  return {
    repoRoot: `gitlab://${input.externalProjectId}`,
    branch: input.branch,
    commitSha: input.commitSha,
    repo_tree,
    ci_config,
    has_ci: pipeline_files.length > 0 || ci_history.pipelines.length > 0,
    package_manifests,
    pipeline_files,
    services,
    apps,
    ci_history,
    existing_issues,
    metadata: {
      source: 'gitlab',
      externalProjectId: input.externalProjectId,
      appCount: apps.length,
      serviceCount: services.length,
      treeEntryCount: repo_tree.length,
      docs,
      ciHistorySampled: ci_history.totals.sampled,
      openIssueCount: existing_issues.length,
      ...mcpMetadata
    }
  };
}

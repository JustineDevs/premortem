import {
  fetchRepositoryCommitsByPath,
  fetchGitLabContextViaMcp,
  fetchRepositoryFileRaw,
  fetchRepositoryTree,
  isGitLabMcpEnabled
} from '@premortem/integrations';
import { fetchVulnerabilityContext } from '@premortem/ingestion';
import { searchPriorFindings } from '@premortem/integrations';

import {
  buildSourceSnapshot,
  EMPTY_CI_HISTORY,
  type GitHistorySnapshot,
  findAgentPromptPaths,
  findAuthPatternPaths,
  parseJsonIfPresent,
  parseLockfilePackages,
  parsePackageJsonDependencyNames,
  parseTomlLikeConfig,
  parseOwnershipHints,
  sampleText,
  selectHighRiskSourceFilePaths,
  selectPackageJsonPaths,
  selectSourceFilePaths,
  type IngestionBundle,
  summarizeTextPreview
} from './ingest-project';

const CI_FILE_NAMES = ['.gitlab-ci.yml', '.gitlab-ci.yaml'];
const MANIFEST_NAMES = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'docker-compose.yml',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb'
];
const DOC_FILES = ['README.md', 'readme.md', 'docs/README.md'];
const SCHEMA_NAMES = ['schema.prisma', 'openapi.yaml', 'openapi.yml'];
const OWNERSHIP_FILES = ['CODEOWNERS', '.github/CODEOWNERS'];

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

function isGitLabMcpUnavailableError(error: unknown) {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return [
    '404 Not Found',
    '404',
    '502 Bad Gateway',
    '503 Service Unavailable',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'Failed to fetch',
    'fetch failed',
    'Streamable HTTP error'
  ].some((needle) => message.includes(needle));
}

export async function ingestGitLabProject(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  branch: string;
  commitSha?: string;
  projectId?: string;
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
  const source_files: IngestionBundle['source_files'] = [];
  const ownership_hints: IngestionBundle['ownership_hints'] = [];
  const git_history: GitHistorySnapshot[] = [];
  const source_code_samples: Record<string, string> = {};
  const auth_patterns: string[] = [];
  let agent_registry: string | undefined;
  const agent_prompts: Record<string, string> = {};
  const mcp_config: Record<string, unknown> = {};
  const packageDependencyNames = new Set<string>();
  let pnpmLockContent: string | null = null;

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
      ci_config[fileName] = { present: true, ...summarizeTextPreview(content, 24) };
      source_files.push(buildSourceSnapshot(fileName, content, 'config'));
    } catch {
      // skip unreadable CI file
    }
  }

  for (const fileName of MANIFEST_NAMES) {
    if (repo_tree.includes(fileName)) {
      package_manifests.push(fileName);
      try {
        const content = await fetchRepositoryFileRaw({
          baseUrl: input.baseUrl,
          token: input.token,
          externalProjectId: input.externalProjectId,
          ref: input.branch,
          filePath: fileName
        });
        source_files.push(buildSourceSnapshot(fileName, content, 'manifest'));
        if (fileName === 'package.json') {
          for (const dependencyName of parsePackageJsonDependencyNames(content)) {
            packageDependencyNames.add(dependencyName);
          }
        }
        if (fileName === 'pnpm-lock.yaml') {
          pnpmLockContent = content;
        }
      } catch {
        // skip unreadable manifest file
      }
    }
  }

  for (const packageJsonPath of selectPackageJsonPaths(repo_tree)) {
    if (packageJsonPath === 'package.json') continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: packageJsonPath
      });
      for (const dependencyName of parsePackageJsonDependencyNames(content)) {
        packageDependencyNames.add(dependencyName);
      }
      source_files.push(buildSourceSnapshot(packageJsonPath, content, 'manifest'));
    } catch {
      // skip unreadable package manifest
    }
  }

  const exactLockfilePackages = pnpmLockContent ? parseLockfilePackages(pnpmLockContent) : [];
  const filteredLockfilePackages =
    packageDependencyNames.size > 0
      ? exactLockfilePackages.filter((entry) => packageDependencyNames.has(entry.name))
      : exactLockfilePackages;
  const lockfile_packages = (
    filteredLockfilePackages.length > 0 ? filteredLockfilePackages : exactLockfilePackages
  ).slice(0, 500);
  const vulnerability_context = await fetchVulnerabilityContext(lockfile_packages);
  const prior_findings = input.projectId
    ? await searchPriorFindings({
        projectId: input.projectId,
        query: 'recurring failure risk regression'
      })
    : [];

  for (const schemaName of SCHEMA_NAMES) {
    const matched = repo_tree.find((entry) => entry.endsWith(schemaName));
    if (!matched) continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: matched
      });
      source_files.push(buildSourceSnapshot(matched, content, 'schema'));
    } catch {
      // skip unreadable schema file
    }
  }

  for (const ownershipFile of OWNERSHIP_FILES) {
    if (!repo_tree.includes(ownershipFile)) continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: ownershipFile
      });
      source_files.push(buildSourceSnapshot(ownershipFile, content, 'ownership'));
      ownership_hints.push(...parseOwnershipHints(content, ownershipFile));
    } catch {
      // skip unreadable ownership file
    }
  }

  for (const highRiskPath of selectHighRiskSourceFilePaths(repo_tree)) {
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: highRiskPath
      });
      source_code_samples[highRiskPath] = sampleText(content);
    } catch {
      // skip unreadable sample
    }
  }

  for (const authPath of findAuthPatternPaths(repo_tree)) {
    auth_patterns.push(authPath);
  }
  const uniqueAuthPatterns = [...new Set(auth_patterns)];
  auth_patterns.splice(0, auth_patterns.length, ...uniqueAuthPatterns);

  if (repo_tree.includes('.agents/registry.yaml')) {
    try {
      agent_registry = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: '.agents/registry.yaml'
      });
    } catch {
      // skip unreadable agent registry
    }
  }

  for (const promptPath of findAgentPromptPaths(repo_tree)) {
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: promptPath
      });
      agent_prompts[promptPath] = content;
    } catch {
      // skip unreadable prompt
    }
  }

  for (const configFile of ['mcp.local.json', 'mcp.json']) {
    if (!repo_tree.includes(configFile)) continue;
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: configFile
      });
      if (configFile.endsWith('.json')) {
        const parsed = parseJsonIfPresent(content);
        if (parsed) {
          mcp_config[configFile] = parsed;
        }
      } else {
        mcp_config[configFile] = parseTomlLikeConfig(content);
      }
    } catch {
      // skip unreadable MCP config
    }
  }

  for (const sourcePath of selectSourceFilePaths(repo_tree)) {
    try {
      const content = await fetchRepositoryFileRaw({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: sourcePath
      });
      source_files.push(buildSourceSnapshot(sourcePath, content, 'source'));
      const commits = await fetchRepositoryCommitsByPath({
        baseUrl: input.baseUrl,
        token: input.token,
        externalProjectId: input.externalProjectId,
        ref: input.branch,
        filePath: sourcePath,
        maxCommits: 5
      });
      if (commits.length > 0) {
        git_history.push({ path: sourcePath, commits });
      }
    } catch {
      // skip unreadable source file
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
      if (isGitLabMcpUnavailableError(error)) {
        mcpMetadata = {
          ingestionTransport: 'gitlab-rest-fallback',
          mcpUnavailable: true,
          mcpUnavailableReason: error instanceof Error ? error.message : String(error)
        };
      } else {
        throw new Error(
          `GitLab MCP ingest failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } else {
    mcpMetadata = { ingestionTransport: 'gitlab-mcp-disabled' };
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
    lockfile_packages,
    vulnerability_context,
    source_code_samples,
    auth_patterns,
    prior_findings,
    agent_registry,
    agent_prompts,
    mcp_config,
    pipeline_files,
    services,
    apps,
    source_files,
    ownership_hints,
    git_history,
    ci_history,
    existing_issues,
    metadata: {
      source: 'gitlab',
      externalProjectId: input.externalProjectId,
      appCount: apps.length,
      serviceCount: services.length,
      treeEntryCount: repo_tree.length,
      docs,
      sourceFileCount: source_files.length,
      ownershipHintCount: ownership_hints.length,
      lockfilePackageCount: lockfile_packages.length,
      vulnerabilityHitCount: vulnerability_context.hits.length,
      priorFindingCount: prior_findings.length,
      sourceCodeSampleCount: Object.keys(source_code_samples).length,
      authPatternCount: auth_patterns.length,
      agentPromptCount: Object.keys(agent_prompts).length,
      hasAgentRegistry: Boolean(agent_registry),
      hasMcpConfig: Object.keys(mcp_config).length > 0,
      gitHistoryPathCount: git_history.length,
      gitHistoryCommitCount: git_history.reduce((count, entry) => count + entry.commits.length, 0),
      ciHistorySampled: ci_history.totals.sampled,
      openIssueCount: existing_issues.length,
      ...mcpMetadata
    }
  };
}

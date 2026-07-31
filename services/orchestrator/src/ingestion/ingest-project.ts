import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  fetchVulnerabilityContext,
  type LockfilePackage,
  type VulnerabilityContext
} from '@premortem/ingestion';
import { searchPriorFindings } from '@premortem/integrations';
import type { GitLabMergeRequestDiffSummary } from '@premortem/integrations';
import type { GitLabCiHistorySummary, GitLabIssueSummary } from '@premortem/integrations';
import { extractRiskIntentCandidates } from '@premortem/db';

const CI_FILE_NAMES = ['.gitlab-ci.yml', '.gitlab-ci.yaml'];
const MANIFEST_NAMES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'docker-compose.yml'];
const DEPENDENCY_FILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.ts', '.cjs', '.mts', '.cts'];
const SCHEMA_NAMES = ['schema.prisma', 'openapi.yaml', 'openapi.yml'];
const OWNERSHIP_FILES = ['CODEOWNERS', '.github/CODEOWNERS'];
const AGENT_PROMPT_DIR = '.agents/prompts';
const AGENT_REGISTRY_PATH = '.agents/registry.yaml';
const MCP_CONFIG_FILES = ['mcp.local.json', 'mcp.json'];
const MAX_SOURCE_SAMPLE_LINES = 120;
const MAX_SOURCE_FILES = 80;
const MAX_PREVIEW_LINES = 120;
const execFileAsync = promisify(execFile);

export type SourceFileSnapshot = {
  path: string;
  kind: 'source' | 'manifest' | 'schema' | 'ownership' | 'doc' | 'config';
  lineCount: number;
  preview: string;
};

export type OwnershipHint = {
  path: string;
  owner: string;
  pattern: string;
};

export type GitHistoryCommit = {
  id: string;
  shortId: string;
  title: string;
  authorName: string;
  authoredAt: string;
  committedAt: string;
  webUrl: string;
};

export type GitHistorySnapshot = {
  path: string;
  commits: GitHistoryCommit[];
};

export interface IngestionBundle {
  repoRoot: string;
  branch: string;
  commitSha?: string;
  repo_tree: string[];
  ci_config: Record<string, unknown>;
  has_ci: boolean;
  package_manifests: string[];
  lockfile_packages: LockfilePackage[];
  vulnerability_context: VulnerabilityContext;
  source_code_samples: Record<string, string>;
  auth_patterns: string[];
  prior_findings: Array<{ fact: string; valid_at: string | null }>;
  risk_intents: Array<{
    type: string;
    source: string;
    summary: string;
    evidence: unknown;
    detectedFrom: unknown;
    confidence: number;
    expiresAt?: Date | null;
  }>;
  merge_request?: {
    iid: number;
    title?: string;
    sourceBranch?: string;
    targetBranch?: string;
    sha?: string;
    webUrl?: string;
    action?: string;
    changedFileCount: number;
    diffSnippet: string;
    changes?: GitLabMergeRequestDiffSummary['changes'];
  };
  agent_registry?: string;
  agent_prompts?: Record<string, string>;
  mcp_config?: Record<string, unknown>;
  pipeline_files: string[];
  services: string[];
  apps: string[];
  source_files: SourceFileSnapshot[];
  ownership_hints: OwnershipHint[];
  git_history: GitHistorySnapshot[];
  ci_history: GitLabCiHistorySummary;
  existing_issues: GitLabIssueSummary[];
  metadata: Record<string, unknown>;
}

export const EMPTY_CI_HISTORY: GitLabCiHistorySummary = {
  pipelines: [],
  totals: { sampled: 0, failed: 0, success: 0, successRate: 0 },
  recentFailedStages: []
};

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(target: string) {
  if (!(await pathExists(target))) return null;
  return fs.readFile(target, 'utf8');
}

export function summarizeTextPreview(content: string, maxLines = MAX_PREVIEW_LINES) {
  const lines = content.split('\n');
  return {
    lineCount: lines.length,
    preview: lines.slice(0, maxLines).join('\n')
  };
}

export function buildSourceSnapshot(
  filePath: string,
  content: string,
  kind: 'source' | 'manifest' | 'schema' | 'ownership' | 'doc' | 'config'
) {
  return { path: filePath, kind, ...summarizeTextPreview(content) };
}

export function parseOwnershipHints(content: string, sourcePath: string) {
  const hints: Array<{ path: string; owner: string; pattern: string }> = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const [pattern, ...owners] = parts;
    for (const owner of owners) {
      hints.push({ path: sourcePath, owner, pattern });
    }
  }
  return hints;
}

export function isSourceFilePath(filePath: string) {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

export function selectSourceFilePaths(repoTree: string[]) {
  return repoTree
    .filter((entry) => !entry.endsWith('/') && isSourceFilePath(entry))
    .filter((entry) => !entry.includes('node_modules/') && !entry.includes('/dist/'))
    .slice(0, MAX_SOURCE_FILES);
}

export function isHighRiskSourcePath(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/api/') ||
    normalized.includes('/db/') ||
    /(^|\/)(auth[^/]*|middleware[^/]*)(\.[^.\/]+)?$/i.test(normalized) ||
    /(^|\/)auth(\/|$)/i.test(normalized) ||
    /(^|\/)middleware(\/|$)/i.test(normalized)
  );
}

export function selectHighRiskSourceFilePaths(repoTree: string[]) {
  return repoTree
    .filter((entry) => !entry.endsWith('/') && isSourceFilePath(entry) && isHighRiskSourcePath(entry))
    .filter((entry) => !entry.includes('node_modules/') && !entry.includes('/dist/'))
    .slice(0, MAX_SOURCE_FILES);
}

export function sampleText(content: string, maxLines = MAX_SOURCE_SAMPLE_LINES) {
  return content.split('\n').slice(0, maxLines).join('\n');
}

export const EMPTY_VULNERABILITY_CONTEXT: VulnerabilityContext = {
  hits: [],
  scannedPackageCount: 0,
  kevCount: 0,
  highEpssCount: 0,
  source: 'unavailable'
};

export function buildSandboxIngestionBundle(input: {
  branch: string;
  commitSha?: string;
  codeSnippet: string;
}): IngestionBundle {
  const sourcePath = 'sandbox-snippet.ts';
  const sourceCode = input.codeSnippet.trim();
  const sourceCodeSamples: Record<string, string> = sourceCode
    ? { [sourcePath]: sampleText(sourceCode) }
    : {};

  return {
    repoRoot: 'sandbox://snippet',
    branch: input.branch,
    commitSha: input.commitSha,
    repo_tree: [sourcePath],
    ci_config: {},
    has_ci: false,
    package_manifests: [],
    lockfile_packages: [],
    vulnerability_context: EMPTY_VULNERABILITY_CONTEXT,
    source_code_samples: sourceCodeSamples,
    auth_patterns: [],
    prior_findings: [],
    risk_intents: extractRiskIntentCandidates({
      repo_tree: [sourcePath],
      source_files: sourceCode ? [buildSourceSnapshot(sourcePath, sourceCode, 'source')] : [],
      source_code_samples: sourceCodeSamples,
      agent_prompts: {},
      existing_issues: [],
      metadata: {
        sandbox: true
      }
    }),
    agent_registry: undefined,
    agent_prompts: {},
    mcp_config: {},
    pipeline_files: [],
    services: [],
    apps: [],
    source_files: sourceCode
      ? [buildSourceSnapshot(sourcePath, sourceCode, 'source')]
      : [],
    ownership_hints: [],
    git_history: [],
    ci_history: EMPTY_CI_HISTORY,
    existing_issues: [],
    metadata: {
      sandbox: true,
      sourceCodeSampleCount: Object.keys(sourceCodeSamples).length
    }
  };
}

export function parsePackageJsonDependencyNames(content: string) {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const dependencySections = ['dependencies', 'devDependencies'] as const;
    const names: string[] = [];

    for (const section of dependencySections) {
      const sectionValue = parsed[section];
      if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) continue;
      for (const [name, version] of Object.entries(sectionValue as Record<string, unknown>)) {
        if (typeof version !== 'string' || !version.trim()) continue;
        names.push(name);
      }
    }

    return names;
  } catch {
    return [];
  }
}

export function parseLockfilePackages(content: string, allowedNames?: Set<string>) {
  const packages: LockfilePackage[] = [];
  const lines = content.split(/\r?\n/);
  let inPackagesSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!inPackagesSection) {
      if (line.trim() === 'packages:') {
        inPackagesSection = true;
      }
      continue;
    }

    if (!line.trim()) continue;
    if (!line.startsWith('  ')) break;

    const keyMatch = line.match(/^\s{2}(['"]?)([^'"]+)\1:\s*$/);
    if (!keyMatch) continue;

    const rawKey = keyMatch[2]?.trim();
    if (!rawKey) continue;

    const normalizedKey = rawKey.replace(/^\/+/, '');
    const versionMatch = normalizedKey.match(/^(.*)@([^@]+?)(?:\([^)]*\))?$/);
    if (!versionMatch) continue;

    let packageName = versionMatch[1] ?? '';
    const version = versionMatch[2] ?? '';
    if (!packageName || !version) continue;

    if (packageName.startsWith('@')) {
      packageName = packageName.replace(/@([^/]+)\/(.+)/, '@$1/$2');
    }

    if (allowedNames && !allowedNames.has(packageName)) continue;

    packages.push({
      name: packageName,
      version,
      ecosystem: 'npm'
    });
  }

  return packages;
}

function dedupeLockfilePackages(packages: LockfilePackage[]) {
  const seen = new Set<string>();
  return packages.filter((entry) => {
    const key = `${entry.ecosystem}:${entry.name}@${entry.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseTomlLikeConfig(content: string) {
  const lines = content.split(/\r?\n/);
  const result: Record<string, unknown> = {};
  let currentSection = result;
  const sectionStack: Array<{ indent: number; target: Record<string, unknown> }> = [{ indent: -1, target: result }];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    while (sectionStack.length > 1 && indent <= sectionStack[sectionStack.length - 1].indent) {
      sectionStack.pop();
    }
    currentSection = sectionStack[sectionStack.length - 1].target;

    const sectionMatch = trimmed.match(/^\[([^[\]]+)\]$/);
    if (sectionMatch) {
      const pathParts = sectionMatch[1].split('.').map((part) => part.trim()).filter(Boolean);
      let target = result;
      for (const part of pathParts) {
        const existing = target[part];
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
          target[part] = {};
        }
        target = target[part] as Record<string, unknown>;
      }
      sectionStack.push({ indent, target });
      currentSection = target;
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const [, key, rawValue] = kvMatch;
    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue === 'true'
          ? true
          : rawValue === 'false'
            ? false
            : Number.isFinite(Number(rawValue))
              ? Number(rawValue)
              : rawValue;
    currentSection[key] = value;
  }

  return result;
}

export function findAgentPromptPaths(repoTree: string[]) {
  return repoTree.filter((entry) => entry.startsWith(`${AGENT_PROMPT_DIR}/`) && entry.endsWith('.md'));
}

export function findAuthPatternPaths(repoTree: string[]) {
  const authPattern = /(^|\/)(auth[^/]*|middleware[^/]*)(\.[^.\/]+)?$/i;
  return [...new Set(repoTree.filter((entry) => authPattern.test(entry) || entry.includes('/api/auth/') || entry.includes('/auth/')))].slice(0, MAX_SOURCE_FILES);
}

export function selectPackageJsonPaths(repoTree: string[]) {
  return repoTree
    .filter((entry) => entry === 'package.json' || entry.endsWith('/package.json'))
    .slice(0, MAX_SOURCE_FILES);
}

export function parseJsonIfPresent(content: string) {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function listChildDirs(target: string) {
  if (!(await pathExists(target))) return [] as string[];
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readGitHistoryForFile(
  rootDir: string,
  filePath: string,
  maxCommits = 5
): Promise<GitHistoryCommit[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      [
        '-C',
        rootDir,
        'log',
        `--max-count=${maxCommits}`,
        '--format=%H%x1f%h%x1f%an%x1f%ad%x1f%cd%x1f%s',
        '--date=iso-strict',
        '--',
        filePath
      ],
      { maxBuffer: 1024 * 1024 }
    );

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, shortId, authorName, authoredAt, committedAt, title] = line.split('\x1f');
        return {
          id: id ?? '',
          shortId: shortId ?? id?.slice(0, 8) ?? '',
          authorName: authorName ?? 'unknown',
          authoredAt: authoredAt ?? '',
          committedAt: committedAt ?? '',
          title: title ?? '',
          webUrl: ''
        };
      })
      .filter((commit) => Boolean(commit.id));
  } catch {
    return [];
  }
}

async function collectRepoTree(rootDir: string, maxDepth = 3, maxEntries = 120) {
  const tree: string[] = [];

  async function walk(current: string, depth: number) {
    if (depth > maxDepth || tree.length >= maxEntries) return;
    const relative = path.relative(rootDir, current) || '.';
    tree.push(relative);

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (tree.length >= maxEntries) break;
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), depth + 1);
      } else if (entry.isFile()) {
        tree.push(path.join(relative, entry.name));
      }
    }
  }

  await walk(rootDir, 0);
  return tree.slice(0, maxEntries);
}

export async function ingestProject(input: {
  rootDir: string;
  branch: string;
  commitSha?: string;
  projectId?: string;
}): Promise<IngestionBundle> {
  const repoRoot = path.resolve(input.rootDir);
  const repo_tree = await collectRepoTree(repoRoot);

  const pipeline_files: string[] = [];
  const ci_config: Record<string, unknown> = {};
  const source_files: IngestionBundle['source_files'] = [];
  const ownership_hints: IngestionBundle['ownership_hints'] = [];
  const git_history: IngestionBundle['git_history'] = [];
  const source_code_samples: Record<string, string> = {};
  const auth_patterns: string[] = [];
  let agent_registry: string | undefined;
  const agent_prompts: Record<string, string> = {};
  const mcp_config: Record<string, unknown> = {};
  const packageDependencyNames = new Set<string>();
  let pnpmLockContent: string | null = null;

  for (const fileName of CI_FILE_NAMES) {
    const absolute = path.join(repoRoot, fileName);
    const content = await readTextIfExists(absolute);
    if (content) {
      pipeline_files.push(fileName);
      ci_config[fileName] = { present: true, ...summarizeTextPreview(content, 24) };
      source_files.push(buildSourceSnapshot(fileName, content, 'config'));
    }
  }

  const githubWorkflowDir = path.join(repoRoot, '.github', 'workflows');
  if (await pathExists(githubWorkflowDir)) {
    const workflows = await fs.readdir(githubWorkflowDir);
    for (const workflow of workflows) {
      const relative = path.join('.github/workflows', workflow);
      pipeline_files.push(relative);
      const content = await readTextIfExists(path.join(repoRoot, relative));
      if (content) {
        ci_config[relative] = { present: true, ...summarizeTextPreview(content, 24) };
        source_files.push(buildSourceSnapshot(relative, content, 'config'));
      }
    }
  }

  const package_manifests: string[] = [];
  for (const fileName of MANIFEST_NAMES) {
    if (await pathExists(path.join(repoRoot, fileName))) {
      package_manifests.push(fileName);
      const content = await readTextIfExists(path.join(repoRoot, fileName));
      if (content) {
        source_files.push(buildSourceSnapshot(fileName, content, 'manifest'));
      }
    }
  }

  for (const packageJsonPath of selectPackageJsonPaths(repo_tree)) {
    const content = await readTextIfExists(path.join(repoRoot, packageJsonPath));
    if (!content) continue;
    for (const dependencyName of parsePackageJsonDependencyNames(content)) {
      packageDependencyNames.add(dependencyName);
    }
    if (packageJsonPath !== 'package.json') {
      source_files.push(buildSourceSnapshot(packageJsonPath, content, 'manifest'));
    }
  }

  for (const fileName of DEPENDENCY_FILES) {
    if (!(await pathExists(path.join(repoRoot, fileName)))) continue;
    const content = await readTextIfExists(path.join(repoRoot, fileName));
    if (content) {
      source_files.push(buildSourceSnapshot(fileName, content, 'manifest'));
      if (fileName === 'pnpm-lock.yaml') {
        pnpmLockContent = content;
      }
    }
  }

  const exactLockfilePackages = pnpmLockContent
    ? parseLockfilePackages(pnpmLockContent)
    : [];
  const filteredLockfilePackages =
    packageDependencyNames.size > 0
      ? exactLockfilePackages.filter((entry) => packageDependencyNames.has(entry.name))
      : exactLockfilePackages;
  const lockfile_packages = dedupeLockfilePackages(
    (filteredLockfilePackages.length > 0 ? filteredLockfilePackages : exactLockfilePackages).slice(
      0,
      500
    )
  );
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
    const content = await readTextIfExists(path.join(repoRoot, matched));
    if (content) {
      source_files.push(buildSourceSnapshot(matched, content, 'schema'));
    }
  }

  for (const ownershipFile of OWNERSHIP_FILES) {
    const content = await readTextIfExists(path.join(repoRoot, ownershipFile));
    if (!content) continue;
    source_files.push(buildSourceSnapshot(ownershipFile, content, 'ownership'));
    ownership_hints.push(...parseOwnershipHints(content, ownershipFile));
  }

  for (const sourcePath of selectSourceFilePaths(repo_tree)) {
    const content = await readTextIfExists(path.join(repoRoot, sourcePath));
    if (!content) continue;
    source_files.push(buildSourceSnapshot(sourcePath, content, 'source'));
    const commits = await readGitHistoryForFile(repoRoot, sourcePath);
    if (commits.length > 0) {
      git_history.push({ path: sourcePath, commits });
    }
  }

  for (const highRiskPath of selectHighRiskSourceFilePaths(repo_tree)) {
    const content = await readTextIfExists(path.join(repoRoot, highRiskPath));
    if (!content) continue;
    source_code_samples[highRiskPath] = sampleText(content);
  }

  for (const authPath of findAuthPatternPaths(repo_tree)) {
    auth_patterns.push(authPath);
  }
  auth_patterns.splice(0, auth_patterns.length, ...new Set(auth_patterns));

  const agentRegistryContent = await readTextIfExists(path.join(repoRoot, AGENT_REGISTRY_PATH));
  if (agentRegistryContent) {
    agent_registry = agentRegistryContent;
  }

  for (const promptPath of findAgentPromptPaths(repo_tree)) {
    const content = await readTextIfExists(path.join(repoRoot, promptPath));
    if (content) {
      agent_prompts[promptPath] = content;
    }
  }

  for (const configFile of MCP_CONFIG_FILES) {
    const content = await readTextIfExists(path.join(repoRoot, configFile));
    if (!content) continue;
    if (configFile.endsWith('.json')) {
      const parsed = parseJsonIfPresent(content);
      if (parsed) {
        mcp_config[configFile] = parsed;
      }
      continue;
    }

    if (configFile.endsWith('.toml')) {
      mcp_config[configFile] = parseTomlLikeConfig(content);
    }
  }

  const apps = await listChildDirs(path.join(repoRoot, 'apps'));
  const services = await listChildDirs(path.join(repoRoot, 'services'));
  const risk_intents = extractRiskIntentCandidates({
    repo_tree,
    source_files,
    source_code_samples,
    agent_prompts,
    existing_issues: [],
    metadata: {
      repoRoot,
      branch: input.branch,
      commitSha: input.commitSha ?? null
    }
  });

  return {
    repoRoot,
    branch: input.branch,
    commitSha: input.commitSha,
    repo_tree,
    ci_config,
    has_ci: pipeline_files.length > 0,
    package_manifests,
    lockfile_packages,
    vulnerability_context,
    source_code_samples,
    auth_patterns,
    prior_findings,
    risk_intents,
    agent_registry,
    agent_prompts,
    mcp_config,
    pipeline_files,
    services,
    apps,
    source_files,
    ownership_hints,
    git_history,
    ci_history: EMPTY_CI_HISTORY,
    existing_issues: [],
    metadata: {
      appCount: apps.length,
      serviceCount: services.length,
      treeEntryCount: repo_tree.length,
      sourceFileCount: source_files.length,
      ownershipHintCount: ownership_hints.length,
      lockfilePackageCount: lockfile_packages.length,
      vulnerabilityHitCount: vulnerability_context.hits.length,
      priorFindingCount: prior_findings.length,
      riskIntentCount: risk_intents.length,
      sourceCodeSampleCount: Object.keys(source_code_samples).length,
      authPatternCount: auth_patterns.length,
      agentPromptCount: Object.keys(agent_prompts).length,
      hasAgentRegistry: Boolean(agent_registry),
      hasMcpConfig: Object.keys(mcp_config).length > 0,
      gitHistoryPathCount: git_history.length,
      gitHistoryCommitCount: git_history.reduce((count, entry) => count + entry.commits.length, 0)
    }
  };
}

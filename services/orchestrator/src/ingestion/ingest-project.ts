import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { GitLabCiHistorySummary, GitLabIssueSummary } from '@premortem/integrations';

const CI_FILE_NAMES = ['.gitlab-ci.yml', '.gitlab-ci.yaml'];
const MANIFEST_NAMES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'docker-compose.yml', 'wrangler.toml'];
const DEPENDENCY_FILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
const SCHEMA_NAMES = ['schema.prisma', 'openapi.yaml', 'openapi.yml'];
const OWNERSHIP_FILES = ['CODEOWNERS', '.github/CODEOWNERS'];
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
}): Promise<IngestionBundle> {
  const repoRoot = path.resolve(input.rootDir);
  const repo_tree = await collectRepoTree(repoRoot);

  const pipeline_files: string[] = [];
  const ci_config: Record<string, unknown> = {};
  const source_files: IngestionBundle['source_files'] = [];
  const ownership_hints: IngestionBundle['ownership_hints'] = [];
  const git_history: IngestionBundle['git_history'] = [];

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

  for (const fileName of DEPENDENCY_FILES) {
    if (!(await pathExists(path.join(repoRoot, fileName)))) continue;
    const content = await readTextIfExists(path.join(repoRoot, fileName));
    if (content) {
      source_files.push(buildSourceSnapshot(fileName, content, 'manifest'));
    }
  }

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

  const apps = await listChildDirs(path.join(repoRoot, 'apps'));
  const services = await listChildDirs(path.join(repoRoot, 'services'));

  return {
    repoRoot,
    branch: input.branch,
    commitSha: input.commitSha,
    repo_tree,
    ci_config,
    has_ci: pipeline_files.length > 0,
    package_manifests,
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
      gitHistoryPathCount: git_history.length,
      gitHistoryCommitCount: git_history.reduce((count, entry) => count + entry.commits.length, 0)
    }
  };
}

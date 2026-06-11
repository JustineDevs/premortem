import fs from 'node:fs/promises';
import path from 'node:path';

import type { GitLabCiHistorySummary, GitLabIssueSummary } from '@premortem/integrations';

const CI_FILE_NAMES = ['.gitlab-ci.yml', '.gitlab-ci.yaml'];
const MANIFEST_NAMES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', 'docker-compose.yml', 'wrangler.toml'];

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

async function listChildDirs(target: string) {
  if (!(await pathExists(target))) return [] as string[];
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
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

  for (const fileName of CI_FILE_NAMES) {
    const absolute = path.join(repoRoot, fileName);
    const content = await readTextIfExists(absolute);
    if (content) {
      pipeline_files.push(fileName);
      ci_config[fileName] = {
        present: true,
        lineCount: content.split('\n').length,
        preview: content.split('\n').slice(0, 24).join('\n')
      };
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
        ci_config[relative] = {
          present: true,
          lineCount: content.split('\n').length,
          preview: content.split('\n').slice(0, 24).join('\n')
        };
      }
    }
  }

  const package_manifests: string[] = [];
  for (const fileName of MANIFEST_NAMES) {
    if (await pathExists(path.join(repoRoot, fileName))) {
      package_manifests.push(fileName);
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
    ci_history: EMPTY_CI_HISTORY,
    existing_issues: [],
    metadata: {
      appCount: apps.length,
      serviceCount: services.length,
      treeEntryCount: repo_tree.length
    }
  };
}

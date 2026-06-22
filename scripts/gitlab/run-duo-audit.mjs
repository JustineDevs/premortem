#!/usr/bin/env node

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) continue;
    const raw = entry.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex >= 0) {
      const key = raw.slice(0, eqIndex).trim();
      const value = raw.slice(eqIndex + 1).trim();
      if (key) result[key] = value;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[raw.trim()] = next;
      index += 1;
    } else {
      result[raw.trim()] = true;
    }
  }
  return result;
}

function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveFromContext(context) {
  if (!context || typeof context !== 'object') return {};
  const payload = context;
  const candidate =
    (payload.project && typeof payload.project === 'object' ? payload.project : null) ??
    (payload.repository && typeof payload.repository === 'object' ? payload.repository : null) ??
    payload;

  const externalProjectId =
    readString(candidate.externalProjectId) ||
    readString(candidate.path_with_namespace) ||
    readString(candidate.pathWithNamespace) ||
    readString(candidate.project_path) ||
    readString(candidate.projectPath);
  const branch =
    readString(candidate.branch) ||
    readString(candidate.ref) ||
    readString(candidate.target_branch) ||
    readString(candidate.targetBranch);
  const mergeRequestIid =
    readNumeric(candidate.merge_request_iid) ??
    readNumeric(candidate.mergeRequestIid) ??
    readNumeric(candidate.mr_iid) ??
    readNumeric(candidate.iid);

  return {
    externalProjectId,
    branch,
    mergeRequestIid
  };
}

async function main() {
  loadPremortemLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  let context = null;
  if (process.env.AI_FLOW_CONTEXT) {
    try {
      context = JSON.parse(process.env.AI_FLOW_CONTEXT);
    } catch {
      context = null;
    }
  }
  const resolvedContext = resolveFromContext(context);

  const externalProjectId =
    readString(args['external-project-id']) ||
    readString(args.project) ||
    readString(process.env.GITLAB_EXTERNAL_PROJECT_ID) ||
    readString(process.env.CI_PROJECT_PATH) ||
    resolvedContext.externalProjectId;

  const branch =
    readString(args.branch) ||
    readString(process.env.GITLAB_BRANCH) ||
    readString(process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME) ||
    readString(process.env.CI_COMMIT_REF_NAME) ||
    resolvedContext.branch ||
    '';

  const mergeRequestIid =
    readNumeric(args['merge-request-iid']) ??
    readNumeric(process.env.CI_MERGE_REQUEST_IID) ??
    resolvedContext.mergeRequestIid;

  const commitSha =
    readString(args['commit-sha']) ||
    readString(process.env.CI_COMMIT_SHA) ||
    readString(process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_SHA) ||
    '';

  if (!externalProjectId) {
    throw new Error(
      'externalProjectId is required. Pass --external-project-id or set GITLAB_EXTERNAL_PROJECT_ID/CI_PROJECT_PATH.'
    );
  }

  const { runGitLabDuoAudit } = await import('../../services/agent-builder/src/gitlab-duo-audit.ts');
  const payload = await runGitLabDuoAudit({
    externalProjectId,
    branch: branch || undefined,
    mergeRequestIid,
    commitSha: commitSha || undefined,
    gitlabBaseUrl: process.env.GITLAB_BASE_URL,
    gitlabToken: process.env.GITLAB_TOKEN
  });

  console.log(JSON.stringify(payload, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
}

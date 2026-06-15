#!/usr/bin/env node

import { existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_DEPLOY_CONFIG = join(ROOT, '.wrangler/deploy/config.json');
const ROOT_DEPLOY_CONFIG_BACKUP = join(ROOT, '.wrangler/deploy/config.json.pages-backup');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function withRootDeployConfigTemporarilyHidden(callback) {
  const shouldHide = existsSync(ROOT_DEPLOY_CONFIG);

  if (shouldHide) {
    renameSync(ROOT_DEPLOY_CONFIG, ROOT_DEPLOY_CONFIG_BACKUP);
  }

  try {
    return callback();
  } finally {
    if (shouldHide && existsSync(ROOT_DEPLOY_CONFIG_BACKUP)) {
      renameSync(ROOT_DEPLOY_CONFIG_BACKUP, ROOT_DEPLOY_CONFIG);
    }
  }
}

const exitCode = withRootDeployConfigTemporarilyHidden(() => {
  const steps = [
    ['pnpm', ['run', 'build:pages']],
    ['pnpm', ['--filter', '@premortem/web', 'exec', 'opennextjs-cloudflare', 'build', '--dangerouslyUseUnsupportedNextVersion']],
    ['node', ['./scripts/cloudflare/prepare-pages-output.mjs']]
  ];

  for (const [command, args] of steps) {
    const status = run(command, args);
    if (status !== 0) {
      return status;
    }
  }

  return 0;
});

process.exit(exitCode);

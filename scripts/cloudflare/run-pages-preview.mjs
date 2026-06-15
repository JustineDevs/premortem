#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withHiddenRootDeployConfig } from './with-hidden-root-deploy-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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

const exitCode = withHiddenRootDeployConfig(() => {
  const steps = [
    ['pnpm', ['--dir', 'apps/web', 'run', 'prepreview']],
    ['pnpm', ['--filter', '@premortem/web', 'exec', 'opennextjs-cloudflare', 'build', '--dangerouslyUseUnsupportedNextVersion']],
    ['pnpm', ['--filter', '@premortem/web', 'exec', 'opennextjs-cloudflare', 'preview']]
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

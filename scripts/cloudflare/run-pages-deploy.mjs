#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemProductionEnv } from '../load-local-env.mjs';
import { withHiddenRootDeployConfig } from './with-hidden-root-deploy-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemProductionEnv(ROOT);
process.env.CLOUDFLARE_ENV = 'production';

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
    ['pnpm', ['--dir', 'apps/web', 'run', 'predeploy']],
    [
      'pnpm',
      ['--dir', 'apps/web', 'exec', 'opennextjs-cloudflare', 'build', '--dangerouslyUseUnsupportedNextVersion']
    ],
    ['node', ['./scripts/cloudflare/sanitize-open-next-env.mjs', 'apps/web/.open-next/cloudflare/next-env.mjs']],
    ['pnpm', ['--dir', 'apps/web', 'exec', 'opennextjs-cloudflare', 'deploy']]
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

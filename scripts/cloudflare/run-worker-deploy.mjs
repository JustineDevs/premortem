#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemProductionEnv } from '../load-local-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemProductionEnv(ROOT);
process.env.CLOUDFLARE_ENV = 'production';

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

const steps = [
  ['node', ['./scripts/cloudflare/ensure-queues.mjs', 'production']],
  ['pnpm', ['--dir', 'apps/api', 'exec', 'wrangler', 'deploy', '--config', 'wrangler.production.toml']]
];

for (const [command, args] of steps) {
  const status = run(command, args);
  if (status !== 0) {
    process.exit(status);
  }
}

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const ENVIRONMENTS = {
  production: {
    queues: ['premortem-audit-jobs', 'premortem-audit-jobs-dlq']
  },
  dev: {
    queues: ['premortem-audit-jobs-dev', 'premortem-audit-jobs-dlq-dev']
  }
};

function usage() {
  console.error('Usage: node scripts/cloudflare/ensure-queues.mjs <production|dev>');
}

function runWrangler(args) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function queueExists(name) {
  return runWrangler(['queues', 'info', name]) === 0;
}

function ensureQueue(name) {
  if (queueExists(name)) {
    console.log(`Queue already exists: ${name}`);
    return;
  }

  console.log(`Creating queue: ${name}`);
  const status = runWrangler(['queues', 'create', name]);
  if (status !== 0) {
    process.exit(status);
  }
}

const environmentName = (process.argv[2] || 'production').toLowerCase();
const environment = ENVIRONMENTS[environmentName];

if (!environment) {
  usage();
  process.exit(1);
}

if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required to manage queues.');
  process.exit(1);
}

for (const queue of environment.queues) {
  ensureQueue(queue);
}

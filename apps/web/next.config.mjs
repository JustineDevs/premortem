import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';

import { loadPremortemLocalEnv } from '../../scripts/load-local-env.mjs';

loadPremortemLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');
process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT ??= monorepoRoot;

/** @type {import('next').NextConfig} */
const workspacePackages = [
  '@premortem/agent-kit',
  '@premortem/db',
  '@premortem/domain',
  '@premortem/integrations',
  '@premortem/llm',
  '@premortem/observability',
  '@premortem/orchestrator',
  '@premortem/storage',
];

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: workspacePackages,
  experimental: {
    externalDir: true,
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.join(monorepoRoot, 'node_modules'),
      ...(config.resolve.modules ?? ['node_modules']),
    ];
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: 'premortem',
  project: 'javascript-nextjs',
  silent: !process.env.CI
});

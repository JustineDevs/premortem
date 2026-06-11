import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';

import { loadPremortemLocalEnv } from '../../scripts/load-local-env.mjs';

loadPremortemLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

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
  experimental: {
    externalDir: true,
    instrumentationHook: true,
    serverComponentsExternalPackages: workspacePackages,
  },
};

export default withSentryConfig(nextConfig, {
  org: 'premortem',
  project: 'javascript-nextjs',
  silent: !process.env.CI
});

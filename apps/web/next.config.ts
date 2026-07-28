import path from 'node:path';
import { withBotId } from 'botid/next/config';

import { loadPremortemLocalEnv } from '../../scripts/load-local-env.ts';

if (process.env.NODE_ENV !== 'production') {
  loadPremortemLocalEnv(path.resolve(__dirname, '../..'));
}

const monorepoRoot = path.resolve(__dirname, '../..');
process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT ??= monorepoRoot;

/** @type {import('next').NextConfig} */
const workspacePackages = [
  '@premortem/domain',
];

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: [
    '@premortem/db',
    '@premortem/observability',
    '@premortem/integrations',
    '@premortem/llm',
    '@premortem/orchestrator',
    '@premortem/storage',
    'stripe'
  ],
  transpilePackages: workspacePackages,
  experimental: {
    externalDir: true,
    optimizePackageImports: ['lucide-react']
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.join(monorepoRoot, 'node_modules'),
      ...(config.resolve.modules ?? ['node_modules']),
    ];
    return config;
  },
};

export default withBotId(nextConfig);

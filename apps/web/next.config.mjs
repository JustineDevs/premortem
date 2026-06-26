import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemLocalEnv } from '../../scripts/load-local-env.mjs';

if (process.env.NODE_ENV !== 'production') {
  loadPremortemLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
}

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');
process.env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT ??= monorepoRoot;

/** @type {import('next').NextConfig} */
const workspacePackages = [
  '@premortem/domain',
];

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  serverExternalPackages: [
    '@premortem/db',
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

export default nextConfig;

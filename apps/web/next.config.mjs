import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';

import { loadPremortemLocalEnv } from '../../scripts/load-local-env.mjs';

loadPremortemLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
    instrumentationHook: true
  }
};

export default withSentryConfig(nextConfig, {
  org: 'premortem',
  project: 'javascript-nextjs',
  silent: !process.env.CI
});
